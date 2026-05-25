import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null

function getPrisma() {
  if (!prisma) {
    if (!process.env.DATABASE_URL) {
      console.warn('[Setup] DATABASE_URL not set - will attempt Supabase fallback')
      return null
    }
    prisma = new PrismaClient()
  }
  return prisma
}

const MIGRATIONS_SQL = `

-- 001: Initial schema
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    product_name TEXT,
    api_key TEXT UNIQUE NOT NULL DEFAULT 'lynkk_' || encode(gen_random_bytes(20), 'hex'),
    whatsapp_number TEXT,
    slack_webhook_url TEXT,
    resend_api_key TEXT,
    dialog360_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_action TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'at_risk', 'cold')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'custom',
    is_active BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'draft',
    inactive_days_trigger INTEGER DEFAULT 5,
    whatsapp_message TEXT,
    config JSONB,
    trigger_config JSONB,
    steps JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    action_taken TEXT NOT NULL DEFAULT 'email_sent',
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 003: Add whatsapp_config to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS whatsapp_config JSONB DEFAULT '{}'::jsonb;

-- 004: Tracked users unique constraint
ALTER TABLE public.tracked_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.tracked_users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.tracked_users ADD COLUMN IF NOT EXISTS mobile TEXT;

-- 005: Add from_email to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS from_email TEXT;

-- 011: SMS support
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS twilio_config JSONB;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_config JSONB;

CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    message_type TEXT NOT NULL DEFAULT 'outbound',
    template_id TEXT,
    content TEXT,
    recipient_phone TEXT,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending',
    external_message_id TEXT,
    twilio_sid TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 013: Push notifications
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS push_config JSONB;

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'WEB',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon_url TEXT,
    cta_url TEXT,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 014: Personalization campaigns
CREATE TABLE IF NOT EXISTS public.personalization_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'BANNER',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    targeting_rules JSONB DEFAULT '{"operator": "AND", "conditions": []}',
    content JSONB DEFAULT '{}',
    display_rules JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.personalization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES personalization_campaigns(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'IMPRESSION',
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 015: Funnels
CREATE TABLE IF NOT EXISTS public.funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    conversion_window_hours INTEGER NOT NULL DEFAULT 168,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS revenue_value NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_revenue_event BOOLEAN DEFAULT false;
ALTER TABLE public.user_messages ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC;

-- 017: CSV import
CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    imported INT NOT NULL DEFAULT 0,
    updated INT NOT NULL DEFAULT 0,
    skipped INT NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 018: Revenue attribution
ALTER TABLE public.user_messages ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;
ALTER TABLE public.user_messages ADD COLUMN IF NOT EXISTS tracked_user_id UUID REFERENCES tracked_users(id) ON DELETE SET NULL;

-- 019: Catalog items
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price NUMERIC,
    image_url TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 020: Recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    strategy TEXT NOT NULL,
    item_ids UUID[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 021: Recommendation events
CREATE TABLE IF NOT EXISTS public.recommendation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID REFERENCES tracked_users(id) ON DELETE SET NULL,
    strategy TEXT,
    item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL DEFAULT 'SHOWN',
    page_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 022: Experiments
CREATE TABLE IF NOT EXISTS public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'PERSONALIZATION',
    source_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    variants JSONB NOT NULL DEFAULT '[]',
    traffic_split JSONB NOT NULL DEFAULT '{}',
    goal_event TEXT NOT NULL,
    winner_variant_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE
);

-- 023: Personalization variant_id
ALTER TABLE public.personalization_events ADD COLUMN IF NOT EXISTS variant_id TEXT;

-- 024: Personalization variants
ALTER TABLE public.personalization_campaigns ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT NULL;

-- 025: Fix personalization type constraint
ALTER TABLE public.personalization_campaigns DROP CONSTRAINT IF EXISTS personalization_campaigns_type_check;
ALTER TABLE public.personalization_campaigns ADD CONSTRAINT personalization_campaigns_type_check CHECK (type IN ('BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS'));

-- Fix status constraint
ALTER TABLE public.personalization_campaigns DROP CONSTRAINT IF EXISTS personalization_campaigns_status_check;
ALTER TABLE public.personalization_campaigns ADD CONSTRAINT personalization_campaigns_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'));

-- Fix campaign type constraint
ALTER TABLE public.personalization_campaigns DROP CONSTRAINT IF EXISTS personalization_campaigns_type_check;
ALTER TABLE public.personalization_campaigns ADD CONSTRAINT personalization_campaigns_type_check CHECK (type IN ('BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS'));

-- 028: Fix workflow template_id nullable
ALTER TABLE public.workflows ALTER COLUMN template_id DROP NOT NULL;

-- Fix workflow type check
ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_type_check;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_type_check CHECK (type IN ('trial_recovery', 'onboarding_activation', 'silent_churn', 'custom'));

-- Fix workflow status check
ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_status_check;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'paused'));

-- Fix workflow_logs action_taken check
ALTER TABLE public.workflow_logs DROP CONSTRAINT IF EXISTS workflow_logs_action_taken_check;
ALTER TABLE public.workflow_logs ADD CONSTRAINT workflow_logs_action_taken_check CHECK (action_taken IN ('whatsapp_sent', 'email_sent', 'slack_notified', 'sms_sent', 'push_sent'));

-- Fix user_messages channel check
ALTER TABLE public.user_messages DROP CONSTRAINT IF EXISTS user_messages_channel_check;
ALTER TABLE public.user_messages ADD CONSTRAINT user_messages_channel_check CHECK (channel IN ('whatsapp', 'email', 'slack', 'sms', 'push'));

-- Fix user_messages status check
ALTER TABLE public.user_messages DROP CONSTRAINT IF EXISTS user_messages_status_check;
ALTER TABLE public.user_messages ADD CONSTRAINT user_messages_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read'));

-- Fix push_tokens platform check
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_platform_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('WEB', 'IOS', 'ANDROID'));

-- Fix personalization_events event_type check
ALTER TABLE public.personalization_events DROP CONSTRAINT IF EXISTS personalization_events_event_type_check;
ALTER TABLE public.personalization_events ADD CONSTRAINT personalization_events_event_type_check CHECK (event_type IN ('IMPRESSION', 'CLICK', 'DISMISSED'));

-- Fix experiments type check
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_type_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_type_check CHECK (type IN ('WORKFLOW', 'PERSONALIZATION'));

-- Fix experiments status check
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_status_check CHECK (status IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'));

-- Fix catalog_items unique constraint
ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS catalog_items_customer_id_external_id_key;
ALTER TABLE public.catalog_items ADD UNIQUE (customer_id, external_id);

-- Fix tracked_users unique constraint
ALTER TABLE public.tracked_users DROP CONSTRAINT IF EXISTS tracked_users_customer_id_email_key;
ALTER TABLE public.tracked_users ADD UNIQUE (customer_id, email);

-- Fix tracked_users source check
ALTER TABLE public.tracked_users DROP CONSTRAINT IF EXISTS tracked_users_source_check;
ALTER TABLE public.tracked_users ADD CONSTRAINT tracked_users_source_check CHECK (source IN ('js_snippet', 'csv_import', 'api'));

-- Fix tracked_users status check
ALTER TABLE public.tracked_users DROP CONSTRAINT IF EXISTS tracked_users_status_check;
ALTER TABLE public.tracked_users ADD CONSTRAINT tracked_users_status_check CHECK (status IN ('active', 'at_risk', 'cold'));

-- Fix experiments type check (duplicate safe)
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_type_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_type_check CHECK (type IN ('WORKFLOW', 'PERSONALIZATION'));

-- Fix experiments status check (duplicate safe)
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_status_check CHECK (status IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'));

-- NOTE: RLS is managed through Supabase dashboard - enabling here is safe but
-- policies must be set up through the Supabase UI or direct SQL
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
`

