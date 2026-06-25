import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MedicationForm } from './MedicationForm'

describe('MedicationForm', () => {
  it('exige o nome', async () => {
    render(<MedicationForm onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument()
  })

  it('envia schedule_config de vezes_por_dia', async () => {
    const onSubmit = vi.fn()
    render(<MedicationForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Dipirona')
    await userEvent.type(screen.getByLabelText(/unidade/i), 'comprimido')
    await userEvent.clear(screen.getByLabelText(/dose por tomada/i))
    await userEvent.type(screen.getByLabelText(/dose por tomada/i), '1')
    await userEvent.clear(screen.getByLabelText(/vezes por dia/i))
    await userEvent.type(screen.getByLabelText(/vezes por dia/i), '2')
    await userEvent.clear(screen.getByLabelText(/estoque atual/i))
    await userEvent.type(screen.getByLabelText(/estoque atual/i), '20')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Dipirona', unit: 'comprimido', dose_amount: 1,
      schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 }, stock_quantity: 20,
    })
  })
})
