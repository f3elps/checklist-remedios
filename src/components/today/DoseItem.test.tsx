import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoseItem } from './DoseItem'
import type { DoseSlot } from '@/lib/doses'
import type { Medication } from '@/lib/medications'

const med: Medication = {
  id: 'm1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
}
const slot = (over: Partial<DoseSlot> = {}): DoseSlot => ({
  medication: med, time: '08:00', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'pendente', overdue: false, doseId: null, ...over,
})

describe('DoseItem', () => {
  it('pendente mostra Tomei/Pular e dispara onTake', async () => {
    const onTake = vi.fn()
    render(<DoseItem slot={slot()} onTake={onTake} onSkip={vi.fn()} />)
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('Dipirona')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tomei/i }))
    expect(onTake).toHaveBeenCalled()
  })

  it('overdue mostra selo Atrasado', () => {
    render(<DoseItem slot={slot({ overdue: true })} onTake={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/atrasado/i)).toBeInTheDocument()
  })

  it('tomado não mostra botões', () => {
    render(<DoseItem slot={slot({ status: 'tomado' })} onTake={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /tomei/i })).not.toBeInTheDocument()
    expect(screen.getByText(/tomado/i)).toBeInTheDocument()
  })
})
