export type ScheduleType = 'vezes_por_dia' | 'de_x_em_x_horas' | 'horarios_fixos'

export type ScheduleConfig =
  | { per_day: number }
  | { interval_hours: number }
  | { times: string[] }

export interface Medication {
  id: string
  user_id: string
  name: string
  unit: string
  dose_amount: number
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  stock_quantity: number
  start_date: string
  active: boolean
  notes: string | null
  created_at: string
}

export type MedicationInput = Pick<
  Medication,
  'name' | 'unit' | 'dose_amount' | 'schedule_type' | 'schedule_config' | 'stock_quantity' | 'start_date' | 'notes'
>

export function dosesPerDay(type: ScheduleType, cfg: ScheduleConfig): number {
  if (type === 'vezes_por_dia' && 'per_day' in cfg) return Math.max(0, Math.floor(cfg.per_day))
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) {
    const h = cfg.interval_hours
    return h > 0 ? Math.floor(24 / h) : 0
  }
  if (type === 'horarios_fixos' && 'times' in cfg) return cfg.times.length
  return 0
}

export function dailyConsumption(doseAmount: number, type: ScheduleType, cfg: ScheduleConfig): number {
  return doseAmount * dosesPerDay(type, cfg)
}

export function daysLeft(
  stock: number,
  doseAmount: number,
  type: ScheduleType,
  cfg: ScheduleConfig,
): number | null {
  const perDay = dailyConsumption(doseAmount, type, cfg)
  if (perDay <= 0) return null
  return Math.floor(stock / perDay)
}
