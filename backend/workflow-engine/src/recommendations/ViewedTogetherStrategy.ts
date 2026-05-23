import { createClient } from '@supabase/supabase-js';
import { BaseStrategy } from './BaseStrategy';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class ViewedTogetherStrategy extends BaseStrategy {
  name = 'VIEWED_TOGETHER';

  async generate(customerId: string): Promise<Map<string, string[]>> {
    const items = await this.getActiveItems(customerId);
    if (items.length === 0) return new Map();

    const externalIdToDbId = new Map(items.map(i => [i.external_id, i.id]));
    const dbIdToExternalId = new Map(items.map(i => [i.id, i.external_id]));

    const { data: events } = await supabase
      .from('events')
      .select('tracked_user_email, properties')
      .eq('customer_id', customerId)
      .eq('event_name', 'product.viewed');

    if (!events || events.length === 0) return new Map();

    // Build user-to-items mapping: each user's viewed items
    const userItems = new Map<string, Set<string>>();
    for (const ev of events) {
      const props = (ev.properties || {}) as Record<string, any>;
      const productId = props.product_id || props.id;
      if (productId && externalIdToDbId.has(String(productId))) {
        const email = ev.tracked_user_email;
        if (!userItems.has(email)) userItems.set(email, new Set());
        userItems.get(email)!.add(externalIdToDbId.get(String(productId))!);
      }
    }

    // Build co-occurrence matrix: for each item, count how often it appears with others
    const coOccurrence = new Map<string, Map<string, number>>();
    for (const viewedItems of userItems.values()) {
      const ids = [...viewedItems];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          if (!coOccurrence.has(a)) coOccurrence.set(a, new Map());
          if (!coOccurrence.has(b)) coOccurrence.set(b, new Map());
          coOccurrence.get(a)!.set(b, (coOccurrence.get(a)!.get(b) || 0) + 1);
          coOccurrence.get(b)!.set(a, (coOccurrence.get(b)!.get(a) || 0) + 1);
        }
      }
    }

    // For each user, find items they viewed and recommend co-occurring items they haven't seen
    const result = new Map<string, string[]>();
    const allUserEmails = [...new Set(events.map(e => e.tracked_user_email))];

    for (const email of allUserEmails) {
      const { data: tu } = await supabase
        .from('tracked_users')
        .select('id')
        .eq('customer_id', customerId)
        .eq('email', email)
        .single();

      if (!tu) continue;

      const viewedByUser = userItems.get(email) || new Set();
      const scores = new Map<string, number>();

      for (const viewedId of viewedByUser) {
        const related = coOccurrence.get(viewedId);
        if (related) {
          for (const [otherId, count] of related) {
            if (!viewedByUser.has(otherId)) {
              scores.set(otherId, (scores.get(otherId) || 0) + count);
            }
          }
        }
      }

      const sorted = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      result.set(tu.id, sorted);
    }

    return result;
  }
}
