import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MedicationCard } from './MedicationCard'
import type { Medication } from '@/lib/medications'

const med: Medication = {
  id: '1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 20, start_date: '2026-01-01', active: true, notes: null, created_at: '',
}

describe('MedicationCard', () => {
  it('mostra nome e estoque com dias restantes', () => {
    render(<MedicationCard med={med} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Dipirona')).toBeInTheDocument()
    // 20 / (1*2) = 10 dias
    expect(screen.getByText(/acaba em 10 dias/i)).toBeInTheDocument()
    expect(screen.getByText(/20 comprimido/i)).toBeInTheDocument()
  })
})
