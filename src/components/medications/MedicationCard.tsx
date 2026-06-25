import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { daysLeft, type Medication, type ScheduleType, type ScheduleConfig } from '@/lib/medications'

function posologia(type: ScheduleType, cfg: ScheduleConfig): string {
  if (type === 'vezes_por_dia' && 'per_day' in cfg) return `${cfg.per_day}x por dia`
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) return `de ${cfg.interval_hours} em ${cfg.interval_hours} horas`
  if (type === 'horarios_fixos' && 'times' in cfg) return `às ${cfg.times.join(', ')}`
  return ''
}

export function MedicationCard({
  med, onEdit, onDelete,
}: {
  med: Medication
  onEdit: (m: Medication) => void
  onDelete: (m: Medication) => void
}) {
  const dl = daysLeft(med.stock_quantity, med.dose_amount, med.schedule_type, med.schedule_config)
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{med.name}</h3>
          <p className="text-muted text-sm">{med.dose_amount} {med.unit} · {posologia(med.schedule_type, med.schedule_config)}</p>
          <p className="text-sm mt-1">
            {med.stock_quantity} {med.unit} ·{' '}
            {dl === null ? 'sem consumo definido' : <span className={dl <= 7 ? 'text-amber' : ''}>acaba em {dl} dias</span>}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button aria-label="Editar" className="text-muted p-1" onClick={() => onEdit(med)}><Pencil size={18} /></button>
          <button aria-label="Excluir" className="text-muted p-1" onClick={() => onDelete(med)}><Trash2 size={18} /></button>
        </div>
      </div>
    </Card>
  )
}
