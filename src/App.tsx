import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '@/components/protected-route'
import { SignupPage } from '@/pages/signup'
import { LoginPage } from '@/pages/login'
import { OnboardingPage } from '@/pages/onboarding'
import { DashboardPage } from '@/pages/dashboard'
import { WorkflowsPage } from '@/pages/workflows'
import { AnalyticsPage } from '@/pages/analytics'
import { SettingsPage } from '@/pages/settings'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('customers').select('count', { count: 'exact', head: true })
        if (error) {
          console.error("Supabase connection failed", error)
        } else {
          console.log("Supabase connected")
        }
      } catch (error) {
        console.error("Supabase connection failed", error)
      }
    }
    testConnection()

    const sessionTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    supabase.auth.getSession().then((res) => {
      const session = res.data?.session
      console.log("App: session loaded", !!session)
      setSession(session)
      setLoading(false)
      clearTimeout(sessionTimeout)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("App: auth state changed", _event, !!session)
      setSession(session)
    })
    const subscription = data?.subscription
    
    return () => {
      subscription?.unsubscribe()
      clearTimeout(sessionTimeout)
    }
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>

  return (
    <>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
        
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/workflows" element={
          <ProtectedRoute>
            <WorkflowsPage />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster />
    </>
  )
}

export default App