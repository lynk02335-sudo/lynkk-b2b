import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCustomer } from './useCustomer';

export type User = {
  id: string;
  email: string;
  name: string | null;
  first_seen: string;
  last_seen: string;
  last_action: string | null;
  status: 'active' | 'at_risk' | 'cold';
  metadata: Record<string, unknown> | null;
  customer_id: string;
};

export function useUsers() {
  const { customer } = useCustomer();

  return useQuery({
    queryKey: ['users', customer?.id],
    queryFn: async (): Promise<User[]> => {
      if (!customer?.id) return [];

      const { data, error } = await supabase
        .from('tracked_users')
        .select('*')
        .eq('customer_id', customer.id)
        .order('last_seen', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!customer?.id,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async (): Promise<User | null> => {
      const { data, error } = await supabase
        .from('tracked_users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateUserState() {
  const queryClient = useQueryClient();
  const { customer } = useCustomer();

  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const { data, error } = await supabase
        .from('tracked_users')
        .update({ status: state })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', customer?.id] });
    },
  });
}