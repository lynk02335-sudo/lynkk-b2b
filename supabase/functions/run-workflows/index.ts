import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── PHONE EXTRACTION ────────────────────────────────────────

function getUserPhone(user: any): string {
  if (user.phone) return user.phone
  if (user.metadata && typeof user.metadata === "object") {
    const m = user.metadata as Record<string, string>
    return m.phone || m.phone_number || m.mobile || ""
  }
  return ""
}

// ─── WHATSAPP SENDERS ───────────────────────────────────────

async function sendWhatsApp(config: any, to: string, message: string) {
  const provider = config?.provider

  if (!provider || !to || !message) {
    console.error("Missing WhatsApp config, recipient, or message")
    return false
  }

  try {
    if (provider === "360dialog") {
      const res = await fetch("https://waba.360dialog.io/v1/messages", {
        method: "POST",
        headers: {
          "D360-API-KEY": config.api_key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body: message }
        })
      })
      const data = await res.json()
      console.log("360dialog response:", data)
      return res.ok

    } else if (provider === "twilio") {
      const auth = btoa(`${config.account_sid}:${config.auth_token}`)
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            From: `whatsapp:${config.phone_number}`,
            To: `whatsapp:${to}`,
            Body: message
          })
        }
      )
      const data = await res.json()
      console.log("Twilio response:", data)
      return res.ok

    } else if (provider === "wati") {
      const res = await fetch(
        `${config.endpoint_url}/api/v1/sendSessionMessage/${to.replace(/\D/g, "")}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.api_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ messageText: message })
        }
      )
      const data = await res.json()
      console.log("Wati response:", data)
      return res.ok

    } else if (provider === "aisensy") {
      const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: config.api_key,
          campaignName: "Lynkk Workflow",
          destination: to.replace(/\D/g, ""),
          userName: "User",
          source: "Lynkk",
          media: {},
          buttons: [],
          carouselCards: [],
          location: {},
          paramsFallbackValue: { FirstName: "User" }
        })
      })
      const data = await res.json()
      console.log("AiSensy response:", data)
      return res.ok

    } else if (provider === "interakt") {
      const res = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${config.api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          countryCode: "+91",
          phoneNumber: to.replace(/\D/g, "").slice(-10),
          callbackData: "Lynkk workflow",
          type: "Text",
          data: { message }
        })
      })
      const data = await res.json()
      console.log("Interakt response:", data)
      return res.ok

    } else if (provider === "meta_cloud") {
      if (!config.access_token || !config.phone_number_id) {
        console.error("Meta Cloud API requires access_token and phone_number_id")
        return false
      }
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to.replace(/\D/g, ""),
            type: "text",
            text: {
              preview_url: false,
              body: message
            }
          })
        }
      )
      const data = await res.json()
      if (!res.ok) console.error("Meta Cloud API error:", data)
      return res.ok

    } else if (provider === "other") {
      const res = await fetch(config.endpoint_url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ to, message })
      })
      return res.ok
    }

  } catch (err) {
    console.error("WhatsApp send error:", err)
    return false
  }

  return false
}

// ─── SLACK SENDER ────────────────────────────────────────────

async function sendSlack(webhookUrl: string, message: string) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message })
    })
    return res.ok
  } catch (err) {
    console.error("Slack send error:", err)
    return false
  }
}

// ─── SMS SENDER (Twilio) ─────────────────────────────────────

async function sendSMS(smsConfig: any, to: string, message: string) {
  const { account_sid, auth_token, phone_number, messaging_service_sid } = smsConfig || {}
  if (!account_sid || !auth_token) return false
  if (!phone_number && !messaging_service_sid) return false
  if (!to || !message) return false

  try {
    const auth = btoa(`${account_sid}:${auth_token}`)
    const formData = new URLSearchParams()
    formData.append("To", to)
    formData.append("Body", message)
    if (messaging_service_sid) {
      formData.append("MessagingServiceSid", messaging_service_sid)
    } else {
      formData.append("From", phone_number)
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      }
    )
    return res.ok
  } catch (err) {
    console.error("SMS send error:", err)
    return false
  }
}

// ─── PUSH SENDER (FCM) ────────────────────────────────────────

async function sendPush(
  supabase: any,
  pushConfig: any,
  customerId: string,
  userEmail: string,
  title: string,
  body: string
) {
  const { fcm_server_key } = pushConfig || {}
  if (!fcm_server_key) return false

  try {
    const { data: trackedUser } = await supabase
      .from("tracked_users")
      .select("id")
      .eq("customer_id", customerId)
      .eq("email", userEmail)
      .maybeSingle()

    if (!trackedUser) return false

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("customer_id", customerId)
      .eq("tracked_user_id", trackedUser.id)
      .eq("active", true)

    if (!tokens || tokens.length === 0) return false

    let anySuccess = false
    for (const { token } of tokens) {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Authorization": `key=${fcm_server_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body }
        })
      })
      if (res.ok) {
        anySuccess = true
      } else {
        await supabase.from("push_tokens").update({ active: false }).eq("token", token)
      }
    }
    return anySuccess
  } catch (err) {
    console.error("Push send error:", err)
    return false
  }
}

