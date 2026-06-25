import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } },
}))

describe('Login', () => {
  it('mostra erro de validação quando e-mail é inválido', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'invalido')
    await userEvent.type(screen.getByLabelText(/senha/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(await screen.findByText(/e-mail inválido/i)).toBeInTheDocument()
  })
})
