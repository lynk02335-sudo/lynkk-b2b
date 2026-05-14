import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  let triggered = 0
  let succeeded = 0
  let failed = 0

  try {
    const { data: workflows, error: workflowsError } = await supabase
      .from('workflows')
      .select('*, customers(dialog360_api_key, slack_webhook_url, whatsapp_number, product_name)')
      .eq('is_active', true)

    if (workflowsError || !workflows) {
      return new Response(
        JSON.stringify({ triggered: 0, succeeded: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    for (const workflow of workflows) {
      const customer = workflow.customers as any
      const config = typeof workflow.config === 'object' ? workflow.config : {}
      
      let query = supabase
        .from('tracked_users')
        .select('*')
        .eq('customer_id', workflow.customer_id)

      if (workflow.template_id === 'trial_recovery') {
        query = query.eq('status', 'cold')
      } else if (workflow.template_id === 'onboarding_activation') {
        query = query.eq('status', 'at_risk')
      } else if (workflow.template_id === 'silent_churn') {
        query = query.eq('status', 'cold')
      }

      const { data: users } = await query

      if (!users || users.length === 0) continue

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      for (const user of users) {
        const { data: existingLog } = await supabase
          .from('workflow_logs')
          .select('id')
          .eq('workflow_id', workflow.id)
          .eq('tracked_user_email', user.email)
          .gte('fired_at', sevenDaysAgo.toISOString())
          .single()

        if (existingLog) continue

        triggered++

        const daysInactive = Math.floor(
          (Date.now() - new Date(user.last_seen).getTime()) / (1000 * 60 * 60 * 24)
        )

        const interpolateMessage = (msg: string) => {
          return msg
            .replace(/{{user_name}}/g, user.name || user.email.split('@')[0])
            .replace(/{{product_name}}/g, customer.product_name || 'the app')
            .replace(/{{days_inactive}}/g, daysInactive.toString())
        }

        let actionTaken = ''
        let actionStatus = 'failed'
        let errorMsg = ''

        if (config.slack_webhook_url && customer.slack_webhook_url) {
          try {
            const slackMessage = `🚨 User Alert: ${user.email} has been inactive for ${daysInactive} days in ${customer.product_name || 'your product'}. Time to reach out.`
            
            await fetch(customer.slack_webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: slackMessage }),
            })

            actionTaken = 'slack_notified'
            actionStatus = 'success'
            succeeded++
          } catch (e) {
            errorMsg = String(e)
            actionTaken = 'slack_notified'
            actionStatus = 'failed'
            failed++
          }
        } else if (workflow.whatsapp_message && config.whatsapp_number && customer.dialog360_api_key) {
          try {
            const message = interpolateMessage(workflow.whatsapp_message)
            
            const response = await fetch('https://waba.360dialog.io/v1/messages', {
              method: 'POST',
              headers: {
                'D360-API-KEY': customer.dialog360_api_key,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: config.whatsapp_number,
                type: 'text',
                text: { body: message },
              }),
            })

            if (response.ok) {
              actionTaken = 'whatsapp_sent'
              actionStatus = 'success'
              succeeded++
            } else {
              errorMsg = await response.text()
              actionTaken = 'whatsapp_sent'
              actionStatus = 'failed'
              failed++
            }
          } catch (e) {
            errorMsg = String(e)
            actionTaken = 'whatsapp_sent'
            actionStatus = 'failed'
            failed++
          }
        }

        if (actionTaken) {
          await supabase
            .from('workflow_logs')
            .insert({
              workflow_id: workflow.id,
              customer_id: workflow.customer_id,
              tracked_user_email: user.email,
              action_taken: actionTaken,
              status: actionStatus,
              fired_at: new Date().toISOString(),
            })
        }
      }
    }

    return new Response(
      JSON.stringify({ triggered, succeeded, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Workflow execution error:', error)
    return new Response(
      JSON.stringify({ triggered, succeeded, failed, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})