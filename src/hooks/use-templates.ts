import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WorkflowTemplate } from '@/types';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<WorkflowTemplate[]>('/api/workflow-templates'),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkflowTemplate>) =>
      api.post<WorkflowTemplate>('/api/workflow-templates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUseTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/workflow-templates/${id}/use`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
