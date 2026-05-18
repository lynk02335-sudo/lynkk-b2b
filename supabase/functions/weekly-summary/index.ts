import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const platformApiKey = Deno.env.get("RESEND_API_KEY")
    const platformFrom = Deno.env.get("RESEND_FROM_EMAIL")

    if (!platformApiKey || !platformFrom) {
      console.error("RESEND_API_KEY or RESEND_FROM_EMAIL not set — weekly summary disabled")
      return new Response(
        JSON.stringify({ error: "Platform email not configured" }),
        { status: 500 }
      )
    }

    // Get all customers with an email address
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .not("email", "is", null)

    if (!customers || customers.length === 0) return new Response(
      JSON.stringify({ message: "No customers to email" }),
      { status: 200 }
    )

    for (const customer of customers) {
      // New signups this week
      const { count: newSignups } = await supabase
        .from("tracked_users")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .gte("first_seen", weekAgo.toISOString())

      // Workflows fired this week
      const { count: fired } = await supabase
        .from("workflow_logs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .gte("fired_at", weekAgo.toISOString())
        .eq("status", "success")

      // Unique users contacted
      const { data: contactedUsers } = await supabase
        .from("workflow_logs")
        .select("tracked_user_email")
        .eq("customer_id", customer.id)
        .gte("fired_at", weekAgo.toISOString())
        .eq("status", "success")

      const uniqueContacted = new Set(
        contactedUsers?.map(l => l.tracked_user_email)
      ).size

      // Recovery rate: users contacted who came back (single batch query, not N+1)
      let recovered = 0
      if (contactedUsers && contactedUsers.length > 0) {
        const contactedEmails = [...new Set(contactedUsers.map(l => l.tracked_user_email))]
        const { data: recoveredUsers } = await supabase
          .from("tracked_users")
          .select("email")
          .eq("customer_id", customer.id)
          .in("email", contactedEmails)
          .gte("last_seen", weekAgo.toISOString())
        recovered = recoveredUsers?.length ?? 0
      }

      const recoveryRate = uniqueContacted > 0
        ? Math.round((recovered / uniqueContacted) * 100)
        : 0

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B55E6;">
            Weekly Summary — ${customer.product_name}
          </h2>
          <p style="color: #666;">
            Here's how your growth automation performed this week.
          </p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #3B55E6;">
                ${newSignups || 0}
              </div>
              <div style="color: #666; margin-top: 4px;">New Signups</div>
            </div>
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #3B55E6;">
                ${uniqueContacted}
              </div>
              <div style="color: #666; margin-top: 4px;">Users Contacted</div>
            </div>
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #22c55e;">
                ${recovered}
              </div>
              <div style="color: #666; margin-top: 4px;">Users Recovered</div>
            </div>
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #22c55e;">
                ${recoveryRate}%
              </div>
              <div style="color: #666; margin-top: 4px;">Recovery Rate</div>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: #fff8e1; border-radius: 8px;">
            <strong>🔥 Workflows fired this week: ${fired || 0}</strong>
          </div>

          <div style="margin-top: 32px; text-align: center;">
            <a href="${Deno.env.get("APP_URL") ?? ''}/analytics"
               style="background: #3B55E6; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: bold;">
              View Full Dashboard →
            </a>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 32px; text-align: center;">
            Lynkk — Growth Automation for B2B SaaS
          </p>
        </div>
      `

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${platformApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: platformFrom,
          to: customer.email,
          subject: `📊 Your Weekly Growth Summary — ${customer.product_name}`,
          html
        })
      })

      if (!emailRes.ok) {
        const errBody = await emailRes.text()
        console.error(`Failed to send summary to ${customer.email}: ${emailRes.status} ${errBody}`)
      } else {
        console.log("Summary sent to:", customer.email)
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: customers.length }),
      { status: 200 }
    )

  } catch (error) {
    console.error("Weekly summary error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
