import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  api_key: string
  event: string
  user_email: string
  user_name?: string
  properties?: Record<string, any>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: RequestBody = await req.json()
    const { api_key, event, user_email, user_name, properties } = body

    if (!api_key || !event || !user_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, product_name')
      .eq('api_key', api_key)
      .single()

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date().toISOString()
    
    const { data: existingUser } = await supabase
      .from('tracked_users')
      .select('last_seen')
      .eq('customer_id', customer.id)
      .eq('email', user_email)
      .single()

    let status: 'active' | 'at_risk' | 'cold' = 'active'
    if (existingUser?.last_seen) {
      const hoursSinceLastSeen = (Date.now() - new Date(existingUser.last_seen).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastSeen > 120) status = 'cold'
      else if (hoursSinceLastSeen > 48) status = 'at_risk'
    }

    const { error: upsertError } = await supabase
      .from('tracked_users')
      .upsert({
        customer_id: customer.id,
        email: user_email,
        name: user_name || null,
        first_seen: existingUser?.first_seen || now,
        last_seen: now,
        last_action: event,
        status,
        metadata: properties || null,
      }, {
        onConflict: 'customer_id,email',
      })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
    }

    const { error: eventError } = await supabase
      .from('events')
      .insert({
        customer_id: customer.id,
        tracked_user_email: user_email,
        event_name: event,
        properties: properties || null,
        timestamp: now,
      })

    if (eventError) {
      console.error('Event insert error:', eventError)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Track error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})