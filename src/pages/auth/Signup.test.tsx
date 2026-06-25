import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Signup from './Signup'

const signUp = vi.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null })
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a) } } }))

describe('Signup', () => {
  it('chama signUp com e-mail, senha e display_name', async () => {
    render(<MemoryRouter><Signup /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Maria')
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'maria@ex.com')
    await userEvent.type(screen.getByLabelText(/senha/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }))
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'maria@ex.com', password: '123456',
      options: expect.objectContaining({ data: { display_name: 'Maria' } }),
    }))
  })
})
