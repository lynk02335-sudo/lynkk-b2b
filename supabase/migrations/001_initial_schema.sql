-- Migration: 001_initial_schema
-- Created: 2026-05-12

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    product_name TEXT,
    api_key TEXT UNIQUE NOT NULL,
    whatsapp_number TEXT,
    slack_webhook_url TEXT,
    resend_api_key TEXT,
    dialog360_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TRACKED_USERS TABLE
-- =====================================================
CREATE TABLE public.tracked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_action TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'at_risk', 'cold')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EVENTS TABLE
-- =====================================================
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- WORKFLOWS TABLE
-- =====================================================
CREATE TABLE public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('trial_recovery', 'onboarding_activation', 'silent_churn', 'custom')),
    is_active BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
    inactive_days_trigger INTEGER DEFAULT 5,
    whatsapp_message TEXT,
    config JSONB,
    trigger_config JSONB,
    steps JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- WORKFLOW_LOGS TABLE
-- =====================================================
CREATE TABLE public.workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    action_taken TEXT NOT NULL CHECK (action_taken IN ('whatsapp_sent', 'email_sent', 'slack_notified')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_tracked_users_customer_id ON tracked_users(customer_id);
CREATE INDEX idx_tracked_users_email ON tracked_users(email);
CREATE INDEX idx_tracked_users_status ON tracked_users(status);
CREATE INDEX idx_events_customer_id ON events(customer_id);
CREATE INDEX idx_events_tracked_user_email ON events(tracked_user_email);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_workflows_customer_id ON workflows(customer_id);
CREATE INDEX idx_workflows_template_id ON workflows(template_id);
CREATE INDEX idx_workflow_logs_workflow_id ON workflow_logs(workflow_id);
CREATE INDEX idx_workflow_logs_fired_at ON workflow_logs(fired_at);

-- =====================================================
-- ROW LEVEL SECURITY
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

-- =====================================================
-- API KEY GENERATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    return 'lynkk_' || encode(gen_random_bytes(20), 'hex');
END;
$$;

-- Set default value for api_key column
ALTER TABLE public.customers
ALTER COLUMN api_key SET DEFAULT public.generate_api_key();

-- Add unique constraint on api_key if not already enforced by column definition