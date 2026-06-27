import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DoseSlot } from '@/lib/doses'

const STATUS_LABEL: Record<string, string> = {
  tomado: 'Tomado',
  pulado: 'Pulado',
  perdido: 'Perdido',
}

export function DoseItem({
  slot, onTake, onSkip,
}: {
  slot: DoseSlot
  onTake: (s: DoseSlot) => void
  onSkip: (s: DoseSlot) => void
}) {
  const pending = slot.status === 'pendente'
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{slot.time}</span>
            {slot.overdue && (
              <span className="text-xs rounded-sm bg-amber-soft text-amber px-1.5 py-0.5">Atrasado</span>
            )}
          </div>
          <p className="truncate">{slot.medication.name}</p>
          <p className="text-muted text-sm">{slot.medication.dose_amount} {slot.medication.unit}</p>
        </div>
        <div className="shrink-0">
          {pending ? (
            <div className="flex gap-2">
              <Button onClick={() => onTake(slot)}>Tomei</Button>
              <Button variant="secondary" onClick={() => onSkip(slot)}>Pular</Button>
            </div>
          ) : (
            <span className="text-muted text-sm">{STATUS_LABEL[slot.status] ?? slot.status}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
