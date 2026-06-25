import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Medication, MedicationInput } from '@/lib/medications'

const KEY = ['medications'] as const

export function useMedications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as Medication[]
    },
  })
}

export function useCreateMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MedicationInput): Promise<Medication> => {
      const { data: userData } = await supabase.auth.getUser()
      const user_id = userData.user?.id
      const { data, error } = await supabase
        .from('medications')
        .insert({ ...input, user_id })
        .select()
        .single()
      if (error) throw error
      return data as Medication
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<MedicationInput> }): Promise<Medication> => {
      const { data, error } = await supabase
        .from('medications')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Medication
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('medications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