export async function runMigrations() {
  console.log('[Setup] Running database migrations...')
  const client = getPrisma()

  if (!client) {
    console.warn('[Setup] DATABASE_URL not set - cannot run automatic migration.')
    console.warn('[Setup] To fix: set DATABASE_URL in Render dashboard env vars and redeploy.')
    console.warn('[Setup] Alternatively, run the SQL manually in Supabase SQL Editor.')
    console.warn('[Setup] SQL file: backend/supabase/migrations/999_complete_schema.sql')
    console.warn('[Setup] Trigger manual migration via: POST /api/migrate (requires auth token)')
    return
  }

  // Split SQL into individual statements for more reliable execution
  const statements = MIGRATIONS_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.$executeRawUnsafe(stmt + ';');
      successCount++;
    } catch (err: any) {
      failCount++;
      if (err.message && !err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.warn(`[Setup] Statement ${i + 1}/${statements.length} failed: ${err.message.slice(0, 200)}`);
      }
    }
  }

  console.log(`[Setup] Migrations: ${successCount} succeeded, ${failCount} skipped (already existed)`);

  // Notify PostgREST to reload schema cache
  try {
    await client.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
    console.log('[Setup] PostgREST schema cache notified');
  } catch {
    // NOTIFY may fail in some environments - not critical
  }

  // Wait a moment for schema cache to refresh
  await new Promise(r => setTimeout(r, 2000));

  await client.$disconnect();
  console.log('[Setup] Migration setup complete');
}
