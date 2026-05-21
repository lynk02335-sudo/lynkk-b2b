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
    const { api_key, event, user_email, user_name, properties, revenue_value, currency, is_revenue_event } = body as {
      api_key?: string; event?: string; user_email?: string; user_name?: string; properties?: Record<string, unknown>;
      revenue_value?: number; currency?: string; is_revenue_event?: boolean;
    }

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
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

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
    const eventPayload: Record<string, any> = {
      customer_id: customer.id,
      tracked_user_email: user_email,
      event_name: event,
      properties: properties || {},
      timestamp: now.toISOString()
    }

    if (is_revenue_event || revenue_value != null) {
      eventPayload.revenue_value = revenue_value || null
      eventPayload.currency = currency || 'USD'
      eventPayload.is_revenue_event = true
    }

    // STEP 5b: Auto-create catalog item from product events
    if (properties && properties.product_id) {
      const productId = String(properties.product_id)
      const itemName = String(properties.name || properties.product_name || productId)
      const itemCategory = properties.category ? String(properties.category) : null
      const itemPrice = properties.price != null ? Number(properties.price) : null
      const itemImage = properties.image_url ? String(properties.image_url) : null
      const itemUrl = properties.url ? String(properties.url) : null

      const { data: existingItem } = await supabase
        .from("catalog_items")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("external_id", productId)
        .maybeSingle()

      if (!existingItem) {
        await supabase.from("catalog_items").insert({
          customer_id: customer.id,
          external_id: productId,
          name: itemName,
          category: itemCategory,
          price: itemPrice,
          image_url: itemImage,
          url: itemUrl,
        })
      }
    }

    const { error: eventError } = await supabase
      .from("events")
      .insert(eventPayload)

    if (eventError) {
      console.error("Failed to insert event:", eventError)
      // Don't throw — event logging failure shouldn't break tracking
    }

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