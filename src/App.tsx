import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QueryProvider } from '@/components/query-provider'
import { ProtectedRoute } from '@/components/protected-route'
import { SignupPage } from '@/pages/signup'
import { LoginPage } from '@/pages/login'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { ResetPasswordPage } from '@/pages/reset-password'
import { OnboardingPage } from '@/pages/onboarding'
import { DashboardPage } from '@/pages/dashboard'
import UsersPage from '@/pages/users'
import { WorkflowsPage } from '@/pages/workflows'
import WorkflowBuilderPage from '@/pages/workflow-builder'
import WorkflowStatsPage from '@/pages/workflow-stats'
import { AnalyticsPage } from '@/pages/analytics'
import { SettingsPage } from '@/pages/settings'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      setSession(res.data?.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    const subscription = data?.subscription

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>

  return (
    <QueryProvider>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />

        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
        <Route path="/forgot-password" element={session ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={session ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />

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
        <Route path="/users" element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        } />
        <Route path="/workflows" element={
          <ProtectedRoute>
            <WorkflowsPage />
          </ProtectedRoute>
        } />
        <Route path="/workflows/new" element={
          <ProtectedRoute>
            <WorkflowBuilderPage />
          </ProtectedRoute>
        } />
        <Route path="/workflows/:id/edit" element={
          <ProtectedRoute>
            <WorkflowBuilderPage />
          </ProtectedRoute>
        } />
        <Route path="/workflows/:id/stats" element={
          <ProtectedRoute>
            <WorkflowStatsPage />
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
    </QueryProvider>
  )
}

export default App
