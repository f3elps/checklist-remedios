// Lógica pura do motor de notificações — SEM globais Deno (roda no Vitest e é
// importada pela Edge Function `tick`). Espelha src/lib/doses.ts + medications.ts,
// adaptada para fuso horário nomeado no servidor (Intl.DateTimeFormat).

export type ScheduleType = 'vezes_por_dia' | 'de_x_em_x_horas' | 'horarios_fixos'

export interface MedRow {
  id: string
  user_id: string
  name: string
  unit: string
  dose_amount: number
  schedule_type: ScheduleType
  schedule_config: Record<string, unknown>
  stock_quantity: number
  active: boolean
}

export interface DoseRow {
  id: string
  medication_id: string
  user_id: string
  scheduled_at: string
  status: string
}

export interface PlannedDose {
  medication_id: string
  user_id: string
  scheduled_at: string
}

function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function dosesPerDay(type: ScheduleType, cfg: Record<string, unknown>): number {
  if (type === 'vezes_por_dia' && typeof cfg.per_day === 'number') return Math.max(0, Math.floor(cfg.per_day))
  if (type === 'de_x_em_x_horas' && typeof cfg.interval_hours === 'number') {
    const h = cfg.interval_hours
    return h > 0 ? Math.floor(24 / h) : 0
  }
  if (type === 'horarios_fixos' && Array.isArray(cfg.times)) return cfg.times.length
  return 0
}

export function doseTimesForDay(type: ScheduleType, cfg: Record<string, unknown>): string[] {
  if (type === 'horarios_fixos' && Array.isArray(cfg.times)) {
    return [...(cfg.times as string[])].sort()
  }
  const n = dosesPerDay(type, cfg)
  if (n <= 0) return []
  if (type === 'de_x_em_x_horas' && typeof cfg.interval_hours === 'number') {
    return Array.from({ length: n }, (_, k) => minutesToHHMM((8 + k * cfg.interval_hours) * 60)).sort()
  }
  // vezes_por_dia: espalha entre 08:00 (480) e 20:00 (1200)
  if (n === 1) return ['08:00']
  const start = 480
  const step = (1200 - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => minutesToHHMM(Math.round(start + i * step)))
}

// Offset (ms) de um fuso nomeado para um instante.
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const h = map.hour === 24 ? 0 : map.hour
  const dayAdj = map.hour === 24 ? 1 : 0
  const asUTC = Date.UTC(map.year, map.month - 1, map.day + dayAdj, h, map.minute, map.second)
  return asUTC - date.getTime()
}

// Instante UTC de um horário de parede (dateISO + hh:mm) num fuso nomeado.
export function zonedTimeToUtc(dateISO: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const offset = tzOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset)
}

function localDateISO(date: Date, timeZone: string): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function localDaysBetween(start: Date, end: Date, timeZone: string): string[] {
  const endISO = localDateISO(end, timeZone)
  const days: string[] = []
  let cursor = localDateISO(start, timeZone)
  for (let guard = 0; guard < 7; guard++) {
    days.push(cursor)
    if (cursor === endISO) break
    cursor = addDaysISO(cursor, 1)
  }
  return days
}

export function materializeWindow(
  meds: MedRow[],
  now: Date,
  hoursAhead: number,
  timeZone: string,
): PlannedDose[] {
  const utcEnd = new Date(now.getTime() + hoursAhead * 3600_000)
  const days = localDaysBetween(now, utcEnd, timeZone)
  const lastDay = days[days.length - 1]
  const nextDay = addDaysISO(lastDay, 1)
  const end = zonedTimeToUtc(nextDay, '00:00', timeZone)
  const out: PlannedDose[] = []
  for (const m of meds) {
    if (!m.active) continue
    const times = doseTimesForDay(m.schedule_type, m.schedule_config)
    for (const day of days) {
      for (const hhmm of times) {
        const at = zonedTimeToUtc(day, hhmm, timeZone)
        if (at >= now && at < end) {
          out.push({ medication_id: m.id, user_id: m.user_id, scheduled_at: at.toISOString() })
        }
      }
    }
  }
  return out
}

export function selectDue(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[] {
  const t = now.getTime()
  const tol = toleranceMin * 60_000
  return doses.filter((d) => {
    if (d.status !== 'pendente') return false
    const at = new Date(d.scheduled_at).getTime()
    return at <= t && at > t - tol
  })
}

export function selectMissed(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[] {
  const cutoff = now.getTime() - toleranceMin * 60_000
  return doses.filter((d) => d.status === 'pendente' && new Date(d.scheduled_at).getTime() <= cutoff)
}

export function daysOfStock(m: MedRow): number | null {
  const perDay = m.dose_amount * dosesPerDay(m.schedule_type, m.schedule_config)
  if (perDay <= 0) return null
  return Math.floor(m.stock_quantity / perDay)
}

export function isLowStock(m: MedRow, threshold = 7): boolean {
  const d = daysOfStock(m)
  return d !== null && d <= threshold
}
