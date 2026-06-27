import { describe, it, expect } from 'vitest'
import { dayKeyLocal, groupDosesByDay, heatLevel, lastNDays, summarize } from './history'
import type { Dose } from '@/lib/doses'

const dose = (over: Partial<Dose>): Dose => ({
  id: 'd', medication_id: 'm', user_id: 'u', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'tomado', taken_at: null, created_at: '', ...over,
})

describe('dayKeyLocal', () => {
  it('retorna yyyy-MM-dd', () => {
    expect(dayKeyLocal('2026-06-25T11:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('heatLevel', () => {
  it('mapeia tomados para 0..4', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(2)).toBe(1)
    expect(heatLevel(3)).toBe(2)
    expect(heatLevel(8)).toBe(4)
    expect(heatLevel(20)).toBe(4)
  })
})

describe('lastNDays', () => {
  it('gera n dias consecutivos terminando no dia informado, crescente', () => {
    expect(lastNDays('2026-06-25', 3)).toEqual(['2026-06-23', '2026-06-24', '2026-06-25'])
  })
})

describe('groupDosesByDay + summarize', () => {
  const doses = [
    dose({ status: 'tomado' }),
    dose({ status: 'tomado' }),
    dose({ status: 'pulado' }),
  ]
  it('agrupa contagens por dia', () => {
    const m = groupDosesByDay(doses)
    const day = dayKeyLocal('2026-06-25T11:00:00.000Z')
    expect(m.get(day)).toEqual({ tomado: 2, pulado: 1, perdido: 0, total: 3 })
  })
  it('resume taken/skipped/activeDays', () => {
    expect(summarize(doses)).toEqual({ taken: 2, skipped: 1, activeDays: 1 })
  })
})
