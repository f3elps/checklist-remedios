import { describe, it, expect } from 'vitest'
import {
  zonedTimeToUtc,
  doseTimesForDay,
  materializeWindow,
  selectDue,
  selectMissed,
  isLowStock,
  type MedRow,
  type DoseRow,
} from './schedule.ts'

const baseMed: MedRow = {
  id: 'm1',
  user_id: 'u1',
  name: 'Losartana',
  unit: 'comprimido',
  dose_amount: 1,
  schedule_type: 'horarios_fixos',
  schedule_config: { times: ['08:00', '20:00'] },
  stock_quantity: 30,
  active: true,
}

describe('zonedTimeToUtc', () => {
  it('08:00 em America/Sao_Paulo (UTC-3) vira 11:00Z', () => {
    expect(zonedTimeToUtc('2026-06-27', '08:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-06-27T11:00:00.000Z',
    )
  })
})

describe('doseTimesForDay', () => {
  it('horarios_fixos retorna os horários ordenados', () => {
    expect(doseTimesForDay('horarios_fixos', { times: ['20:00', '08:00'] })).toEqual([
      '08:00',
      '20:00',
    ])
  })
  it('de_x_em_x_horas a cada 8h a partir das 08:00', () => {
    expect(doseTimesForDay('de_x_em_x_horas', { interval_hours: 8 })).toEqual([
      '08:00',
      '16:00',
      '00:00',
    ].sort())
  })
})

describe('materializeWindow', () => {
  it('gera as doses dentro da janela, no fuso do usuário', () => {
    // now = 2026-06-27T10:00:00Z = 07:00 local SP; janela 24h
    const now = new Date('2026-06-27T10:00:00.000Z')
    const planned = materializeWindow([baseMed], now, 24, 'America/Sao_Paulo')
    const isos = planned.map((p) => p.scheduled_at)
    expect(isos).toContain('2026-06-27T11:00:00.000Z') // 08:00 local hoje
    expect(isos).toContain('2026-06-27T23:00:00.000Z') // 20:00 local hoje
    // 08:00 de amanhã (28) também cabe em 24h
    expect(isos).toContain('2026-06-28T11:00:00.000Z')
    // nada antes de `now`
    expect(isos.every((iso) => new Date(iso) >= now)).toBe(true)
  })
})

describe('selectDue / selectMissed', () => {
  const now = new Date('2026-06-27T12:00:00.000Z')
  const mk = (id: string, mins: number, status = 'pendente'): DoseRow => ({
    id,
    medication_id: 'm1',
    user_id: 'u1',
    scheduled_at: new Date(now.getTime() + mins * 60_000).toISOString(),
    status,
  })
  it('due = pendente, já passou da hora, dentro da tolerância', () => {
    const doses = [mk('a', -10), mk('b', -200), mk('c', 30), mk('d', -10, 'tomado')]
    const due = selectDue(doses, now, 120).map((d) => d.id)
    expect(due).toEqual(['a'])
  })
  it('missed = pendente, passou da tolerância', () => {
    const doses = [mk('a', -10), mk('b', -200), mk('c', -200, 'tomado')]
    const missed = selectMissed(doses, now, 120).map((d) => d.id)
    expect(missed).toEqual(['b'])
  })
})

describe('isLowStock', () => {
  it('true quando faltam ≤ 7 dias', () => {
    // 2 doses/dia × 1 comp = 2/dia; estoque 10 → 5 dias
    expect(isLowStock({ ...baseMed, stock_quantity: 10 })).toBe(true)
  })
  it('false quando há folga', () => {
    expect(isLowStock({ ...baseMed, stock_quantity: 60 })).toBe(false) // 30 dias
  })
})
