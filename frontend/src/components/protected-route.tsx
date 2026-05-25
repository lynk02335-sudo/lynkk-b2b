import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch((err) => {
      console.error('[ProtectedRoute] Failed to get session:', err)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )
    const subscription = data?.subscription

    return () => {
      subscription?.unsubscribe()
    }
  }, [])
  
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}