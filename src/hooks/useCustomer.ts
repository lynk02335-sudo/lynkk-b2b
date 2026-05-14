import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const ensureCustomerRecord = async () => {
  // Step 1: Get the logged in user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    console.error('No authenticated user found:', authError)
    return null
  }
  
  console.log('Auth user found:', user.id, user.email)
  
  // Step 2: Check if customer record already exists
  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', user.id)
    .single()
  
  // Step 3: If record exists, return it
  if (existing) {
    console.log('Customer record found:', existing)
    return existing
  }
  
  // Step 4: If not found (PGRST116 = no rows), create it now
  if (fetchError?.code === 'PGRST116' || !existing) {
    console.log('No customer record found. Creating one now...')
    
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
      console.error('Failed to create customer record:', insertError)
      return null
    }
    
    console.log('Customer record created successfully:', created)
    return created
  }
  
  console.error('Unexpected error fetching customer:', fetchError)
  return null
}

export const useCustomer = () => {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
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
    load()

    const { data: authData } = supabase.auth.onAuthStateChange((_event, _session) => {
      console.log("Hook: auth state change detected", _event)
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
  
  return { customer, loading, error }
}

