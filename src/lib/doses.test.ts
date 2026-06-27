import { describe, it, expect } from 'vitest'
import { buildTodaySlots, minutesToHHMM, doseTimesForDay, scheduledAtFor } from './doses'
import type { Medication } from '@/lib/medications'

describe('minutesToHHMM', () => {
  it('formata com zero à esquerda', () => {
    expect(minutesToHHMM(480)).toBe('08:00')
    expect(minutesToHHMM(0)).toBe('00:00')
    expect(minutesToHHMM(1230)).toBe('20:30')
  })
})

describe('doseTimesForDay', () => {
  it('horarios_fixos usa e ordena os horários', () => {
    expect(doseTimesForDay('horarios_fixos', { times: ['20:00', '08:00'] })).toEqual(['08:00', '20:00'])
  })
  it('vezes_por_dia espalha entre 08:00 e 20:00', () => {
    expect(doseTimesForDay('vezes_por_dia', { per_day: 1 })).toEqual(['08:00'])
    expect(doseTimesForDay('vezes_por_dia', { per_day: 2 })).toEqual(['08:00', '20:00'])
    expect(doseTimesForDay('vezes_por_dia', { per_day: 3 })).toEqual(['08:00', '14:00', '20:00'])
  })
  it('de_x_em_x_horas gera dosesPerDay horários a partir das 08:00', () => {
    // interval 8 => 3 doses: 08:00, 16:00, 00:00 -> ordenado
    expect(doseTimesForDay('de_x_em_x_horas', { interval_hours: 8 })).toEqual(['00:00', '08:00', '16:00'])
  })
})

describe('scheduledAtFor', () => {
  it('é estável: mesma data+hora => mesmo ISO', () => {
    const a = scheduledAtFor('2026-06-25', '08:00')
    const b = scheduledAtFor('2026-06-25', '08:00')
    expect(a).toBe(b)
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
  ...over,
})

describe('buildTodaySlots', () => {
  const day = '2026-06-25'

  it('gera um slot por horário, pendente quando não há dose', () => {
    const nowMs = new Date(`${day}T07:00:00`).getTime() // antes de tudo
    const slots = buildTodaySlots([med()], [], day, nowMs)
    expect(slots).toHaveLength(2) // per_day: 2 => 08:00 e 20:00
    expect(slots.map((s) => s.time)).toEqual(['08:00', '20:00'])
    expect(slots.every((s) => s.status === 'pendente')).toBe(true)
    expect(slots.every((s) => s.overdue === false)).toBe(true)
  })

  it('marca overdue quando o horário já passou e ainda está pendente', () => {
    const nowMs = new Date(`${day}T09:00:00`).getTime() // depois das 08:00
    const slots = buildTodaySlots([med()], [], day, nowMs)
    expect(slots[0].overdue).toBe(true)  // 08:00
    expect(slots[1].overdue).toBe(false) // 20:00
  })

  it('reflete o status da dose existente e não marca overdue', () => {
    const m = med()
    const at8 = scheduledAtFor(day, '08:00')
    const doses = [{
      id: 'd1', medication_id: m.id, user_id: 'u', scheduled_at: at8,
      status: 'tomado' as const, taken_at: at8, created_at: '',
    }]
    const nowMs = new Date(`${day}T09:00:00`).getTime()
    const slots = buildTodaySlots([m], doses, day, nowMs)
    expect(slots[0].status).toBe('tomado')
    expect(slots[0].overdue).toBe(false) // tomado não é overdue
    expect(slots[0].doseId).toBe('d1')
  })

  it('ignora medicamentos inativos', () => {
    expect(buildTodaySlots([med({ active: false })], [], day, Date.parse(`${day}T07:00:00`))).toHaveLength(0)
  })
})
