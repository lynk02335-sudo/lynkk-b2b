import type { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

async function getUser(request: any) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

const REQUIRED_COLUMNS = ['external_id', 'name'];

export function registerCatalogImportRoutes(server: FastifyInstance) {
  server.post('/api/catalog/import/validate', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });
      if (data.file.truncated) return reply.status(400).send({ error: 'File exceeds 10MB limit' });

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
        return reply.status(400).send({ error: 'Invalid CSV format' });
      }

      if (records.length === 0) {
        return reply.status(400).send({ error: 'CSV file is empty' });
      }

      const headers = Object.keys(records[0]);
      const missingRequired = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
      if (missingRequired.length > 0) {
        return reply.status(400).send({
          error: `Missing required columns: ${missingRequired.join(', ')}`,
        });
      }

      const errors: any[] = [];
      const validRows: any[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;

        if (!row.external_id || !row.external_id.trim()) {
          errors.push({ row: rowNum, field: 'external_id', reason: 'external_id is required' });
          continue;
        }
        if (!row.name || !row.name.trim()) {
          errors.push({ row: rowNum, field: 'name', value: row.external_id, reason: 'name is required' });
          continue;
        }

        validRows.push({
          external_id: row.external_id.trim(),
          name: row.name.trim(),
          description: (row.description || '').trim() || null,
          category: (row.category || '').trim() || null,
          price: row.price ? Number(row.price) : null,
          image_url: (row.image_url || '').trim() || null,
          url: (row.url || '').trim() || null,
        });
      }

      const sessionId = randomUUID();
      sessionSet(sessionId, {
        customer_id: user.id,
        rows: validRows,
        filename: data.filename || 'upload.csv',
      });

      return reply.send({
        session_id: sessionId,
        total_rows: records.length,
        valid_rows: validRows.length,
        errors,
      });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  server.post('/api/catalog/import/confirm', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      const { session_id } = request.body || {};
      if (!session_id) return reply.status(400).send({ error: 'session_id is required' });

      const session = sessionGet(session_id) as any;
      if (!session) return reply.status(400).send({ error: 'Session expired or invalid' });

      sessionDel(session_id);

      if (session.customer_id !== user.id) {
        return reply.status(403).send({ error: 'Session does not belong to this customer' });
      }

      let imported = 0;
      let updated = 0;

      for (const row of session.rows) {
        const existing = await supabase
          .from('catalog_items')
          .select('id')
          .eq('customer_id', user.id)
          .eq('external_id', row.external_id)
          .single();

        if (existing.data) {
          await supabase
            .from('catalog_items')
            .update({
              name: row.name,
              description: row.description,
              category: row.category,
              price: row.price,
              image_url: row.image_url,
              url: row.url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.data.id);
          updated++;
        } else {
          await supabase
            .from('catalog_items')
            .insert({
              customer_id: user.id,
              external_id: row.external_id,
              name: row.name,
              description: row.description,
              category: row.category,
              price: row.price,
              image_url: row.image_url,
              url: row.url,
            });
          imported++;
        }
      }

      return reply.send({ imported, updated, total: session.rows.length });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });
}
