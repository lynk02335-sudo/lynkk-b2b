import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PushTemplate {
  id: string;
  customer_id: string;
  name: string;
  title: string;
  body: string;
  icon_url?: string;
  cta_url?: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export function usePushTemplates() {
  return useQuery({
    queryKey: ['push-templates'],
    queryFn: () => api.get<PushTemplate[]>('/api/push-templates'),
  });
}

export function useCreatePushTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; title: string; body: string; icon_url?: string; cta_url?: string; variables?: string[] }) =>
      api.post<PushTemplate>('/api/push-templates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-templates'] }),
  });
}

export function useUpdatePushTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; title?: string; body?: string; icon_url?: string; cta_url?: string; variables?: string[] }) =>
      api.put<PushTemplate>(`/api/push-templates/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-templates'] }),
  });
}

export function useDeletePushTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/push-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-templates'] }),
  });
}