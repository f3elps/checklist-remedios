import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdherenceHeatmap } from './AdherenceHeatmap'
import type { Dose } from '@/lib/doses'

const dose = (over: Partial<Dose>): Dose => ({
  id: 'd', medication_id: 'm', user_id: 'u', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'tomado', taken_at: null, created_at: '', ...over,
})

describe('AdherenceHeatmap', () => {
  it('renderiza uma célula por dia da janela', () => {
    render(<AdherenceHeatmap doses={[]} endDayISO="2026-06-25" days={7} />)
    const grid = screen.getByTestId('heatmap')
    expect(grid.querySelectorAll('[data-cell]')).toHaveLength(7)
  })

  it('a célula de um dia com doses tem title com a contagem', () => {
    render(<AdherenceHeatmap doses={[dose({}), dose({})]} endDayISO="2026-06-25" days={7} />)
    expect(screen.getByTitle(/2 tomada/i)).toBeInTheDocument()
  })
})
