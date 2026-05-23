-- Migration: 011_csv_import_export
-- Created: 2026-05-21
-- Adds CSV import/export support for tracked_users

ALTER TABLE public.tracked_users
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('js_snippet', 'csv_import', 'api')) DEFAULT 'api';

CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    imported INT NOT NULL DEFAULT 0,
    updated INT NOT NULL DEFAULT 0,
    skipped INT NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    status TEXT CHECK (status IN ('processing', 'complete', 'failed')) DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_logs_customer_id ON import_logs(customer_id);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_access" ON public.import_logs;
CREATE POLICY "customer_access"
    ON public.import_logs FOR ALL
    USING (customer_id = auth.uid());
