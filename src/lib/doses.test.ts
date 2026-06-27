import { describe, it, expect } from 'vitest'
import { minutesToHHMM, doseTimesForDay, scheduledAtFor } from './doses'

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
