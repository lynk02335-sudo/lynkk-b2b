import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket as any } });

export interface CatalogItem {
  id: string;
  customer_id: string;
  external_id: string;
  name: string;
  category: string | null;
}

export abstract class BaseStrategy {
  abstract name: string;

  abstract generate(customerId: string): Promise<Map<string, string[]>>;

  protected async getActiveItems(customerId: string): Promise<CatalogItem[]> {
    const { data } = await supabase
      .from('catalog_items')
      .select('id, customer_id, external_id, name, category')
      .eq('customer_id', customerId)
      .eq('active', true);
    return (data || []) as CatalogItem[];
  }
}
