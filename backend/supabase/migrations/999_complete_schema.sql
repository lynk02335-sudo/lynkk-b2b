-- =============================================================
-- LYNK COMPLETE DATABASE SCHEMA
-- This migration consolidates all 23 previous migrations into
-- one idempotent script. Safe to run multiple times.
-- Generated from full codebase analysis of all 18 tables.
-- =============================================================

-- =============================================================
-- SECTION 1: ENUM TYPES
-- =============================================================
DO $$ BEGIN
    CREATE TYPE recommendation_strategy AS ENUM (
        'VIEWED_TOGETHER', 'SIMILAR_USERS', 'TRENDING'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recommendation_event_type AS ENUM (
        'SHOWN', 'CLICKED', 'PURCHASED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE experiment_type AS ENUM (
        'WORKFLOW', 'PERSONALIZATION'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE experiment_status AS ENUM (
        'DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================
-- SECTION 2: FUNCTIONS
-- =============================================================
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN 'lynkk_' || encode(gen_random_bytes(20), 'hex');
END;
$$;

-- =============================================================
-- SECTION 3: CORE TABLES
-- =============================================================

-- 3a. customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    product_name TEXT,
    api_key TEXT UNIQUE NOT NULL DEFAULT public.generate_api_key(),
    whatsapp_number TEXT,
    slack_webhook_url TEXT,
    resend_api_key TEXT,
    dialog360_api_key TEXT,
    from_email TEXT,
    whatsapp_config JSONB DEFAULT '{}'::jsonb,
    twilio_config JSONB,
    sms_config JSONB,
    push_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3b. tracked_users
CREATE TABLE IF NOT EXISTS public.tracked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    phone_number TEXT,
    mobile TEXT,
    source TEXT DEFAULT 'api',
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_action TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'at_risk', 'cold')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3c. events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB,
    revenue_value NUMERIC,
    currency TEXT DEFAULT 'USD',
    is_revenue_event BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3d. workflows
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
    template_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3e. workflow_logs
CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    action_taken TEXT NOT NULL DEFAULT 'email_sent',
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- SECTION 4: MESSAGING TABLES
-- =============================================================

-- 4a. sms_templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    body TEXT,
    content TEXT,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4b. user_messages
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    tracked_user_id UUID REFERENCES tracked_users(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    message_type TEXT NOT NULL DEFAULT 'outbound',
    template_id TEXT,
    content TEXT,
    recipient_phone TEXT,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending',
    external_message_id TEXT,
    twilio_sid TEXT,
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    attributed_revenue NUMERIC,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4c. push_tokens
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

-- 4d. push_templates
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

-- =============================================================
-- SECTION 5: PERSONALIZATION TABLES
-- =============================================================

-- 5a. personalization_campaigns
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
    variants JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE
);

-- 5b. personalization_events
CREATE TABLE IF NOT EXISTS public.personalization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES personalization_campaigns(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'IMPRESSION',
    url TEXT,
    variant_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- SECTION 6: ANALYTICS TABLES
-- =============================================================

-- 6a. funnels
CREATE TABLE IF NOT EXISTS public.funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    conversion_window_hours INTEGER NOT NULL DEFAULT 168,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6b. import_logs
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

-- =============================================================
-- SECTION 7: CATALOG & RECOMMENDATIONS
-- =============================================================

-- 7a. catalog_items
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

-- 7b. recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    strategy TEXT NOT NULL,
    item_ids UUID[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 7c. recommendation_events
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

-- =============================================================
-- SECTION 8: EXPERIMENTS (A/B TESTING)
-- =============================================================

-- 8a. experiments
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

-- 8b. experiment_assignments
CREATE TABLE IF NOT EXISTS public.experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================
-- SECTION 9: UNIQUE CONSTRAINTS
-- =============================================================

DO $$ BEGIN
    ALTER TABLE public.tracked_users ADD CONSTRAINT tracked_users_customer_email_unique UNIQUE (customer_id, email);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_customer_external_unique UNIQUE (customer_id, external_id);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_user_strategy_unique UNIQUE (customer_id, tracked_user_id, strategy);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.experiment_assignments ADD CONSTRAINT experiment_assignments_unique UNIQUE (experiment_id, tracked_user_id);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

-- =============================================================
-- SECTION 10: CHECK CONSTRAINTS
-- =============================================================

-- tracked_users
ALTER TABLE public.tracked_users DROP CONSTRAINT IF EXISTS tracked_users_status_check;
ALTER TABLE public.tracked_users ADD CONSTRAINT tracked_users_status_check CHECK (status IN ('active', 'at_risk', 'cold'));

ALTER TABLE public.tracked_users DROP CONSTRAINT IF EXISTS tracked_users_source_check;
ALTER TABLE public.tracked_users ADD CONSTRAINT tracked_users_source_check CHECK (source IN ('js_snippet', 'csv_import', 'api'));

-- workflows
ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_type_check;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_type_check CHECK (type IN ('trial_recovery', 'onboarding_activation', 'silent_churn', 'custom'));

ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_status_check;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'paused'));

-- workflow_logs
ALTER TABLE public.workflow_logs DROP CONSTRAINT IF EXISTS workflow_logs_action_taken_check;
ALTER TABLE public.workflow_logs ADD CONSTRAINT workflow_logs_action_taken_check CHECK (action_taken IN ('whatsapp_sent', 'email_sent', 'slack_notified', 'sms_sent', 'push_sent'));

ALTER TABLE public.workflow_logs DROP CONSTRAINT IF EXISTS workflow_logs_status_check;
ALTER TABLE public.workflow_logs ADD CONSTRAINT workflow_logs_status_check CHECK (status IN ('success', 'failed'));

-- user_messages
ALTER TABLE public.user_messages DROP CONSTRAINT IF EXISTS user_messages_channel_check;
ALTER TABLE public.user_messages ADD CONSTRAINT user_messages_channel_check CHECK (channel IN ('whatsapp', 'email', 'slack', 'sms', 'push'));

ALTER TABLE public.user_messages DROP CONSTRAINT IF EXISTS user_messages_status_check;
ALTER TABLE public.user_messages ADD CONSTRAINT user_messages_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read'));

-- push_tokens
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_platform_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('WEB', 'IOS', 'ANDROID'));

-- personalization_campaigns
ALTER TABLE public.personalization_campaigns DROP CONSTRAINT IF EXISTS personalization_campaigns_type_check;
ALTER TABLE public.personalization_campaigns ADD CONSTRAINT personalization_campaigns_type_check CHECK (type IN ('BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS'));

ALTER TABLE public.personalization_campaigns DROP CONSTRAINT IF EXISTS personalization_campaigns_status_check;
ALTER TABLE public.personalization_campaigns ADD CONSTRAINT personalization_campaigns_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'));

-- personalization_events
ALTER TABLE public.personalization_events DROP CONSTRAINT IF EXISTS personalization_events_event_type_check;
ALTER TABLE public.personalization_events ADD CONSTRAINT personalization_events_event_type_check CHECK (event_type IN ('IMPRESSION', 'CLICK', 'DISMISSED'));

-- experiments
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_type_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_type_check CHECK (type IN ('WORKFLOW', 'PERSONALIZATION'));

ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_status_check CHECK (status IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'));

-- import_logs
ALTER TABLE public.import_logs DROP CONSTRAINT IF EXISTS import_logs_status_check;
ALTER TABLE public.import_logs ADD CONSTRAINT import_logs_status_check CHECK (status IN ('processing', 'complete', 'failed'));

-- =============================================================
-- SECTION 11: INDEXES
-- =============================================================

-- tracked_users
CREATE INDEX IF NOT EXISTS idx_tracked_users_customer_id ON tracked_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_tracked_users_email ON tracked_users(email);
CREATE INDEX IF NOT EXISTS idx_tracked_users_status ON tracked_users(status);

-- events
CREATE INDEX IF NOT EXISTS idx_events_customer_id ON events(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_tracked_user_email ON events(tracked_user_email);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_is_revenue_event ON events(is_revenue_event) WHERE is_revenue_event = true;

-- workflows
CREATE INDEX IF NOT EXISTS idx_workflows_customer_id ON workflows(customer_id);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(type);

-- workflow_logs
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow_id ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_fired_at ON workflow_logs(fired_at);

-- sms_templates
CREATE INDEX IF NOT EXISTS idx_sms_templates_customer_id ON sms_templates(customer_id);

-- user_messages
CREATE INDEX IF NOT EXISTS idx_user_messages_customer_id ON user_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_tracked_user_email ON user_messages(tracked_user_email);
CREATE INDEX IF NOT EXISTS idx_user_messages_status ON user_messages(status);
CREATE INDEX IF NOT EXISTS idx_user_messages_twilio_sid ON user_messages(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_user_messages_workflow_id ON user_messages(workflow_id);

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_customer_id ON push_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tracked_user_id ON push_tokens(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active) WHERE active = true;

-- push_templates
CREATE INDEX IF NOT EXISTS idx_push_templates_customer_id ON push_templates(customer_id);

-- personalization_campaigns
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_customer_id ON personalization_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_status ON personalization_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_type ON personalization_campaigns(type);

-- personalization_events
CREATE INDEX IF NOT EXISTS idx_personalization_events_campaign_id ON personalization_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_personalization_events_tracked_user_id ON personalization_events(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_personalization_events_created_at ON personalization_events(created_at);
CREATE INDEX IF NOT EXISTS idx_personalization_events_variant ON personalization_events(variant_id);

-- funnels
CREATE INDEX IF NOT EXISTS idx_funnels_customer_id ON funnels(customer_id);

-- import_logs
CREATE INDEX IF NOT EXISTS idx_import_logs_customer_id ON import_logs(customer_id);

-- catalog_items
CREATE INDEX IF NOT EXISTS idx_catalog_items_customer_id ON catalog_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(active) WHERE active = true;

-- recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(tracked_user_id, strategy);
-- Removed: NOW() in partial index predicate requires IMMUTABLE

-- recommendation_events
CREATE INDEX IF NOT EXISTS idx_recommendation_events_customer ON recommendation_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user ON recommendation_events(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_item ON recommendation_events(item_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_type ON recommendation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_created ON recommendation_events(created_at);

-- experiments
CREATE INDEX IF NOT EXISTS idx_experiments_customer_id ON experiments(customer_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_source_id ON experiments(source_id);

-- experiment_assignments
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_variant ON experiment_assignments(variant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_converted ON experiment_assignments(converted) WHERE converted = true;

-- =============================================================
-- SECTION 12: ROW LEVEL SECURITY
-- =============================================================

-- Enable RLS on all tables
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

-- =============================================================
-- SECTION 13: RLS POLICIES
-- =============================================================

-- Helper: Drop then create policy
DO $$ BEGIN
    -- customers
    DROP POLICY IF EXISTS "Customers can read their own data" ON public.customers;
    DROP POLICY IF EXISTS "Customers can update their own data" ON public.customers;
    DROP POLICY IF EXISTS "Customers can insert their own data" ON public.customers;
    DROP POLICY IF EXISTS "Customers can delete their own data" ON public.customers;
END $$;

CREATE POLICY "Customers can read their own data" ON public.customers
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Customers can insert their own data" ON public.customers
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Customers can update their own data" ON public.customers
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Customers can delete their own data" ON public.customers
    FOR DELETE USING (auth.uid() = id);

-- tracked_users
DROP POLICY IF EXISTS "Customers can read their tracked users" ON public.tracked_users;
DROP POLICY IF EXISTS "Customers can insert their tracked users" ON public.tracked_users;
DROP POLICY IF EXISTS "Customers can update their tracked users" ON public.tracked_users;
DROP POLICY IF EXISTS "Customers can delete their tracked users" ON public.tracked_users;

CREATE POLICY "Customers can read their tracked users" ON public.tracked_users
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their tracked users" ON public.tracked_users
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their tracked users" ON public.tracked_users
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their tracked users" ON public.tracked_users
    FOR DELETE USING (customer_id = auth.uid());

-- events
DROP POLICY IF EXISTS "Customers can read their events" ON public.events;
DROP POLICY IF EXISTS "Customers can insert their events" ON public.events;
DROP POLICY IF EXISTS "Customers can update their events" ON public.events;
DROP POLICY IF EXISTS "Customers can delete their events" ON public.events;

CREATE POLICY "Customers can read their events" ON public.events
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their events" ON public.events
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their events" ON public.events
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their events" ON public.events
    FOR DELETE USING (customer_id = auth.uid());

-- workflows
DROP POLICY IF EXISTS "Customers can read their workflows" ON public.workflows;
DROP POLICY IF EXISTS "Customers can insert their workflows" ON public.workflows;
DROP POLICY IF EXISTS "Customers can update their workflows" ON public.workflows;
DROP POLICY IF EXISTS "Customers can delete their workflows" ON public.workflows;

CREATE POLICY "Customers can read their workflows" ON public.workflows
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their workflows" ON public.workflows
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their workflows" ON public.workflows
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their workflows" ON public.workflows
    FOR DELETE USING (customer_id = auth.uid());

-- workflow_logs
DROP POLICY IF EXISTS "Customers can read their workflow logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Customers can insert their workflow logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Customers can update their workflow logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Customers can delete their workflow logs" ON public.workflow_logs;

CREATE POLICY "Customers can read their workflow logs" ON public.workflow_logs
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their workflow logs" ON public.workflow_logs
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their workflow logs" ON public.workflow_logs
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their workflow logs" ON public.workflow_logs
    FOR DELETE USING (customer_id = auth.uid());

-- sms_templates
DROP POLICY IF EXISTS "Customers can read their SMS templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Customers can insert their SMS templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Customers can update their SMS templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Customers can delete their SMS templates" ON public.sms_templates;

CREATE POLICY "Customers can read their SMS templates" ON public.sms_templates
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their SMS templates" ON public.sms_templates
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their SMS templates" ON public.sms_templates
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their SMS templates" ON public.sms_templates
    FOR DELETE USING (customer_id = auth.uid());

-- user_messages
DROP POLICY IF EXISTS "Customers can read their user messages" ON public.user_messages;
DROP POLICY IF EXISTS "Customers can insert their user messages" ON public.user_messages;
DROP POLICY IF EXISTS "Customers can update their user messages" ON public.user_messages;

CREATE POLICY "Customers can read their user messages" ON public.user_messages
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their user messages" ON public.user_messages
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their user messages" ON public.user_messages
    FOR UPDATE USING (customer_id = auth.uid());

-- push_tokens
DROP POLICY IF EXISTS "Customers can read their push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Customers can insert their push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Customers can update their push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Customers can delete their push tokens" ON public.push_tokens;

CREATE POLICY "Customers can read their push tokens" ON public.push_tokens
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their push tokens" ON public.push_tokens
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their push tokens" ON public.push_tokens
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their push tokens" ON public.push_tokens
    FOR DELETE USING (customer_id = auth.uid());

-- push_templates
DROP POLICY IF EXISTS "Customers can read their push templates" ON public.push_templates;
DROP POLICY IF EXISTS "Customers can insert their push templates" ON public.push_templates;
DROP POLICY IF EXISTS "Customers can update their push templates" ON public.push_templates;
DROP POLICY IF EXISTS "Customers can delete their push templates" ON public.push_templates;

CREATE POLICY "Customers can read their push templates" ON public.push_templates
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their push templates" ON public.push_templates
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their push templates" ON public.push_templates
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their push templates" ON public.push_templates
    FOR DELETE USING (customer_id = auth.uid());

-- personalization_campaigns
DROP POLICY IF EXISTS "Customers can read their personalization campaigns" ON public.personalization_campaigns;
DROP POLICY IF EXISTS "Customers can insert their personalization campaigns" ON public.personalization_campaigns;
DROP POLICY IF EXISTS "Customers can update their personalization campaigns" ON public.personalization_campaigns;
DROP POLICY IF EXISTS "Customers can delete their personalization campaigns" ON public.personalization_campaigns;

CREATE POLICY "Customers can read their personalization campaigns" ON public.personalization_campaigns
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their personalization campaigns" ON public.personalization_campaigns
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their personalization campaigns" ON public.personalization_campaigns
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their personalization campaigns" ON public.personalization_campaigns
    FOR DELETE USING (customer_id = auth.uid());

-- personalization_events
DROP POLICY IF EXISTS "Customers can read their personalization events" ON public.personalization_events;
DROP POLICY IF EXISTS "Customers can insert their personalization events" ON public.personalization_events;

CREATE POLICY "Customers can read their personalization events" ON public.personalization_events
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their personalization events" ON public.personalization_events
    FOR INSERT WITH CHECK (customer_id = auth.uid());

-- funnels
DROP POLICY IF EXISTS "Customers can read their funnels" ON public.funnels;
DROP POLICY IF EXISTS "Customers can insert their funnels" ON public.funnels;
DROP POLICY IF EXISTS "Customers can update their funnels" ON public.funnels;
DROP POLICY IF EXISTS "Customers can delete their funnels" ON public.funnels;

CREATE POLICY "Customers can read their funnels" ON public.funnels
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their funnels" ON public.funnels
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their funnels" ON public.funnels
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their funnels" ON public.funnels
    FOR DELETE USING (customer_id = auth.uid());

-- import_logs
DROP POLICY IF EXISTS "customer_access" ON public.import_logs;
CREATE POLICY "customer_access" ON public.import_logs
    FOR ALL USING (customer_id = auth.uid());

-- catalog_items
DROP POLICY IF EXISTS "Customers can read their catalog" ON public.catalog_items;
DROP POLICY IF EXISTS "Customers can insert their catalog" ON public.catalog_items;
DROP POLICY IF EXISTS "Customers can update their catalog" ON public.catalog_items;
DROP POLICY IF EXISTS "Customers can delete their catalog" ON public.catalog_items;

CREATE POLICY "Customers can read their catalog" ON public.catalog_items
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their catalog" ON public.catalog_items
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their catalog" ON public.catalog_items
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their catalog" ON public.catalog_items
    FOR DELETE USING (customer_id = auth.uid());

-- recommendations
DROP POLICY IF EXISTS "Customers can read recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Customers can insert recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Customers can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Customers can delete recommendations" ON public.recommendations;

CREATE POLICY "Customers can read recommendations" ON public.recommendations
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert recommendations" ON public.recommendations
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update recommendations" ON public.recommendations
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete recommendations" ON public.recommendations
    FOR DELETE USING (customer_id = auth.uid());

-- recommendation_events
DROP POLICY IF EXISTS "Customers can read recommendation events" ON public.recommendation_events;
DROP POLICY IF EXISTS "Customers can insert recommendation events" ON public.recommendation_events;

CREATE POLICY "Customers can read recommendation events" ON public.recommendation_events
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert recommendation events" ON public.recommendation_events
    FOR INSERT WITH CHECK (customer_id = auth.uid());

-- experiments
DROP POLICY IF EXISTS "Customers can read experiments" ON public.experiments;
DROP POLICY IF EXISTS "Customers can insert experiments" ON public.experiments;
DROP POLICY IF EXISTS "Customers can update experiments" ON public.experiments;
DROP POLICY IF EXISTS "Customers can delete experiments" ON public.experiments;

CREATE POLICY "Customers can read experiments" ON public.experiments
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert experiments" ON public.experiments
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update experiments" ON public.experiments
    FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete experiments" ON public.experiments
    FOR DELETE USING (customer_id = auth.uid());

-- experiment_assignments
DROP POLICY IF EXISTS "Customers can read experiment assignments" ON public.experiment_assignments;
DROP POLICY IF EXISTS "Customers can insert experiment assignments" ON public.experiment_assignments;
DROP POLICY IF EXISTS "Customers can update experiment assignments" ON public.experiment_assignments;

CREATE POLICY "Customers can read experiment assignments" ON public.experiment_assignments
    FOR SELECT USING (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));

CREATE POLICY "Customers can insert experiment assignments" ON public.experiment_assignments
    FOR INSERT WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));

CREATE POLICY "Customers can update experiment assignments" ON public.experiment_assignments
    FOR UPDATE USING (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));

-- =============================================================
-- SECTION 14: REFRESH POSTGREST SCHEMA CACHE
-- =============================================================
NOTIFY pgrst, 'reload schema';
