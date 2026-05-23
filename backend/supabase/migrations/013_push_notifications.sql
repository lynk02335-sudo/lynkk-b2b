-- Migration: 008_push_notifications
-- Created: 2026-05-20
-- Adds push notification support via Firebase Cloud Messaging

-- =====================================================
-- ADD PUSH CONFIG TO CUSTOMERS
-- =====================================================
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS push_config JSONB;

-- =====================================================
-- PUSH TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('WEB', 'IOS', 'ANDROID')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_push_tokens_customer_id ON push_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tracked_user_id ON push_tokens(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active) WHERE active = true;

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their push tokens" ON public.push_tokens;
CREATE POLICY "Customers can read their push tokens"
    ON public.push_tokens FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their push tokens" ON public.push_tokens;
CREATE POLICY "Customers can insert their push tokens"
    ON public.push_tokens FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their push tokens" ON public.push_tokens;
CREATE POLICY "Customers can update their push tokens"
    ON public.push_tokens FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their push tokens" ON public.push_tokens;
CREATE POLICY "Customers can delete their push tokens"
    ON public.push_tokens FOR DELETE
    USING (customer_id = auth.uid());

-- =====================================================
-- PUSH TEMPLATES TABLE
-- =====================================================
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_push_templates_customer_id ON push_templates(customer_id);

-- RLS
ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their push templates" ON public.push_templates;
CREATE POLICY "Customers can read their push templates"
    ON public.push_templates FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their push templates" ON public.push_templates;
CREATE POLICY "Customers can insert their push templates"
    ON public.push_templates FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their push templates" ON public.push_templates;
CREATE POLICY "Customers can update their push templates"
    ON public.push_templates FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their push templates" ON public.push_templates;
CREATE POLICY "Customers can delete their push templates"
    ON public.push_templates FOR DELETE
    USING (customer_id = auth.uid());