import { dosesPerDay, type ScheduleType, type ScheduleConfig } from '@/lib/medications'

export type DoseStatus = 'pendente' | 'tomado' | 'pulado' | 'perdido'

export interface Dose {
  id: string
  medication_id: string
  user_id: string
  scheduled_at: string
  status: DoseStatus
  taken_at: string | null
  created_at: string
}

export function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function doseTimesForDay(type: ScheduleType, cfg: ScheduleConfig): string[] {
  if (type === 'horarios_fixos' && 'times' in cfg) {
    return [...cfg.times].sort()
  }
  const n = dosesPerDay(type, cfg)
  if (n <= 0) return []
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) {
    const times = Array.from({ length: n }, (_, k) => minutesToHHMM((8 + k * cfg.interval_hours) * 60))
    return times.sort()
  }
  // vezes_por_dia: espalha entre 08:00 (480) e 20:00 (1200)
  if (n === 1) return ['08:00']
  const start = 480
  const end = 1200
  const step = (end - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => minutesToHHMM(Math.round(start + i * step)))
}

export function scheduledAtFor(dayISO: string, hhmm: string): string {
  return new Date(`${dayISO}T${hhmm}:00`).toISOString()
}
