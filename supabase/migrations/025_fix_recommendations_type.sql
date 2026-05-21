-- Migration: 025_fix_recommendations_type
-- Created: 2026-05-21
-- Adds RECOMMENDATIONS to the personalization_campaigns type check constraint

ALTER TABLE public.personalization_campaigns
DROP CONSTRAINT IF EXISTS personalization_campaigns_type_check;

ALTER TABLE public.personalization_campaigns
ADD CONSTRAINT personalization_campaigns_type_check
CHECK (type IN ('BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS'));
