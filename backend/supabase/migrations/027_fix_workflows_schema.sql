-- Migration: 027_fix_workflows_schema
-- Created: 2026-05-22
-- Fixes "Could not find the 'name' column of 'workflows' in the schema cache"
-- Adds all missing columns from the original workflows table definition

DO $$
BEGIN
  -- name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'name') THEN
    ALTER TABLE public.workflows ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;

  -- type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'type') THEN
    ALTER TABLE public.workflows ADD COLUMN type TEXT NOT NULL DEFAULT 'custom';
    ALTER TABLE public.workflows ADD CONSTRAINT workflows_type_check CHECK (type IN ('trial_recovery', 'onboarding_activation', 'silent_churn', 'custom'));
  END IF;

  -- is_active
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'is_active') THEN
    ALTER TABLE public.workflows ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
  END IF;

  -- status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'status') THEN
    ALTER TABLE public.workflows ADD COLUMN status TEXT DEFAULT 'draft';
    ALTER TABLE public.workflows ADD CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'paused'));
  END IF;

  -- inactive_days_trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'inactive_days_trigger') THEN
    ALTER TABLE public.workflows ADD COLUMN inactive_days_trigger INTEGER DEFAULT 5;
  END IF;

  -- whatsapp_message
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'whatsapp_message') THEN
    ALTER TABLE public.workflows ADD COLUMN whatsapp_message TEXT;
  END IF;

  -- config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'config') THEN
    ALTER TABLE public.workflows ADD COLUMN config JSONB;
  END IF;

  -- trigger_config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'trigger_config') THEN
    ALTER TABLE public.workflows ADD COLUMN trigger_config JSONB;
  END IF;

  -- steps
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'steps') THEN
    ALTER TABLE public.workflows ADD COLUMN steps JSONB;
  END IF;

  -- updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'updated_at') THEN
    ALTER TABLE public.workflows ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Drop broken index if it exists from the bad migration
DROP INDEX IF EXISTS idx_workflows_template_id;

-- Create correct index on type (safe now that we ensured the column exists)
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(type);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
