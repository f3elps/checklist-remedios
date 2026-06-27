import { groupDosesByDay, heatLevel, lastNDays } from '@/lib/history'
import type { Dose } from '@/lib/doses'

const OPACITY: Record<number, number> = { 1: 0.35, 2: 0.55, 3: 0.78, 4: 1 }

export function AdherenceHeatmap({
  doses, endDayISO, days = 91,
}: {
  doses: Dose[]
  endDayISO: string
  days?: number
}) {
  const byDay = groupDosesByDay(doses)
  const keys = lastNDays(endDayISO, days)

  return (
    <div data-testid="heatmap" className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto">
      {keys.map((day) => {
        const a = byDay.get(day)
        const tomado = a?.tomado ?? 0
        const level = heatLevel(tomado)
        const style =
          level === 0
            ? { background: 'var(--surface-2)' }
            : { background: 'var(--primary)', opacity: OPACITY[level] }
        return (
          <div
            key={day}
            data-cell
            title={`${day}: ${tomado} tomada(s)`}
            className="h-3.5 w-3.5 rounded-sm"
            style={style}
          />
        )
      })}
    </div>
  )
}
