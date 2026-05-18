export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          email: string
          product_name: string | null
          api_key: string
          whatsapp_number: string | null
          slack_webhook_url: string | null
          resend_api_key: string | null
          from_email: string | null
          dialog360_api_key: string | null
          whatsapp_config: any | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          product_name?: string | null
          api_key: string
          whatsapp_number?: string | null
          slack_webhook_url?: string | null
          resend_api_key?: string | null
          from_email?: string | null
          dialog360_api_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          product_name?: string | null
          api_key?: string
          whatsapp_number?: string | null
          slack_webhook_url?: string | null
          resend_api_key?: string | null
          from_email?: string | null
          dialog360_api_key?: string | null
          created_at?: string
        }
      }
      tracked_users: {
        Row: {
          id: string
          customer_id: string
          email: string
          name: string | null
          first_seen: string
          last_seen: string
          last_action: string | null
          status: 'active' | 'at_risk' | 'cold'
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          email: string
          name?: string | null
          first_seen: string
          last_seen: string
          last_action?: string | null
          status: 'active' | 'at_risk' | 'cold'
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          email?: string
          name?: string | null
          first_seen?: string
          last_seen?: string
          last_action?: string | null
          status?: 'active' | 'at_risk' | 'cold'
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          customer_id: string
          tracked_user_email: string
          event_name: string
          properties: Record<string, unknown> | null
          timestamp: string
        }
        Insert: {
          id?: string
          customer_id: string
          tracked_user_email: string
          event_name: string
          properties?: Record<string, unknown> | null
          timestamp?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tracked_user_email?: string
          event_name?: string
          properties?: Record<string, unknown> | null
          timestamp?: string
        }
      }
      workflows: {
        Row: {
          id: string
          customer_id: string
          name: string
          type: 'trial_recovery' | 'onboarding_activation' | 'silent_churn' | 'custom'
          is_active: boolean
          status: 'draft' | 'active' | 'paused' | null
          inactive_days_trigger: number
          whatsapp_message: string | null
          config: Record<string, unknown> | null
          trigger_config: Record<string, unknown> | null
          steps: unknown[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          name: string
          type: 'trial_recovery' | 'onboarding_activation' | 'silent_churn' | 'custom'
          is_active?: boolean
          status?: 'draft' | 'active' | 'paused' | null
          inactive_days_trigger?: number
          whatsapp_message?: string | null
          config?: Record<string, unknown> | null
          trigger_config?: Record<string, unknown> | null
          steps?: unknown[] | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          name?: string
          type?: 'trial_recovery' | 'onboarding_activation' | 'silent_churn' | 'custom'
          is_active?: boolean
          status?: 'draft' | 'active' | 'paused' | null
          inactive_days_trigger?: number
          whatsapp_message?: string | null
          config?: Record<string, unknown> | null
          trigger_config?: Record<string, unknown> | null
          steps?: unknown[] | null
          updated_at?: string
        }
      }
      workflow_logs: {
        Row: {
          id: string
          workflow_id: string
          customer_id: string
          tracked_user_email: string
          action_taken: 'whatsapp_sent' | 'email_sent' | 'slack_notified'
          status: 'success' | 'failed'
          fired_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          customer_id: string
          tracked_user_email: string
          action_taken: 'whatsapp_sent' | 'email_sent' | 'slack_notified'
          status: 'success' | 'failed'
          fired_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          customer_id?: string
          tracked_user_email?: string
          action_taken?: 'whatsapp_sent' | 'email_sent' | 'slack_notified'
          status?: 'success' | 'failed'
          fired_at?: string
        }
      }
    }
  }
}

export type Customer = Database['public']['Tables']['customers']['Row']
export type TrackedUser = Database['public']['Tables']['tracked_users']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Workflow = Database['public']['Tables']['workflows']['Row']
export type WorkflowLog = Database['public']['Tables']['workflow_logs']['Row']