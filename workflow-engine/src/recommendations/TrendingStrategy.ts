import { createClient } from '@supabase/supabase-js';
import { BaseStrategy } from './BaseStrategy';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class TrendingStrategy extends BaseStrategy {
  name = 'TRENDING';

  async generate(customerId: string): Promise<Map<string, string[]>> {
    const items = await this.getActiveItems(customerId);
    if (items.length === 0) return new Map();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const itemIdToDbId = new Map(items.map(i => [i.external_id, i.id]));

    // Build per-user trending recommendations: top items by view/purchase events
    const { data: users } = await supabase
      .from('tracked_users')
      .select('id, email')
      .eq('customer_id', customerId);

    if (!users || users.length === 0) return new Map();

    const { data: recentEvents } = await supabase
      .from('events')
      .select('tracked_user_email, properties')
      .eq('customer_id', customerId)
      .in('event_name', ['product.viewed', 'product.purchased', 'product.added_to_cart'])
      .gte('created_at', sevenDaysAgo);

    const eventCounts = new Map<string, number>();
    for (const ev of recentEvents || []) {
      const props = ev.properties as Record<string, any> || {};
      const productId = props.product_id || props.id;
      if (productId && itemIdToDbId.has(String(productId))) {
        const dbId = itemIdToDbId.get(String(productId))!;
        eventCounts.set(dbId, (eventCounts.get(dbId) || 0) + 1);
      }
    }

    const sorted = [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);

    const result = new Map<string, string[]>();
    for (const user of users) {
      result.set(user.id, sorted);
    }

    return result;
  }
}
