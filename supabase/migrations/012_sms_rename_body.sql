-- Migration: 007_sms_rename_body
-- Created: 2026-05-20
-- Renames sms_templates.content to body for clarity

-- Add body column if content exists
ALTER TABLE public.sms_templates
ADD COLUMN IF NOT EXISTS body TEXT;

-- Copy content to body
UPDATE public.sms_templates
SET body = content
WHERE body IS NULL AND content IS NOT NULL;

-- Remove NOT NULL constraint from content to allow dropping it later
ALTER TABLE public.sms_templates
ALTER COLUMN content DROP NOT NULL;