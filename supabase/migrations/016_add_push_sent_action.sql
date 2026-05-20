-- Migration: 016_add_push_sent_action
-- Extends workflow_logs.action_taken to include push_sent

ALTER TABLE public.workflow_logs
DROP CONSTRAINT IF EXISTS workflow_logs_action_taken_check;

ALTER TABLE public.workflow_logs
ADD CONSTRAINT workflow_logs_action_taken_check
CHECK (action_taken IN ('whatsapp_sent', 'email_sent', 'slack_notified', 'sms_sent', 'push_sent'));
