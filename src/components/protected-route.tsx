import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("ProtectedRoute: session loaded", !!session)
      setSession(session)
      setLoading(false)
      clearTimeout(timeout)
    })
    
    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("ProtectedRoute: auth change", _event, !!session)
        setSession(session)
      }
    )
    const subscription = data?.subscription
    
    return () => {
      subscription?.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])
  
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}