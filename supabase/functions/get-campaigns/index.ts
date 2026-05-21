import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

// ─── URL MATCHING via display_rules ──────────────────────────

function matchesUrl(displayRules: Record<string, unknown> | null, pageUrl: string): boolean {
  const pattern = (displayRules?.url_pattern as string) || ""
  if (!pattern) return true

  const matchType = (displayRules?.url_match as string) || "contains"
  if (matchType === "contains") return pageUrl.includes(pattern)
  if (matchType === "exact") return pageUrl === pattern
  if (matchType === "regex") {
    try { return new RegExp(pattern).test(pageUrl) } catch { return false }
  }
  return true
}

// ─── TARGETING RULES via targeting_rules.conditions ──────────

function evalCondition(
  condition: { property: string; operator: string; value: unknown },
  user: Record<string, unknown> | null
): boolean {
  if (!user) return false

  const { property, operator, value } = condition
  const userVal = property === "status" ? user.status
    : property === "plan" ? (user.metadata as any)?.plan
    : undefined

  if (userVal === undefined) return true  // Unknown property — don't filter

  const str = String(userVal)
  const val = String(value)

  if (operator === "eq") return str === val
  if (operator === "neq") return str !== val
  if (operator === "contains") return str.includes(val)

  const num = Number(userVal)
  const numVal = Number(value)
  if (!isNaN(num) && !isNaN(numVal)) {
    if (operator === "gte") return num >= numVal
    if (operator === "lte") return num <= numVal
    if (operator === "gt") return num > numVal
    if (operator === "lt") return num < numVal
  }

  return true
}

function evalTargeting(
  rules: { operator?: string; conditions?: Array<{ property: string; operator: string; value: unknown }> } | null,
  user: Record<string, unknown> | null
): boolean {
  if (!rules || !rules.conditions || rules.conditions.length === 0) return true
  const op = rules.operator || "AND"
  const results = rules.conditions.map(c => evalCondition(c, user))
  return op === "AND" ? results.every(Boolean) : results.some(Boolean)
}

// ─── MAIN HANDLER ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // ── GET: return matching active campaigns ──────────────────
  if (req.method === "GET") {
    const { searchParams } = new URL(req.url)
    const apiKey = searchParams.get("api_key")
    const userEmail = searchParams.get("user_email") || ""
    const pageUrl = searchParams.get("url") || searchParams.get("page") || ""

    if (!apiKey) return json({ error: "api_key required" }, 400)

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("id")
      .eq("api_key", apiKey)
      .maybeSingle()

    if (custError || !customer) return json({ error: "Invalid API key" }, 401)

    let trackedUser: Record<string, unknown> | null = null
    if (userEmail) {
      const { data } = await supabase
        .from("tracked_users")
        .select("id, status, metadata")
        .eq("customer_id", customer.id)
        .eq("email", userEmail)
        .maybeSingle()
      trackedUser = data
    }

    const { data: campaigns, error: campError } = await supabase
      .from("personalization_campaigns")
      .select("id, type, content, display_rules, targeting_rules, priority, variants")
      .eq("customer_id", customer.id)
      .eq("status", "ACTIVE")
      .order("priority", { ascending: false })

    if (campError) return json({ error: "Failed to fetch campaigns" }, 500)
    if (!campaigns || campaigns.length === 0) return json({ campaigns: [] })

    const matched = campaigns.filter(c => {
      return matchesUrl(c.display_rules, pageUrl) && evalTargeting(c.targeting_rules, trackedUser)
    })

    return json({ campaigns: matched })
  }

  // ── POST: record personalization event ──────────────────────
  if (req.method === "POST") {
    let body: Record<string, string>
    try {
      body = await req.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const { api_key, campaign_id, user_email, event_type, url, variant_id } = body

    if (!api_key || !campaign_id || !user_email || !event_type) {
      return json({ error: "api_key, campaign_id, user_email, event_type required" }, 400)
    }

    const validTypes = ["IMPRESSION", "CLICK", "DISMISSED"]
    if (!validTypes.includes(event_type)) {
      return json({ error: "event_type must be IMPRESSION, CLICK, or DISMISSED" }, 400)
    }

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("id")
      .eq("api_key", api_key)
      .maybeSingle()

    if (custError || !customer) return json({ error: "Invalid API key" }, 401)

    const { data: trackedUser, error: userError } = await supabase
      .from("tracked_users")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("email", user_email)
      .maybeSingle()

    if (userError || !trackedUser) return json({ error: "User not found" }, 404)

    const insertPayload: Record<string, unknown> = {
      customer_id: customer.id,
      campaign_id,
      tracked_user_id: trackedUser.id,
      event_type,
      url: url || "",
    }
    if (variant_id) insertPayload.variant_id = variant_id

    const { error: insertError } = await supabase
      .from("personalization_events")
      .insert(insertPayload)

    if (insertError) {
      console.error("personalization_events insert error:", insertError)
      return json({ error: "Failed to record event" }, 500)
    }

    return json({ success: true })
  }

  return json({ error: "Method not allowed" }, 405)
})
