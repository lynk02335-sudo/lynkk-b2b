-- Migration: 009_personalization
-- Created: 2026-05-20
-- Adds on-site personalization campaign support

-- =====================================================
-- PERSONALIZATION CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.personalization_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BANNER', 'MODAL', 'TOOLTIP', 'INLINE')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
    targeting_rules JSONB DEFAULT '{"operator": "AND", "conditions": []}',
    content JSONB DEFAULT '{}',
    display_rules JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_customer_id ON personalization_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_status ON personalization_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_personalization_campaigns_type ON personalization_campaigns(type);

-- RLS
ALTER TABLE public.personalization_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their personalization campaigns" ON public.personalization_campaigns;
CREATE POLICY "Customers can read their personalization campaigns"
    ON public.personalization_campaigns FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their personalization campaigns" ON public.personalization_campaigns;
CREATE POLICY "Customers can insert their personalization campaigns"
    ON public.personalization_campaigns FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their personalization campaigns" ON public.personalization_campaigns;
CREATE POLICY "Customers can update their personalization campaigns"
    ON public.personalization_campaigns FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their personalization campaigns" ON public.personalization_campaigns;
CREATE POLICY "Customers can delete their personalization campaigns"
    ON public.personalization_campaigns FOR DELETE
    USING (customer_id = auth.uid());

-- =====================================================
-- PERSONALIZATION EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.personalization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES personalization_campaigns(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('IMPRESSION', 'CLICK', 'DISMISSED')),
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_personalization_events_campaign_id ON personalization_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_personalization_events_tracked_user_id ON personalization_events(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_personalization_events_created_at ON personalization_events(created_at);

-- RLS
ALTER TABLE public.personalization_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their personalization events" ON public.personalization_events;
CREATE POLICY "Customers can read their personalization events"
    ON public.personalization_events FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their personalization events" ON public.personalization_events;
CREATE POLICY "Customers can insert their personalization events"
    ON public.personalization_events FOR INSERT
    WITH CHECK (customer_id = auth.uid());