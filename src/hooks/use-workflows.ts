import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCustomer } from './useCustomer';

export type Workflow = {
  id: string;
  customer_id: string;
  name: string;
  type: 'trial_recovery' | 'onboarding_activation' | 'silent_churn' | 'custom';
  status: string | null;
  is_active: boolean;
  inactive_days_trigger: number;
  whatsapp_message: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

export function useWorkflows() {
  const { customer } = useCustomer();

  return useQuery({
    queryKey: ['workflows', customer?.id],
    queryFn: async (): Promise<Workflow[]> => {
      if (!customer?.id) return [];

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!customer?.id,
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: async (): Promise<Workflow | null> => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async (data: {
      type: 'trial_recovery' | 'onboarding_activation' | 'silent_churn' | 'custom';
      name: string;
      config?: Record<string, unknown>;
      inactive_days_trigger?: number;
      whatsapp_message?: string;
    }) => {
      if (!customer?.id) throw new Error('No customer found - please refresh and try again');

      const { data: workflow, error } = await supabase
        .from('workflows')
        .insert({
          customer_id: customer.id,
          name: data.name,
          type: data.type,
          is_active: false,
          inactive_days_trigger: data.inactive_days_trigger || 5,
          whatsapp_message: data.whatsapp_message || null,
          config: data.config || {},
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', customer?.id] });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Workflow> & { config?: Record<string, unknown> } }) => {
      const { data: workflow, error } = await supabase
        .from('workflows')
        .update({
          ...data,
          config: data.config ? { ...data.config } : undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', customer?.id] });
    },
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['workflows', customer?.id] }),
  });
}

export function usePauseWorkflow() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['workflows', customer?.id] }),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', customer?.id] });
    },
  });
}