// ─── EMAIL SENDER (Resend) ────────────────────────────────────

async function sendEmail(
  resendApiKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string
) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html })
    })
    return res.ok
  } catch (err) {
    console.error("Email send error:", err)
    return false
  }
}

// ─── MESSAGE INTERPOLATION ────────────────────────────────────

function interpolate(
  template: string, 
  vars: Record<string, string>
) {
  return template
    .replace(/{{user_name}}/g, vars.user_name || "there")
    .replace(/{{product_name}}/g, vars.product_name || "the app")
    .replace(/{{days_inactive}}/g, vars.days_inactive || "a few")
}

// ─── MAIN HANDLER ─────────────────────────────────────────────

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const now = new Date()
    const summary = { workflows_checked: 0, users_matched: 0, actions_fired: 0, failures: 0 }

    // STEP 1: Get all active workflows with customer data
    const { data: workflows, error: wfError } = await supabase
      .from("workflows")
      .select(`
        *,
        customers (
          id,
          product_name,
          whatsapp_config,
          slack_webhook_url,
          resend_api_key,
          from_email,
          sms_config,
          twilio_config,
          push_config
        )
      `)
      .eq("is_active", true)

    if (wfError) throw wfError
    if (!workflows || workflows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active workflows", summary }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    summary.workflows_checked = workflows.length
    console.log(`Processing ${workflows.length} active workflows`)

    // STEP 2: Process each workflow
    for (const workflow of workflows) {
      const customer = workflow.customers
      if (!customer) continue

      const triggerDays = workflow.inactive_days_trigger || 5
      const cutoff = new Date(now.getTime() - triggerDays * 24 * 60 * 60 * 1000)
      const recentCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // STEP 3: Find matching users based on template
      let users: any[] = []
      
      if (workflow.type === "pricing_page_recovery") {
        const pricingEvent = workflow.config?.pricing_event || "viewed_pricing"
        const conversionEvent = workflow.config?.conversion_event || "upgraded_plan"
        
        const { data: pricingEvents, error: pricingError } = await supabase
          .from("events")
          .select("tracked_user_email, timestamp")
          .eq("customer_id", customer.id)
          .eq("event_name", pricingEvent)
          .lt("timestamp", cutoff.toISOString())
          .order("timestamp", { ascending: false })

        if (pricingError) {
          console.error("Pricing event query error:", pricingError)
          continue
        }

        if (pricingEvents && pricingEvents.length > 0) {
          const latestPricingEvents = new Map()
          for (const e of pricingEvents) {
            if (!latestPricingEvents.has(e.tracked_user_email)) {
              latestPricingEvents.set(e.tracked_user_email, e.timestamp)
            }
          }

          const candidateEmails = Array.from(latestPricingEvents.keys())

          const { data: conversionEvents } = await supabase
            .from("events")
            .select("tracked_user_email")
            .eq("customer_id", customer.id)
            .eq("event_name", conversionEvent)
            .in("tracked_user_email", candidateEmails)

          const convertedEmails = new Set(conversionEvents?.map(e => e.tracked_user_email) || [])
          const targetEmails = candidateEmails.filter(email => !convertedEmails.has(email))

          if (targetEmails.length > 0) {
            const { data: matchedUsers, error: matchedError } = await supabase
              .from("tracked_users")
              .select("*")
              .eq("customer_id", customer.id)
              .in("email", targetEmails)

            if (matchedError) {
              console.error("Matched users query error:", matchedError)
            } else {
              users = matchedUsers || []
            }
          }
        }
      } else {
        let query = supabase
          .from("tracked_users")
          .select("*")
          .eq("customer_id", customer.id)
          .lt("last_seen", cutoff.toISOString())

        // Template-specific filters
        if (workflow.type === "trial_recovery") {
          const trialCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
          query = query
            .gte("first_seen", trialCutoff.toISOString())
            .eq("status", "cold")

        } else if (workflow.type === "onboarding_activation") {
          const onboardCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
          query = query
            .gte("first_seen", onboardCutoff.toISOString())
            .in("status", ["at_risk", "cold"])

        } else if (workflow.type === "silent_churn") {
          query = query.eq("status", "cold")
        }

        const { data, error: userError } = await query
        if (userError) {
          console.error("User query error:", userError)
          continue
        }
        users = data || []
      }

      if (!users || users.length === 0) {
        console.log(`No matching users for workflow: ${workflow.type}`)
        continue
      }

      console.log(`Found ${users.length} users for ${workflow.type}`)
      summary.users_matched += users.length

      // STEP 4: For each user, check if already contacted recently
      for (const user of users) {
        const { data: recentLog } = await supabase
          .from("workflow_logs")
          .select("id")
          .eq("workflow_id", workflow.id)
          .eq("tracked_user_email", user.email)
          .gte("fired_at", recentCutoff.toISOString())
          .maybeSingle()

        if (recentLog) {
          console.log(`Skipping ${user.email} — already contacted recently`)
          continue
        }

        // Calculate days inactive
        const lastSeen = new Date(user.last_seen)
        const daysInactive = Math.floor(
          (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
        )

        const vars = {
          user_name: user.name || user.email.split("@")[0],
          product_name: customer.product_name || "the app",
          days_inactive: String(daysInactive)
        }

        // STEP 5: Execute actions based on template
        if (workflow.type === "trial_recovery" || 
            workflow.type === "onboarding_activation") {

          // Action 1: WhatsApp
          if (customer.whatsapp_config?.provider && getUserPhone(user)) {
            const message = interpolate(
              workflow.whatsapp_message || 
              "Hi {{user_name}}, we noticed you haven't logged into {{product_name}} in {{days_inactive}} days. Can we help?",
              vars
            )
            const success = await sendWhatsApp(
              customer.whatsapp_config,
              getUserPhone(user),
              message
            )
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "whatsapp_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

          // Action 2: Email
          if (customer.resend_api_key && customer.from_email) {
            const subject = `We miss you in ${customer.product_name}`
            const html = `
              <p>Hi ${vars.user_name},</p>
              <p>We noticed you haven't logged into
                 <strong>${vars.product_name}</strong>
                 in ${vars.days_inactive} days.</p>
              <p>Can we help you get back on track?</p>
              <p>Reply to this email and we'll get back to you.</p>
            `
            const success = await sendEmail(
              customer.resend_api_key,
              customer.from_email,
              user.email,
              subject,
              html
            )
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "email_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

          // Action 3: SMS
          if (customer.sms_config && getUserPhone(user)) {
            const message = interpolate(
              "Hi {{user_name}}, we noticed you haven't logged into {{product_name}} in {{days_inactive}} days. Can we help?",
              vars
            )
            const success = await sendSMS(customer.sms_config, getUserPhone(user), message)
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "sms_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

          // Action 4: Push notification
          if (customer.push_config?.fcm_server_key) {
            const success = await sendPush(
              supabase,
              customer.push_config,
              customer.id,
              user.email,
              `We miss you in ${customer.product_name}`,
              `Hi ${vars.user_name}, you haven't logged in for ${vars.days_inactive} days. Come back!`
            )
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "push_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

        } else if (workflow.type === "pricing_page_recovery") {
          // Action 1: WhatsApp — upgrade nudge
          if (customer.whatsapp_config?.provider && getUserPhone(user)) {
            const message = interpolate(
              workflow.whatsapp_message ||
              "Hi {{user_name}}, you checked out {{product_name}}'s pricing recently. We'd love to help you get started — any questions?",
              vars
            )
            const success = await sendWhatsApp(customer.whatsapp_config, getUserPhone(user), message)
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "whatsapp_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

          // Action 2: Email — upgrade nudge
          if (customer.resend_api_key && customer.from_email) {
            const subject = `Still thinking about ${customer.product_name}?`
            const html = `
              <p>Hi ${vars.user_name},</p>
              <p>You visited <strong>${vars.product_name}</strong>'s pricing page recently but haven't upgraded yet.</p>
              <p>We'd love to help you find the right plan. Reply to this email with any questions.</p>
            `
            const success = await sendEmail(
              customer.resend_api_key,
              customer.from_email,
              user.email,
              subject,
              html
            )
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "email_sent",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

        } else if (workflow.type === "silent_churn") {
          // Action: Slack alert only
          if (customer.slack_webhook_url) {
            const message = `🚨 *Churn Alert* — *${user.email}* hasn't logged into *${customer.product_name}* in *${daysInactive} days*. Time to reach out.`
            const success = await sendSlack(customer.slack_webhook_url, message)
            await supabase.from("workflow_logs").insert({
              workflow_id: workflow.id,
              customer_id: customer.id,
              tracked_user_email: user.email,
              action_taken: "slack_notified",
              status: success ? "success" : "failed",
              fired_at: now.toISOString()
            })
            success ? summary.actions_fired++ : summary.failures++
          }

        } else if (workflow.type === "custom") {
          const steps: any[] = (workflow.config as any)?.steps || []

          for (const step of steps) {
            const actionType: string = step?.action?.type || ""
            const actionConfig: any = step?.action?.config || {}

            if (actionType === "send_whatsapp" && customer.whatsapp_config?.provider && getUserPhone(user)) {
              const message = interpolate(actionConfig.message || "Hi {{user_name}}, a message from {{product_name}}.", vars)
              const success = await sendWhatsApp(customer.whatsapp_config, getUserPhone(user), message)
              await supabase.from("workflow_logs").insert({
                workflow_id: workflow.id,
                customer_id: customer.id,
                tracked_user_email: user.email,
                action_taken: "whatsapp_sent",
                status: success ? "success" : "failed",
                fired_at: now.toISOString()
              })
              success ? summary.actions_fired++ : summary.failures++

            } else if (actionType === "send_email" && customer.resend_api_key && customer.from_email) {
              const subject = actionConfig.subject || `A message from ${customer.product_name}`
              const html = actionConfig.html || `<p>Hi ${vars.user_name},</p><p>${actionConfig.message || ""}</p>`
              const success = await sendEmail(customer.resend_api_key, customer.from_email, user.email, subject, html)
              await supabase.from("workflow_logs").insert({
                workflow_id: workflow.id,
                customer_id: customer.id,
                tracked_user_email: user.email,
                action_taken: "email_sent",
                status: success ? "success" : "failed",
                fired_at: now.toISOString()
              })
              success ? summary.actions_fired++ : summary.failures++

            } else if (actionType === "send_sms" && customer.sms_config && getUserPhone(user)) {
              const message = interpolate(actionConfig.message || "Hi {{user_name}}, a message from {{product_name}}.", vars)
              const success = await sendSMS(customer.sms_config, getUserPhone(user), message)
              await supabase.from("workflow_logs").insert({
                workflow_id: workflow.id,
                customer_id: customer.id,
                tracked_user_email: user.email,
                action_taken: "sms_sent",
                status: success ? "success" : "failed",
                fired_at: now.toISOString()
              })
              success ? summary.actions_fired++ : summary.failures++

            } else if (actionType === "send_push" && customer.push_config?.fcm_server_key) {
              const title = interpolate(actionConfig.title || customer.product_name || "New message", vars)
              const body = interpolate(actionConfig.body || actionConfig.message || "", vars)
              const success = await sendPush(supabase, customer.push_config, customer.id, user.email, title, body)
              await supabase.from("workflow_logs").insert({
                workflow_id: workflow.id,
                customer_id: customer.id,
                tracked_user_email: user.email,
                action_taken: "push_sent",
                status: success ? "success" : "failed",
                fired_at: now.toISOString()
              })
              success ? summary.actions_fired++ : summary.failures++

            } else if (actionType === "send_slack_alert" && customer.slack_webhook_url) {
              const message = interpolate(actionConfig.message || "Alert from {{product_name}} for {{user_name}}.", vars)
              const success = await sendSlack(customer.slack_webhook_url, message)
              await supabase.from("workflow_logs").insert({
                workflow_id: workflow.id,
                customer_id: customer.id,
                tracked_user_email: user.email,
                action_taken: "slack_notified",
                status: success ? "success" : "failed",
                fired_at: now.toISOString()
              })
              success ? summary.actions_fired++ : summary.failures++

            } else if (actionType === "trigger_webhook" && actionConfig.url) {
              try {
                const res = await fetch(actionConfig.url, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(actionConfig.api_key ? { "Authorization": `Bearer ${actionConfig.api_key}` } : {})
                  },
                  body: JSON.stringify({ user: { email: user.email, name: user.name }, vars })
                })
                const success = res.ok
                await supabase.from("workflow_logs").insert({
                  workflow_id: workflow.id,
                  customer_id: customer.id,
                  tracked_user_email: user.email,
                  action_taken: "whatsapp_sent",
                  status: success ? "success" : "failed",
                  fired_at: now.toISOString()
                })
                success ? summary.actions_fired++ : summary.failures++
              } catch {
                summary.failures++
              }
            }
            // wait_for_event, update_user, ab_split require stateful execution — not supported in cron runner
          }
        }
      }
    }

    console.log("Workflow run complete:", summary)

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("run-workflows error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})