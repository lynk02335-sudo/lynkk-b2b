import type { FastifyInstance } from 'fastify';
import { stringify } from 'csv-stringify/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getUser(request: any) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export function registerUserExportRoutes(server: FastifyInstance) {
  server.get('/api/users/export', async (request: any, reply: any) => {
    try {
      const user = await getUser(request);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { status, search, plan, source } = request.query as {
        status?: string;
        search?: string;
        plan?: string;
        source?: string;
      };

      const today = new Date().toISOString().split('T')[0];
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="lynkk-users-${today}.csv"`);

      let query = supabase
        .from('tracked_users')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (source) {
        query = query.eq('source', source);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: users, error } = await query;
      if (error) throw error;

      if (!users || users.length === 0) {
        return reply.send('');
      }

      const customKeys = new Set<string>();
      for (const u of users) {
        if (u.metadata && typeof u.metadata === 'object') {
          for (const key of Object.keys(u.metadata as Record<string, unknown>)) {
            customKeys.add(key);
          }
        }
      }

      const baseColumns = [
        'id', 'email', 'name', 'phone', 'status', 'plan',
        'source', 'created_at', 'last_seen', 'events_count',
      ];
      const customColumns = [...customKeys].sort();
      const columns = [...baseColumns, ...customColumns];

      const rows = users.map((u: any) => {
        const meta = (u.metadata || {}) as Record<string, unknown>;
        const row: Record<string, any> = {
          id: u.id,
          email: u.email || '',
          name: u.name || '',
          phone: u.phone || '',
          status: u.status || '',
          plan: meta.plan || '',
          source: u.source || 'api',
          created_at: u.created_at || '',
          last_seen: u.last_seen || '',
          events_count: meta.events_count || '',
        };
        for (const key of customColumns) {
          row[key] = meta[key] !== undefined ? String(meta[key]) : '';
        }
        return row;
      });

      const csv = stringify(rows, { header: true, columns });
      return reply.send(csv);
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });
}
