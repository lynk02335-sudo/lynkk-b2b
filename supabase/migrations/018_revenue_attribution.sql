-- Migration: 018_revenue_attribution
-- Created: 2026-05-21
-- Adds columns to user_messages for revenue attribution

ALTER TABLE public.user_messages
ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;

ALTER TABLE public.user_messages
ADD COLUMN IF NOT EXISTS tracked_user_id UUID REFERENCES tracked_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_messages_workflow_id ON user_messages(workflow_id);
