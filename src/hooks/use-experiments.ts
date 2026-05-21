import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

export function useExperiments() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<any[]>('/api/experiments')
      setExperiments(data || [])
    } catch (err) {
      console.error('Failed to fetch experiments, falling back to Supabase:', err)
      try {
        const { data } = await supabase
          .from('experiments')
          .select('*')
          .order('created_at', { ascending: false })
        setExperiments(data || [])
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { experiments, loading, refetch: load }
}

export function useExperiment(id: string | undefined) {
  const [experiment, setExperiment] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await api.get<any>(`/api/experiments/${id}`)
      setExperiment(data)
    } catch {
      try {
        const { data } = await supabase.from('experiments').select('*').eq('id', id).single()
        setExperiment(data)
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { experiment, loading, refetch: load }
}

export async function createExperiment(data: {
  name: string
  type: 'WORKFLOW' | 'PERSONALIZATION'
  source_id: string
  variants: { id: string; name: string; description?: string }[]
  traffic_split: Record<string, number>
  goal_event: string
}) {
  return api.post<any>('/api/experiments', data)
}

export async function updateExperiment(id: string, data: any) {
  return api.put<any>(`/api/experiments/${id}`, data)
}

export async function declareWinner(id: string, variantId: string, autoRoute = false) {
  return api.post<any>(`/api/experiments/${id}/declare-winner`, { variant_id: variantId, auto_route: autoRoute })
}

export async function assignUserToExperiment(experimentId: string, trackedUserId: string) {
  return api.post<any>(`/api/experiments/${experimentId}/assign`, { tracked_user_id: trackedUserId })
}

export async function recordExperimentConversion(experimentId: string, trackedUserId: string) {
  return api.post<any>(`/api/experiments/${experimentId}/convert`, { tracked_user_id: trackedUserId })
}
