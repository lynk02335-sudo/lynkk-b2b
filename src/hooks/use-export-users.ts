import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ExportFilters {
  status?: string
  search?: string
  plan?: string
  source?: string
}

export function useExportUsers() {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const exportUsers = async (filters: ExportFilters = {}) => {
    setIsExporting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const params = new URLSearchParams()
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      if (filters.plan) params.set('plan', filters.plan)
      if (filters.source) params.set('source', filters.source)

      const queryString = params.toString()
      const url = `${API_URL}/api/users/export${queryString ? `?${queryString}` : ''}`

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Export failed' }))
        throw new Error(err.message || 'Export failed')
      }

      const blob = await res.blob()
      const date = new Date().toISOString().split('T')[0]
      const filename = `lynkk-users-${date}.csv`

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: err.message || 'Please try again.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return { exportUsers, isExporting }
}
