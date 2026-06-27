import { toast } from 'sonner'
import { useMedications } from '@/hooks/useMedications'
import { useDosesForDay, useMarkDose } from '@/hooks/useDoses'
import { buildTodaySlots, type DoseSlot } from '@/lib/doses'
import { DoseItem } from '@/components/today/DoseItem'
import { LowStockBanner } from '@/components/today/LowStockBanner'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Hoje() {
  const day = todayISO()
  const { data: meds, isLoading: loadingMeds } = useMedications()
  const { data: doses, isLoading: loadingDoses } = useDosesForDay(day)
  const mark = useMarkDose()

  const slots = buildTodaySlots(meds ?? [], doses ?? [], day, Date.now())

  async function act(slot: DoseSlot, action: 'tomado' | 'pulado') {
    try {
      await mark.mutateAsync({ medication: slot.medication, scheduledAt: slot.scheduled_at, action })
      toast.success(action === 'tomado' ? 'Marcado como tomado!' : 'Dose pulada.')
    } catch {
      toast.error('Não foi possível salvar.')
    }
  }

  const loading = loadingMeds || loadingDoses

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Hoje</h1>
      <LowStockBanner meds={meds ?? []} />

      {loading && <p className="text-muted">Carregando…</p>}
      {!loading && slots.length === 0 && (
        <p className="text-muted">Nenhuma dose para hoje. Cadastre um remédio na aba "Remédios".</p>
      )}

      <div className="space-y-3">
        {slots.map((s) => (
          <DoseItem
            key={`${s.medication.id}@${s.scheduled_at}`}
            slot={s}
            onTake={(slot) => act(slot, 'tomado')}
            onSkip={(slot) => act(slot, 'pulado')}
          />
        ))}
      </div>
    </section>
  )
}
