import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Dose } from '@/lib/doses'
import type { Medication } from '@/lib/medications'

function dayRange(dayISO: string): { start: string; end: string } {
  const start = new Date(`${dayISO}T00:00:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function useDosesForDay(dayISO: string) {
  return useQuery({
    queryKey: ['doses', dayISO],
    queryFn: async (): Promise<Dose[]> => {
      const { start, end } = dayRange(dayISO)
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .gte('scheduled_at', start)
        .lt('scheduled_at', end)
      if (error) throw error
      return (data ?? []) as Dose[]
    },
  })
}

export function useDosesRange(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['doses', 'range', startISO, endISO],
    queryFn: async (): Promise<Dose[]> => {
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .gte('scheduled_at', startISO)
        .lt('scheduled_at', endISO)
        .order('scheduled_at')
      if (error) throw error
      return (data ?? []) as Dose[]
    },
  })
}

export function useMarkDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      medication, scheduledAt, action,
    }: {
      medication: Medication
      scheduledAt: string
      action: 'tomado' | 'pulado'
    }): Promise<void> => {
      const { data: userData } = await supabase.auth.getUser()
      const user_id = userData.user?.id
      if (!user_id) throw new Error('Sem usuário autenticado.')
      const taken_at = action === 'tomado' ? new Date().toISOString() : null
      const { error } = await supabase
        .from('doses')
        .upsert(
          {
            medication_id: medication.id,
            user_id,
            scheduled_at: scheduledAt,
            status: action,
            taken_at,
          },
          { onConflict: 'medication_id,scheduled_at' },
        )
      if (error) throw error

      if (action === 'tomado') {
        const newStock = Math.max(0, medication.stock_quantity - medication.dose_amount)
        const { error: e2 } = await supabase
          .from('medications')
          .update({ stock_quantity: newStock })
          .eq('id', medication.id)
        if (e2) throw e2
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}
