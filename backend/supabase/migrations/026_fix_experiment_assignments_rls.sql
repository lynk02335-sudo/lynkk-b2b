-- Migration: 026_fix_experiment_assignments_rls
-- Created: 2026-05-22
-- Fix RLS policies on experiment_assignments that referenced non-existent customer_id column

DROP POLICY IF EXISTS "Customers can read experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can read experiment assignments"
    ON public.experiment_assignments FOR SELECT
    USING (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can insert experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can insert experiment assignments"
    ON public.experiment_assignments FOR INSERT
    WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can update experiment assignments" ON public.experiment_assignments;
CREATE POLICY "Customers can update experiment assignments"
    ON public.experiment_assignments FOR UPDATE
    USING (experiment_id IN (SELECT id FROM experiments WHERE customer_id = auth.uid()));
