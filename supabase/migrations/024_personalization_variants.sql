-- Migration: 024_personalization_variants
-- Created: 2026-05-21
-- Adds variants JSONB column to personalization_campaigns for A/B testing

ALTER TABLE public.personalization_campaigns
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT NULL;
