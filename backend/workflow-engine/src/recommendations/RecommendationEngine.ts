import { createClient } from '@supabase/supabase-js';
import { BaseStrategy } from './BaseStrategy';
import { TrendingStrategy } from './TrendingStrategy';
import { ViewedTogetherStrategy } from './ViewedTogetherStrategy';
import { SimilarUsersStrategy } from './SimilarUsersStrategy';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class RecommendationEngine {
  private strategies: BaseStrategy[];

  constructor() {
    this.strategies = [
      new TrendingStrategy(),
      new ViewedTogetherStrategy(),
      new SimilarUsersStrategy(),
    ];
  }

  async generateForCustomer(customerId: string): Promise<{ strategy: string; users: number }[]> {
    const results: { strategy: string; users: number }[] = [];

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    for (const strategy of this.strategies) {
      console.log(`[RecommendationEngine] Running ${strategy.name} for customer ${customerId}`);
      const userRecommendations = await strategy.generate(customerId);

      let userCount = 0;
      for (const [trackedUserId, itemIds] of userRecommendations) {
        if (itemIds.length === 0) continue;

        await supabase.from('recommendations').upsert(
          {
            customer_id: customerId,
            tracked_user_id: trackedUserId,
            strategy: strategy.name,
            item_ids: itemIds,
            generated_at: now,
            expires_at: expiresAt,
          },
          {
            onConflict: 'customer_id,tracked_user_id,strategy',
            ignoreDuplicates: false,
          },
        );
        userCount++;
      }

      results.push({ strategy: strategy.name, users: userCount });
      console.log(
        `[RecommendationEngine] ${strategy.name}: ${userCount} users got recommendations`,
      );
    }

    return results;
  }

  async generateForAllCustomers(): Promise<void> {
    const { data: customers } = await supabase
      .from('customers')
      .select('id');

    if (!customers || customers.length === 0) {
      console.log('[RecommendationEngine] No customers found');
      return;
    }

    for (const customer of customers) {
      const { data: catalogCount } = await supabase
        .from('catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('active', true);

      if (!catalogCount || catalogCount.length === 0) {
        continue;
      }

      await this.generateForCustomer(customer.id);
    }
  }
}
