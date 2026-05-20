import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Funnel {
  id: string;
  customer_id: string;
  name: string;
  steps: string[];
  conversion_window_hours: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelStepResult {
  name: string;
  user_count: number;
  conversion_rate: number;
  median_time_to_next_step: number | null;
}

export interface FunnelResults {
  funnel_id: string;
  funnel_name: string;
  steps: FunnelStepResult[];
  segment?: string;
}

export function useFunnels() {
  return useQuery({
    queryKey: ['funnels'],
    queryFn: () => api.get<Funnel[]>('/api/funnels'),
  });
}

export function useFunnel(id: string | undefined) {
  return useQuery({
    queryKey: ['funnels', id],
    queryFn: () => api.get<Funnel>(`/api/funnels/${id}`),
    enabled: !!id,
  });
}

export function useCreateFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; steps: string[]; conversion_window_hours?: number }) =>
      api.post<Funnel>('/api/funnels', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funnels'] }),
  });
}

export function useUpdateFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; steps?: string[]; conversion_window_hours?: number }) =>
      api.put<Funnel>(`/api/funnels/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funnels'] }),
  });
}

export function useDeleteFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/funnels/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funnels'] }),
  });
}

export function useFunnelResults(id: string | undefined, segment?: string) {
  const params = segment ? `?segment=${segment}` : '';
  return useQuery({
    queryKey: ['funnels', id, 'results', segment],
    queryFn: () => api.get<FunnelResults>(`/api/funnels/${id}/results${params}`),
    enabled: !!id,
  });
}
