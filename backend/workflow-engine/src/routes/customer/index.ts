import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { runMigrations } from '../../setup/migrate';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket as any } });

function makeid(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

async function getUser(request: any) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.warn('[Auth] Token validation failed:', error.message);
    return null;
  }
  return user;
}

export function registerCustomerRoutes(server: FastifyInstance) {

  // POST /api/customer/ensure — find or create customer record
  server.post('/api/customer/ensure', async (request: any, reply: any) => {
    const startTime = Date.now();
    try {
      const user = await getUser(request);
      if (!user) {
        console.warn('[Customer] Unauthorized ensure attempt');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      let existing: any = null;
      let fetchError: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await supabase
          .from('customers')
          .select('*')
          .eq('id', user.id)
          .single();

        if (result.data) {
          existing = result.data;
          break;
        }

        fetchError = result.error;

        if (fetchError?.code === 'PGRST205' || fetchError?.message?.includes('Could not find the table')) {
          console.warn(`[Customer] Schema cache stale (attempt ${attempt + 1}/3), retrying...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        if (fetchError?.code !== 'PGRST116') {
          console.error(`[Customer] Fetch error (attempt ${attempt + 1}/3):`, fetchError);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        }
        break;
      }

      if (existing) {
        return reply.send(existing);
      }

      if (fetchError && fetchError.code !== 'PGRST116' && !fetchError.message?.includes('Could not find the table')) {
        console.error('[Customer] Fetch failed, cannot create:', fetchError);
        return reply.status(500).send({ error: 'Database error', details: fetchError.message });
      }

      const newCustomer = {
        id: user.id,
        email: user.email,
        api_key: makeid(32),
        product_name: '',
        created_at: new Date().toISOString(),
      };

      const { data: created, error: insertError } = await supabase
        .from('customers')
        .insert(newCustomer)
        .select()
        .single();

      if (insertError) {
        console.error('[Customer] Insert error:', insertError);

        if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
          const { data: existingByEmail } = await supabase
            .from('customers')
            .select('*')
            .eq('email', user.email)
            .single();
          if (existingByEmail) return reply.send(existingByEmail);
        }

        return reply.status(500).send({
          error: 'Failed to create customer record',
          details: insertError.message,
        });
      }

      console.log(`[Customer] Created record ${created.id} in ${Date.now() - startTime}ms`);
      return reply.status(201).send(created);
    } catch (err: any) {
      console.error('[Customer] Unexpected error:', err);
      reply.status(500).send({ error: err.message || 'Internal server error' });
    }
  });

  // PUT /api/customer/update — update customer fields
  server.put('/api/customer/update', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const body = request.body || {};
      if (Object.keys(body).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      const allowedFields = ['product_name', 'whatsapp_number', 'slack_webhook_url', 'from_email', 'whatsapp_config'];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) {
          updates[key] = body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[Customer] Update error:', error);
        return reply.status(500).send({ error: 'Failed to update customer', details: error.message });
      }

      return reply.send(data);
    } catch (err: any) {
      console.error('[Customer] Update error:', err);
      reply.status(500).send({ error: err.message || 'Internal server error' });
    }
  });

  // POST /api/migrate — trigger manual migration
  server.post('/api/migrate', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      console.log('[Migrate] Manual migration triggered by', user.id);
      await runMigrations();
      return reply.send({ status: 'ok', message: 'Migration completed' });
    } catch (err: any) {
      console.error('[Migrate] Error:', err);
      reply.status(500).send({ error: err.message || 'Migration failed' });
    }
  });
}
