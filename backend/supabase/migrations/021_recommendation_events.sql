-- Migration: 021_recommendation_events
-- Created: 2026-05-21
-- Tracks recommendation delivery and engagement events

DO $$ BEGIN
    CREATE TYPE recommendation_event_type AS ENUM (
        'SHOWN',
        'CLICKED',
        'PURCHASED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.recommendation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_id UUID REFERENCES tracked_users(id) ON DELETE SET NULL,
    strategy recommendation_strategy,
    item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    event_type recommendation_event_type NOT NULL,
    page_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_customer ON recommendation_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user ON recommendation_events(tracked_user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_item ON recommendation_events(item_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_type ON recommendation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_created ON recommendation_events(created_at);

ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read recommendation events" ON public.recommendation_events;
CREATE POLICY "Customers can read recommendation events"
    ON public.recommendation_events FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert recommendation events" ON public.recommendation_events;
CREATE POLICY "Customers can insert recommendation events"
    ON public.recommendation_events FOR INSERT
    WITH CHECK (customer_id = auth.uid());
