import { describe, it, expect } from 'vitest'
import { dosesPerDay, dailyConsumption, daysLeft } from './medications'

describe('dosesPerDay', () => {
  it('vezes_por_dia usa per_day', () => {
    expect(dosesPerDay('vezes_por_dia', { per_day: 3 })).toBe(3)
  })
  it('de_x_em_x_horas = floor(24 / interval)', () => {
    expect(dosesPerDay('de_x_em_x_horas', { interval_hours: 8 })).toBe(3)
    expect(dosesPerDay('de_x_em_x_horas', { interval_hours: 5 })).toBe(4)
  })
  it('horarios_fixos usa o tamanho da lista', () => {
    expect(dosesPerDay('horarios_fixos', { times: ['08:00', '20:00'] })).toBe(2)
  })
})

describe('dailyConsumption', () => {
  it('multiplica dose pela quantidade de doses no dia', () => {
    expect(dailyConsumption(2, 'vezes_por_dia', { per_day: 3 })).toBe(6)
  })
})

describe('daysLeft', () => {
  it('floor(estoque / consumo diário)', () => {
    // estoque 20, dose 1, 2x/dia => consumo 2/dia => 10 dias
    expect(daysLeft(20, 1, 'vezes_por_dia', { per_day: 2 })).toBe(10)
    // estoque 13, consumo 2/dia => floor(6.5) = 6
    expect(daysLeft(13, 1, 'vezes_por_dia', { per_day: 2 })).toBe(6)
  })
  it('retorna null quando o consumo diário é zero', () => {
    expect(daysLeft(10, 0, 'vezes_por_dia', { per_day: 2 })).toBeNull()
    expect(daysLeft(10, 1, 'de_x_em_x_horas', { interval_hours: 0 as unknown as number })).toBeNull()
  })
})
