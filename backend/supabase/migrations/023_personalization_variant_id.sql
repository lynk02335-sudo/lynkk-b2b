-- Migration: 023_personalization_variant_id
-- Created: 2026-05-21
-- Adds variant_id tracking to personalization campaigns for A/B testing

ALTER TABLE public.personalization_events
ADD COLUMN IF NOT EXISTS variant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_personalization_events_variant ON personalization_events(variant_id);
