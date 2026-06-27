import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  display_name: string | null
  theme_color: string
  dark_mode: boolean
  timezone: string
  email_enabled: boolean
  push_enabled: boolean
  created_at: string
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) return null
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (error) throw error
      return (data as Profile | null) ?? null
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Profile>): Promise<void> => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      const { error } = await supabase.from('profiles').update(values).eq('id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
