import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get("api_key")
  const userEmail = searchParams.get("user_email") || ""
  const strategy = searchParams.get("strategy") || ""

  if (!apiKey) return json({ error: "api_key required" }, 400)
  if (!userEmail) return json({ error: "user_email required" }, 400)

  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("api_key", apiKey)
    .maybeSingle()

  if (custError || !customer) return json({ error: "Invalid API key" }, 401)

  const { data: trackedUser, error: userError } = await supabase
    .from("tracked_users")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("email", userEmail)
    .maybeSingle()

  if (userError || !trackedUser) return json({ items: [] })

  let query = supabase
    .from("recommendations")
    .select("strategy, item_ids")
    .eq("customer_id", customer.id)
    .eq("tracked_user_id", trackedUser.id)
    .gte("expires_at", new Date().toISOString())

  if (strategy) {
    query = query.eq("strategy", strategy.toUpperCase())
  }

  const { data: recs, error: recError } = await query

  if (recError || !recs || recs.length === 0) return json({ items: [] })

  const allItemIds = [...new Set(recs.flatMap((r: any) => r.item_ids || []))]

  const { data: items } = await supabase
    .from("catalog_items")
    .select("id, external_id, name, description, category, price, image_url, url")
    .in("id", allItemIds)

  return json({ items: items || [], strategies: recs.map((r: any) => r.strategy) })
})
