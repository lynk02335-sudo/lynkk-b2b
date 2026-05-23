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
          sms_config: any | null
          twilio_config: any | null
          push_config: any | null
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
          sms_config?: any | null
          twilio_config?: any | null
          push_config?: any | null
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
          sms_config?: any | null
          twilio_config?: any | null
          push_config?: any | null
          created_at?: string
        }
      }
      tracked_users: {
        Row: {
          id: string
          customer_id: string
          email: string
          name: string | null
          phone: string | null
          source: 'js_snippet' | 'csv_import' | 'api' | null
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
          phone?: string | null
          source?: 'js_snippet' | 'csv_import' | 'api' | null
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
          phone?: string | null
          source?: 'js_snippet' | 'csv_import' | 'api' | null
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
          revenue_value: number | null
          currency: string | null
          is_revenue_event: boolean | null
        }
        Insert: {
          id?: string
          customer_id: string
          tracked_user_email: string
          event_name: string
          properties?: Record<string, unknown> | null
          timestamp?: string
          revenue_value?: number | null
          currency?: string | null
          is_revenue_event?: boolean | null
        }
        Update: {
          id?: string
          customer_id?: string
          tracked_user_email?: string
          event_name?: string
          properties?: Record<string, unknown> | null
          timestamp?: string
          revenue_value?: number | null
          currency?: string | null
          is_revenue_event?: boolean | null
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
      funnels: {
        Row: {
          id: string
          customer_id: string
          name: string
          steps: string[]
          conversion_window_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          name: string
          steps: string[]
          conversion_window_hours?: number
        }
        Update: {
          id?: string
          customer_id?: string
          name?: string
          steps?: string[]
          conversion_window_hours?: number
        }
      }
      workflow_logs: {
        Row: {
          id: string
          workflow_id: string
          customer_id: string
          tracked_user_email: string
          action_taken: 'whatsapp_sent' | 'email_sent' | 'slack_notified' | 'sms_sent' | 'push_sent'
          status: 'success' | 'failed'
          fired_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          customer_id: string
          tracked_user_email: string
          action_taken: 'whatsapp_sent' | 'email_sent' | 'slack_notified' | 'sms_sent' | 'push_sent'
          status: 'success' | 'failed'
          fired_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          customer_id?: string
          tracked_user_email?: string
          action_taken?: 'whatsapp_sent' | 'email_sent' | 'slack_notified' | 'sms_sent' | 'push_sent'
          status?: 'success' | 'failed'
          fired_at?: string
        }
      }
      catalog_items: {
        Row: {
          id: string
          customer_id: string
          external_id: string
          name: string
          description: string | null
          category: string | null
          price: number | null
          image_url: string | null
          url: string | null
          metadata: Record<string, unknown>
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          external_id: string
          name: string
          description?: string | null
          category?: string | null
          price?: number | null
          image_url?: string | null
          url?: string | null
          metadata?: Record<string, unknown>
          active?: boolean
        }
        Update: {
          id?: string
          customer_id?: string
          external_id?: string
          name?: string
          description?: string | null
          category?: string | null
          price?: number | null
          image_url?: string | null
          url?: string | null
          metadata?: Record<string, unknown>
          active?: boolean
        }
      }
      recommendations: {
        Row: {
          id: string
          customer_id: string
          tracked_user_id: string
          strategy: 'VIEWED_TOGETHER' | 'SIMILAR_USERS' | 'TRENDING'
          item_ids: string[]
          generated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tracked_user_id: string
          strategy: 'VIEWED_TOGETHER' | 'SIMILAR_USERS' | 'TRENDING'
          item_ids: string[]
          generated_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tracked_user_id?: string
          strategy?: 'VIEWED_TOGETHER' | 'SIMILAR_USERS' | 'TRENDING'
          item_ids?: string[]
          generated_at?: string
          expires_at?: string
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
export type Funnel = Database['public']['Tables']['funnels']['Row']
export type CatalogItem = Database['public']['Tables']['catalog_items']['Row']
export type Recommendation = Database['public']['Tables']['recommendations']['Row']
