import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PersonalizationCampaign {
  id: string;
  customer_id: string;
  name: string;
  type: 'BANNER' | 'MODAL' | 'TOOLTIP' | 'INLINE';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  targeting_rules: {
    operator: string;
    conditions: Array<{
      property: string;
      operator: string;
      value: any;
    }>;
  };
  content: {
    headline?: string;
    body?: string;
    cta_text?: string;
    cta_url?: string;
    image_url?: string;
    theme?: string;
    position?: string;
  };
  display_rules: {
    trigger?: string;
    url_match?: string;
    url_pattern?: string;
    frequency?: string;
    delay_seconds?: number;
  };
  priority: number;
  created_at: string;
  updated_at: string;
  activated_at?: string;
}

export function usePersonalizationCampaigns() {
  return useQuery({
    queryKey: ['personalization-campaigns'],
    queryFn: () => api.get<PersonalizationCampaign[]>('/api/personalization-campaigns'),
  });
}

export function useCreatePersonalizationCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      type: 'BANNER' | 'MODAL' | 'TOOLTIP' | 'INLINE';
      targeting_rules?: any;
      content?: any;
      display_rules?: any;
      priority?: number;
    }) =>
      api.post<PersonalizationCampaign>('/api/personalization-campaigns', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personalization-campaigns'] }),
  });
}

export function useUpdatePersonalizationCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; type?: string; status?: string; targeting_rules?: any; content?: any; display_rules?: any; priority?: number }) =>
      api.put<PersonalizationCampaign>(`/api/personalization-campaigns/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personalization-campaigns'] }),
  });
}

export function useDeletePersonalizationCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/personalization-campaigns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personalization-campaigns'] }),
  });
}

export async function logPersonalizationImpression(campaignId: string, trackedUserId: string, url?: string) {
  return api.post('/api/personalization/impression', { campaign_id: campaignId, tracked_user_id: trackedUserId, url });
}

export async function logPersonalizationClick(campaignId: string, trackedUserId: string, url?: string) {
  return api.post('/api/personalization/click', { campaign_id: campaignId, tracked_user_id: trackedUserId, url });
}