import { format, subDays, parseISO } from 'date-fns'
import type { Dose } from '@/lib/doses'

export function dayKeyLocal(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd')
}

export interface DayAdherence { tomado: number; pulado: number; perdido: number; total: number }

export function groupDosesByDay(doses: Dose[]): Map<string, DayAdherence> {
  const map = new Map<string, DayAdherence>()
  for (const d of doses) {
    const key = dayKeyLocal(d.scheduled_at)
    const cur = map.get(key) ?? { tomado: 0, pulado: 0, perdido: 0, total: 0 }
    if (d.status === 'tomado') cur.tomado++
    else if (d.status === 'pulado') cur.pulado++
    else if (d.status === 'perdido') cur.perdido++
    cur.total++
    map.set(key, cur)
  }
  return map
}

export function heatLevel(tomado: number): 0 | 1 | 2 | 3 | 4 {
  if (tomado <= 0) return 0
  return Math.min(4, Math.ceil(tomado / 2)) as 1 | 2 | 3 | 4
}

export function lastNDays(endDayISO: string, n: number): string[] {
  const end = parseISO(`${endDayISO}T12:00:00`)
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(format(subDays(end, i), 'yyyy-MM-dd'))
  }
  return days
}

export interface Summary { taken: number; skipped: number; activeDays: number }

export function summarize(doses: Dose[]): Summary {
  const byDay = groupDosesByDay(doses)
  let taken = 0
  let skipped = 0
  let activeDays = 0
  for (const a of byDay.values()) {
    taken += a.tomado
    skipped += a.pulado
    if (a.tomado > 0) activeDays++
  }
  return { taken, skipped, activeDays }
}
