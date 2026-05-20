-- Migration: 006_sms_only
-- Created: 2026-05-20
-- Adds SMS support via Twilio (incremental, safe to run)

-- =====================================================
-- ADD SMS CONFIG TO CUSTOMERS TABLE
-- =====================================================
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS sms_config JSONB;

-- =====================================================
-- SMS TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sms_templates_customer_id ON sms_templates(customer_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their SMS templates" ON public.sms_templates;
CREATE POLICY "Customers can read their SMS templates"
    ON public.sms_templates FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their SMS templates" ON public.sms_templates;
CREATE POLICY "Customers can insert their SMS templates"
    ON public.sms_templates FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their SMS templates" ON public.sms_templates;
CREATE POLICY "Customers can update their SMS templates"
    ON public.sms_templates FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their SMS templates" ON public.sms_templates;
CREATE POLICY "Customers can delete their SMS templates"
    ON public.sms_templates FOR DELETE
    USING (customer_id = auth.uid());

-- =====================================================
-- USER_MESSAGES TABLE (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tracked_user_email TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'slack', 'sms')),
    message_type TEXT NOT NULL,
    template_id TEXT,
    content TEXT,
    recipient_phone TEXT,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    external_message_id TEXT,
    twilio_sid TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_customer_id ON user_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_tracked_user_email ON user_messages(tracked_user_email);
CREATE INDEX IF NOT EXISTS idx_user_messages_status ON user_messages(status);
CREATE INDEX IF NOT EXISTS idx_user_messages_twilio_sid ON user_messages(twilio_sid);

ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their user messages" ON public.user_messages;
CREATE POLICY "Customers can read their user messages"
    ON public.user_messages FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their user messages" ON public.user_messages;
CREATE POLICY "Customers can insert their user messages"
    ON public.user_messages FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their user messages" ON public.user_messages;
CREATE POLICY "Customers can update their user messages"
    ON public.user_messages FOR UPDATE
    USING (customer_id = auth.uid());

-- =====================================================
-- UPDATE WORKFLOW_LOGS TO INCLUDE SMS
-- =====================================================
ALTER TABLE public.workflow_logs
DROP CONSTRAINT IF EXISTS workflow_logs_action_taken_check;

ALTER TABLE public.workflow_logs
ADD CONSTRAINT workflow_logs_action_taken_check 
CHECK (action_taken IN ('whatsapp_sent', 'email_sent', 'slack_notified', 'sms_sent'));