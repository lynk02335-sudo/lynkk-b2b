-- Migration: 028_fix_workflows_template_id_nullable
-- Created: 2026-05-22
-- Fixes "null value in column 'template_id' of relation 'workflows' violates not-null constraint"
-- The template_id column was added manually (not in any migration) and set NOT NULL,
-- but no frontend/backend code ever writes to it. Making it nullable so inserts succeed.

ALTER TABLE public.workflows ALTER COLUMN template_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
