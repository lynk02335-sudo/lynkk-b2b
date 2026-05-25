import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { api, API_BASE_URL } from '@/lib/api'

export const ensureCustomerRecord = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[Customer] Auth error:', authError)
    return null
  }
  if (!user) return null

  // Try direct Supabase query first (works when RLS is set up correctly)
  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', user.id)
    .single()

  if (existing) return existing

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.warn('[Customer] Direct fetch failed, trying backend API:', fetchError)
    // Fallback: try backend API which uses service key
    return ensureCustomerViaAPI()
  }

  // Not found - try inserting directly first
  const newCustomer = {
    id: user.id,
    email: user.email,
    api_key: crypto.randomUUID(),
    product_name: '',
    created_at: new Date().toISOString()
  }

  const { data: created, error: insertError } = await supabase
    .from('customers')
    .insert(newCustomer)
    .select()
    .single()

  if (insertError) {
    console.warn('[Customer] Direct insert failed, trying backend API:', insertError)
    return ensureCustomerViaAPI()
  }

  return created
}

async function ensureCustomerViaAPI() {
  try {
    if (!API_BASE_URL) {
      console.error('[Customer] No API_BASE_URL configured')
      return null
    }
    const customer = await api.post<any>('/api/customer/ensure')
    console.log('[Customer] Created via backend API:', customer.id)
    return customer
  } catch (err: any) {
    console.error('[Customer] Backend API fallback also failed:', err)
    return null
  }
}

export const useCustomer = () => {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const record = await ensureCustomerRecord()
      if (record) {
        setCustomer(record)
        setError(null)
      } else {
        const msg = 'Could not load or create customer record. Check browser console for details.'
        console.error('[Customer] Failed to load:', msg)
        setError(msg)
      }
    } catch (err: any) {
      const msg = err.message || 'Unknown error loading customer'
      console.error('[Customer] Error:', err)
      setError(msg)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()

    const { data: authData } = supabase.auth.onAuthStateChange((_event, _session) => {
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        load()
      } else if (_event === 'SIGNED_OUT') {
        setCustomer(null)
        setLoading(false)
      }
    })
    const subscription = authData?.subscription

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return { customer, loading, error, refetch: load }
}

