import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { BaseStrategy } from './BaseStrategy';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket as any } });

export class SimilarUsersStrategy extends BaseStrategy {
  name = 'SIMILAR_USERS';

  async generate(customerId: string): Promise<Map<string, string[]>> {
    const items = await this.getActiveItems(customerId);
    if (items.length === 0) return new Map();

    const externalIdToDbId = new Map(items.map(i => [i.external_id, i.id]));

    // Build user profiles: which categories and items each user has engaged with
    const { data: events } = await supabase
      .from('events')
      .select('tracked_user_email, event_name, properties')
      .eq('customer_id', customerId)
      .in('event_name', ['product.viewed', 'product.purchased', 'product.added_to_cart']);

    if (!events || events.length === 0) return new Map();

    // Profile per tracked_user_email: set of viewed item db ids and categories
    const profiles = new Map<string, { items: Set<string>; categories: Set<string> }>();
    for (const ev of events) {
      const props = (ev.properties || {}) as Record<string, any>;
      const productId = props.product_id || props.id;
      const category = props.category ? String(props.category) : null;
      const email = ev.tracked_user_email;

      if (!profiles.has(email)) {
        profiles.set(email, { items: new Set(), categories: new Set() });
      }
      const profile = profiles.get(email)!;

      if (productId && externalIdToDbId.has(String(productId))) {
        profile.items.add(externalIdToDbId.get(String(productId))!);
      }
      if (category) {
        profile.categories.add(category);
      }
    }

    const userEmails = [...profiles.keys()];
    const result = new Map<string, string[]>();

    for (let i = 0; i < userEmails.length; i++) {
      const email = userEmails[i];
      const profile = profiles.get(email)!;

      const { data: tu } = await supabase
        .from('tracked_users')
        .select('id, status')
        .eq('customer_id', customerId)
        .eq('email', email)
        .single();

      if (!tu) continue;

      // Find similar users: jaccard similarity on categories + same status
      const similarScores: { email: string; score: number }[] = [];

      for (let j = 0; j < userEmails.length; j++) {
        if (i === j) continue;
        const otherEmail = userEmails[j];
        const otherProfile = profiles.get(otherEmail)!;

        // Category overlap (jaccard)
        const intersection = new Set(
          [...profile.categories].filter(c => otherProfile.categories.has(c)),
        );
        const union = new Set([...profile.categories, ...otherProfile.categories]);
        const categoryScore = union.size > 0 ? intersection.size / union.size : 0;

        // Item overlap bonus
        const itemIntersection = new Set(
          [...profile.items].filter(item => otherProfile.items.has(item)),
        );
        const itemScore = itemIntersection.size > 0 ? 0.3 : 0;

        // Status match bonus
        const { data: otherTu } = await supabase
          .from('tracked_users')
          .select('status')
          .eq('customer_id', customerId)
          .eq('email', otherEmail)
          .single();

        const statusScore = otherTu && otherTu.status === tu.status ? 0.2 : 0;
        const totalScore = categoryScore + itemScore + statusScore;

        if (totalScore > 0.1) {
          similarScores.push({ email: otherEmail, score: totalScore });
        }
      }

      // Get items from similar users that this user hasn't seen
      const seenItems = profile.items;
      const recommendedScores = new Map<string, number>();

      for (const similar of similarScores.sort((a, b) => b.score - a.score).slice(0, 20)) {
        const similarProfile = profiles.get(similar.email)!;
        for (const itemId of similarProfile.items) {
          if (!seenItems.has(itemId)) {
            recommendedScores.set(
              itemId,
              (recommendedScores.get(itemId) || 0) + similar.score,
            );
          }
        }
      }

      const sorted = [...recommendedScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      result.set(tu.id, sorted);
    }

    return result;
  }
}
