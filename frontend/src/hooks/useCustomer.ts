import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { api, API_BASE_URL } from '@/lib/api'

const TABLE_MISSING_CODES = ['42P01', 'PGRST205']
const NOT_FOUND_CODE = 'PGRST116'

function isTableMissingError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || err.error || '').toLowerCase()
  const code = err.code || ''
  if (TABLE_MISSING_CODES.includes(code)) return true
  if (msg.includes('could not find the table')) return true
  if (msg.includes('relation') && msg.includes('does not exist')) return true
  if (msg.includes('schema cache')) return true
  return false
}

export const ensureCustomerRecord = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[Customer] Auth error:', authError)
    return null
  }
  if (!user) return null

  // Try direct Supabase query first (works when RLS is set up correctly)
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existing) return existing

    // Table missing entirely — skip to API fallback
    if (isTableMissingError(fetchError)) {
      console.warn('[Customer] customers table not found in Supabase — trying backend API')
      return ensureCustomerViaAPI()
    }

    // Not found (PGRST116) — try to insert directly
    if (!fetchError || fetchError.code === NOT_FOUND_CODE) {
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

      if (created) return created

      // If insert failed because table missing, try API
      if (isTableMissingError(insertError)) {
        console.warn('[Customer] customers table not found during insert — trying backend API')
        return ensureCustomerViaAPI()
      }

      console.warn('[Customer] Direct insert failed, trying backend API:', insertError?.message)
      return ensureCustomerViaAPI()
    }

    // Other error (e.g. no perms, network) — try API
    console.warn('[Customer] Direct fetch failed, trying backend API:', fetchError?.message)
    return ensureCustomerViaAPI()
  } catch (err) {
    console.warn('[Customer] Direct query error, trying backend API:', err)
    return ensureCustomerViaAPI()
  }
}

async function ensureCustomerViaAPI() {
  try {
    if (!API_BASE_URL) {
      console.error('[Customer] No API_BASE_URL configured. Set VITE_API_URL in .env')
      return null
    }
    const customer = await api.post<any>('/api/customer/ensure', {})
    return customer
  } catch (err: any) {
    console.error('[Customer] Backend API fallback failed:', err.message)
    return null
  }
}

export const useCustomer = () => {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const record = await ensureCustomerRecord()
      if (record) {
        setCustomer(record)
      } else {
        const msg = 'Could not load or create customer record. If this persists, ensure database tables exist.'
        setError(msg)
      }
    } catch (err: any) {
      const msg = err.message || 'Unknown error loading customer'
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
