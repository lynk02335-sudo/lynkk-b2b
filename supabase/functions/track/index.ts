import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { api_key, event, user_email, user_name, properties } = body as {
      api_key?: string; event?: string; user_email?: string; user_name?: string; properties?: Record<string, unknown>
    }

    console.log("Track event received:", { api_key, event, user_email })

    // STEP 1: Validate required fields
    if (!api_key || !user_email || !event) {
      return new Response(
        JSON.stringify({ error: "api_key, user_email, and event are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // STEP 2: Find customer by api_key
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, product_name")
      .eq("api_key", api_key)
      .single()

    if (customerError || !customer) {
      console.error("Invalid API key:", api_key)
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Customer found:", customer.id)

    // STEP 3: Upsert tracked_user — status is NOT set here; update-user-status cron owns it
    const now = new Date()

    // STEP 4: Upsert tracked_user
    const { data: trackedUser, error: upsertError } = await supabase
      .from("tracked_users")
      .upsert({
        customer_id: customer.id,
        email: user_email,
        name: user_name || null,
        last_seen: now.toISOString(),
        last_action: event,
        first_seen: now.toISOString() // ignored on update due to onConflict
      }, {
        onConflict: "customer_id,email",
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (upsertError) {
      console.error("Failed to upsert tracked user:", upsertError)
      throw upsertError
    }

    // STEP 5: Insert event log
    const { error: eventError } = await supabase
      .from("events")
      .insert({
        customer_id: customer.id,
        tracked_user_email: user_email,
        event_name: event,
        properties: properties || {},
        timestamp: now.toISOString()
      })

    if (eventError) {
      console.error("Failed to insert event:", eventError)
      // Don't throw — event logging failure shouldn't break tracking
    }

    console.log("Event tracked successfully for:", user_email)

    return new Response(
      JSON.stringify({ success: true, message: "Event tracked" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Track function error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})