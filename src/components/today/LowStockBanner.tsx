import { AlertTriangle } from 'lucide-react'
import { daysLeft, type Medication } from '@/lib/medications'

export function LowStockBanner({ meds }: { meds: Medication[] }) {
  const baixos = meds
    .map((m) => ({ m, dl: daysLeft(m.stock_quantity, m.dose_amount, m.schedule_type, m.schedule_config) }))
    .filter((x) => x.dl !== null && x.dl <= 7)
  if (baixos.length === 0) return null
  return (
    <div className="rounded bg-amber-soft text-text p-3 flex gap-2">
      <AlertTriangle className="text-amber shrink-0" size={18} />
      <div className="text-sm">
        <p className="font-semibold text-amber">Estoque baixo</p>
        <ul className="list-disc pl-4">
          {baixos.map(({ m, dl }) => (
            <li key={m.id}>{m.name}: acaba em {dl} {dl === 1 ? 'dia' : 'dias'}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
