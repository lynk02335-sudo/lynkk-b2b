import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const ensureCustomerRecord = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', user.id)
    .single()

  if (existing) return existing

  if (fetchError?.code === 'PGRST116' || !existing) {
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

    if (insertError) return null

    return created
  }

  return null
}

export const useCustomer = () => {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const record = await ensureCustomerRecord()
    if (record) {
      setCustomer(record)
    } else {
      setError('Could not load or create customer record.')
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

