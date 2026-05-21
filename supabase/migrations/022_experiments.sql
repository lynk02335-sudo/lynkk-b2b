-- Migration: 022_experiments
-- Created: 2026-05-21
-- A/B testing experiments and assignments

DO $$ BEGIN
    CREATE TYPE experiment_type AS ENUM ('WORKFLOW', 'PERSONALIZATION');
    CREATE TYPE experiment_status AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type experiment_type NOT NULL,
    source_id UUID NOT NULL,
    status experiment_status NOT NULL DEFAULT 'DRAFT',
    variants JSONB NOT NULL DEFAULT '[]',
    traffic_split JSONB NOT NULL DEFAULT '{}',
    goal_event TEXT NOT NULL,
    winner_variant_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_customer_id ON experiments(customer_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_source_id ON experiments(source_id);

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    tracked_user_id UUID NOT NULL REFERENCES tracked_users(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(experiment_id, tracked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_variant ON experiment_assignments(variant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_converted ON experiment_assignments(converted) WHERE converted = true;

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read experiments" ON public.experiments;
CREATE POLICY "Customers can read experiments"
    ON public.experiments FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert experiments" ON public.experiments;
CREATE POLICY "Customers can insert experiments"
    ON public.experiments FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update experiments" ON public.experiments;
CREATE POLICY "Customers can update experiments"
    ON public.experiments FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete experiments" ON public.experiments;
CREATE POLICY "Customers can delete experiments"
    ON public.experiments FOR DELETE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can read experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can read experiment assignments"
    ON public.experiment_assignments FOR SELECT
    USING (customer_id IN (SELECT customer_id FROM experiments WHERE id = experiment_id));

DROP POLICY IF EXISTS "Customers can insert experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can insert experiment assignments"
    ON public.experiment_assignments FOR INSERT
    WITH CHECK (customer_id IN (SELECT customer_id FROM experiments WHERE id = experiment_id));

DROP POLICY IF EXISTS "Customers can update experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can update experiment assignments"
    ON public.experiment_assignments FOR UPDATE
    USING (customer_id IN (SELECT customer_id FROM experiments WHERE id = experiment_id));
