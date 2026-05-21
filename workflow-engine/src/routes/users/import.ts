import type { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory session store for the validate → confirm two-step import flow.
// TTL matches the 10-minute window originally provided by Redis.
const IMPORT_TTL_MS = 10 * 60 * 1000;
const importSessions = new Map<string, { data: unknown; expiresAt: number }>();

function sessionSet(key: string, data: unknown) {
  importSessions.set(key, { data, expiresAt: Date.now() + IMPORT_TTL_MS });
}

function sessionGet(key: string): unknown | null {
  const entry = importSessions.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { importSessions.delete(key); return null; }
  return entry.data;
}

function sessionDel(key: string) {
  importSessions.delete(key);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

function normalizePhone(value: string): { normalized: string | null; warning?: string } {
  const cleaned = value.replace(/[\s\-\(\)]/g, '');
  if (E164_REGEX.test(cleaned)) {
    return { normalized: cleaned };
  }
  if (/^\d{7,15}$/.test(cleaned)) {
    const normalized = `+${cleaned}`;
    if (E164_REGEX.test(normalized)) {
      return { normalized, warning: `Phone normalized to ${normalized}` };
    }
  }
  return { normalized: null, warning: `Invalid phone format: ${value}` };
}

async function getUser(request: any) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

const COLUMN_MAPPINGS: Record<string, string> = {
  'email': 'email',
  'e-mail': 'email',
  'name': 'name',
  'full name': 'name',
  'first name': 'first_name',
  'fname': 'first_name',
  'last name': 'last_name',
  'lname': 'last_name',
  'phone': 'phone',
  'mobile': 'phone',
  'plan': 'plan',
  'company': 'company',
  'org': 'company',
};

function autoMapColumn(header: string): string {
  const lower = header.toLowerCase().trim();
  return COLUMN_MAPPINGS[lower] || '__custom__';
}

export function registerUserImportRoutes(server: FastifyInstance) {
  server.post('/api/users/import/validate', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      if (data.file.truncated) {
        return reply.status(400).send({ error: 'File exceeds 10MB limit' });
      }

      const mappingField = data.fields?.mapping;
      let mapping: Record<string, string> = {};
      if (mappingField) {
        try {
          mapping = JSON.parse(mappingField.value);
        } catch {
          return reply.status(400).send({ error: 'Invalid mapping JSON' });
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const csvBuffer = Buffer.concat(chunks);
      const csvContent = csvBuffer.toString('utf-8');

      let records: any[];
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
      } catch {
        return reply.status(400).send({ error: 'Invalid CSV format. Please check your file.' });
      }

      if (records.length === 0) {
        return reply.status(400).send({ error: 'CSV file is empty' });
      }

      const detectedHeaders = Object.keys(records[0]);
      const actualMapping: Record<string, string> = {};

      if (Object.keys(mapping).length > 0) {
        for (const [csvCol, lynkkField] of Object.entries(mapping)) {
          if (lynkkField && lynkkField !== '__skip__') {
            actualMapping[csvCol] = lynkkField;
          }
        }
      } else {
        for (const header of detectedHeaders) {
          const mapped = autoMapColumn(header);
          if (mapped !== '__custom__') {
            actualMapping[header] = mapped;
          }
        }
      }

      const emailColumn = Object.entries(actualMapping).find(([, v]) => v === 'email')?.[0];
      if (!emailColumn) {
        return reply.status(400).send({ error: 'Email column must be mapped' });
      }

      const errors: any[] = [];
      const warnings: any[] = [];
      const validRows: any[] = [];
      let willUpdate = 0;

      const { data: existingUsers } = await supabase
        .from('tracked_users')
        .select('email')
        .eq('customer_id', user.id);

      const existingEmails = new Set((existingUsers || []).map((u: any) => u.email.toLowerCase()));

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        const mappedRow: Record<string, any> = {};
        let rowHasError = false;

        for (const [csvCol, lynkkField] of Object.entries(actualMapping)) {
          const value = (row[csvCol] || '').toString().trim();
          mappedRow[lynkkField] = value;
        }

        const email = (mappedRow['email'] || '').toLowerCase().trim();

        if (!email) {
          errors.push({ row: rowNum, field: 'email', value: '', reason: 'Email is required' });
          rowHasError = true;
        } else if (!EMAIL_REGEX.test(email)) {
          errors.push({ row: rowNum, field: 'email', value: email, reason: 'Invalid email format' });
          rowHasError = true;
        }

        if (mappedRow['phone']) {
          const phoneVal = mappedRow['phone'].toString().trim();
          const { normalized, warning } = normalizePhone(phoneVal);
          if (normalized) {
            mappedRow['phone'] = normalized;
            if (warning) {
              warnings.push({ row: rowNum, field: 'phone', value: phoneVal, reason: warning });
            }
          } else {
            warnings.push({ row: rowNum, field: 'phone', value: phoneVal, reason: warning || 'Phone will be skipped' });
            delete mappedRow['phone'];
          }
        }

        if (!rowHasError) {
          const isUpdate = existingEmails.has(email);
          if (isUpdate) {
            willUpdate++;
          }
          validRows.push({ ...mappedRow, email, _isUpdate: isUpdate });
        }
      }

      const importKey = `import:${user.id}:${randomUUID()}`;
      sessionSet(importKey, {
        customer_id: user.id,
        filename: data.filename || 'upload.csv',
        validRows,
        errors,
        total: records.length,
      });

      const preview = validRows.slice(0, 5).map((r: any) => {
        const { _isUpdate, ...rest } = r;
        return { ...rest, status: _isUpdate ? 'will_update' : 'new' };
      });

      return reply.send({
        total: records.length,
        valid: validRows.length,
        will_update: willUpdate,
        errors,
        warnings,
        preview,
        import_key: importKey,
        filename: data.filename || 'upload.csv',
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: err.errors });
      }
      reply.status(500).send({ error: err.message });
    }
  });

  server.post('/api/users/import/confirm', async (request: any, reply: any) => {
    try {
      const body = z.object({
        import_key: z.string(),
        skip_errors: z.boolean().default(true),
      }).parse(request.body);

      const user = await getUser(request);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const importData = sessionGet(body.import_key) as any;
      if (!importData) {
        return reply.status(410).send({ error: 'Import session expired. Please re-upload.' });
      }

      if (importData.customer_id !== user.id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      sessionDel(body.import_key);

      const { data: logEntry, error: logError } = await supabase
        .from('import_logs')
        .insert({
          customer_id: user.id,
          filename: importData.filename || 'upload.csv',
          total_rows: importData.total,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: body.skip_errors ? importData.errors : [],
          status: 'processing',
        })
        .select()
        .single();

      if (logError) throw logError;
      const logId = logEntry.id;

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      const batches: any[] = [];
      const validRows = importData.validRows || [];
      for (let i = 0; i < validRows.length; i += 100) {
        batches.push(validRows.slice(i, i + 100));
      }

      try {
        for (const batch of batches) {
          for (const row of batch) {
            const { _isUpdate, ...rowData } = row;
            const { data: existing } = await supabase
              .from('tracked_users')
              .select('id, metadata')
              .eq('customer_id', user.id)
              .eq('email', rowData.email)
              .maybeSingle();

            if (existing) {
              const existingMeta = (existing.metadata || {}) as Record<string, unknown>;
              const customProps: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(rowData)) {
                if (!['email', 'name', 'phone', 'first_name', 'last_name', 'plan', '_isUpdate'].includes(key)) {
                  customProps[key] = value;
                }
              }

              const updateData: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
              };
              if (rowData.name) updateData.name = rowData.name;
              if (rowData.phone) updateData.phone = rowData.phone;
              if (Object.keys(customProps).length > 0) {
                updateData.metadata = { ...existingMeta, ...customProps };
              }

              const { error: updateError } = await supabase
                .from('tracked_users')
                .update(updateData)
                .eq('id', existing.id);

              if (!updateError) updated++;
            } else {
              const insertData: Record<string, unknown> = {
                customer_id: user.id,
                email: rowData.email,
                source: 'csv_import',
                status: 'active',
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
              };
              if (rowData.name) insertData.name = rowData.name;
              if (rowData.phone) insertData.phone = rowData.phone;

              const customProps: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(rowData)) {
                if (!['email', 'name', 'phone', 'first_name', 'last_name', 'plan', '_isUpdate'].includes(key)) {
                  customProps[key] = value;
                }
              }
              if (Object.keys(customProps).length > 0) {
                insertData.metadata = customProps;
              }

              const { error: insertError } = await supabase
                .from('tracked_users')
                .insert(insertData);

              if (!insertError) imported++;
            }
          }
        }
      } catch (err: any) {
        await supabase
          .from('import_logs')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', logId);
        return reply.status(500).send({ error: err.message });
      }

      await supabase
        .from('import_logs')
        .update({
          imported,
          updated,
          skipped,
          status: 'complete',
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      return reply.send({
        import_log_id: logId,
        imported,
        updated,
        skipped,
        total: importData.total,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: err.errors });
      }
      reply.status(500).send({ error: err.message });
    }
  });
}
