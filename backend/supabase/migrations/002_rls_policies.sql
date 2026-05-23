-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Customers RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their own data"
    ON public.customers FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Customers can update their own data"
    ON public.customers FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Customers can insert their own data"
    ON public.customers FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Customers can delete their own data"
    ON public.customers FOR DELETE
    USING (auth.uid() = id);

-- Tracked Users RLS
ALTER TABLE public.tracked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their tracked users"
    ON public.tracked_users FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their tracked users"
    ON public.tracked_users FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their tracked users"
    ON public.tracked_users FOR UPDATE
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their tracked users"
    ON public.tracked_users FOR DELETE
    USING (customer_id = auth.uid());

-- Events RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their events"
    ON public.events FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their events"
    ON public.events FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their events"
    ON public.events FOR UPDATE
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their events"
    ON public.events FOR DELETE
    USING (customer_id = auth.uid());

-- Workflows RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their workflows"
    ON public.workflows FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their workflows"
    ON public.workflows FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their workflows"
    ON public.workflows FOR UPDATE
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their workflows"
    ON public.workflows FOR DELETE
    USING (customer_id = auth.uid());

-- Workflow Logs RLS
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their workflow logs"
    ON public.workflow_logs FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their workflow logs"
    ON public.workflow_logs FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their workflow logs"
    ON public.workflow_logs FOR UPDATE
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can delete their workflow logs"
    ON public.workflow_logs FOR DELETE
    USING (customer_id = auth.uid());