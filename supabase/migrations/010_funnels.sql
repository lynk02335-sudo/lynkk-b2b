-- Migration: 010_funnels
-- Created: 2026-05-20
-- Adds conversion funnel support

CREATE TABLE IF NOT EXISTS public.funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    conversion_window_hours INTEGER NOT NULL DEFAULT 168,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnels_customer_id ON funnels(customer_id);

ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their funnels" ON public.funnels;
CREATE POLICY "Customers can read their funnels"
    ON public.funnels FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their funnels" ON public.funnels;
CREATE POLICY "Customers can insert their funnels"
    ON public.funnels FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their funnels" ON public.funnels;
CREATE POLICY "Customers can update their funnels"
    ON public.funnels FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their funnels" ON public.funnels;
CREATE POLICY "Customers can delete their funnels"
    ON public.funnels FOR DELETE
    USING (customer_id = auth.uid());

-- Extend events table with revenue columns
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS revenue_value NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_revenue_event BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_is_revenue_event ON events(is_revenue_event) WHERE is_revenue_event = true;

-- Add attributed_revenue to user_messages
ALTER TABLE public.user_messages ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC;
