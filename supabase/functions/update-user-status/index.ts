import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const now = new Date()
    let updated = { active: 0, at_risk: 0, cold: 0 }

    // Active: seen within last 48 hours
    const active48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const { count: activeCount } = await supabase
      .from("tracked_users")
      .update({ status: "active" })
      .gte("last_seen", active48h.toISOString())
      .neq("status", "active")
      .select("*", { count: "exact", head: true })
    updated.active = activeCount || 0

    // At Risk: last seen 2-5 days ago
    const risk2days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const risk5days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const { count: riskCount } = await supabase
      .from("tracked_users")
      .update({ status: "at_risk" })
      .lt("last_seen", risk2days.toISOString())
      .gte("last_seen", risk5days.toISOString())
      .select("*", { count: "exact", head: true })
    updated.at_risk = riskCount || 0

    // Cold: last seen more than 5 days ago
    const cold5days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const { count: coldCount } = await supabase
      .from("tracked_users")
      .update({ status: "cold" })
      .lt("last_seen", cold5days.toISOString())
      .select("*", { count: "exact", head: true })
    updated.cold = coldCount || 0

    console.log("Status update complete:", updated)

    return new Response(
      JSON.stringify({ success: true, updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Status update error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
