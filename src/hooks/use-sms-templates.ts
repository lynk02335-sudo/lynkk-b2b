import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface SmsTemplate {
  id: string;
  customer_id: string;
  name: string;
  body?: string;
  content?: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export function useSmsTemplates() {
  return useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => api.get<SmsTemplate[]>('/api/sms-templates'),
  });
}

export function useCreateSmsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; body: string; variables?: string[] }) =>
      api.post<SmsTemplate>('/api/sms-templates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sms-templates'] }),
  });
}

export function useUpdateSmsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; body?: string; variables?: string[] }) =>
      api.put<SmsTemplate>(`/api/sms-templates/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sms-templates'] }),
  });
}

export function useDeleteSmsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/sms-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sms-templates'] }),
  });
}

export async function sendSms(data: {
  to: string;
  message?: string;
  template_id?: string;
  tracked_user_email?: string;
}) {
  return api.post<{ success: boolean; sid: string }>('/api/sms/send', data);
}