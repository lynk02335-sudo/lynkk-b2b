import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const ensureCustomerRecord = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[Customer] Auth error:', authError)
    return null
  }
  if (!user) return null

  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', user.id)
    .single()

  if (existing) return existing
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[Customer] Fetch error:', fetchError)
    return null
  }

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
    console.error('[Customer] Insert error:', insertError)
    return null
  }

  return created
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

