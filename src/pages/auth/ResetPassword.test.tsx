import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const updateUser = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: (a: unknown) => updateUser(a) } },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import ResetPassword from './ResetPassword'

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra "voltar para o login" quando o link expirou', async () => {
    updateUser.mockResolvedValue({ error: { message: 'expired' } })
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/nova senha/i), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByRole('link', { name: /voltar para o login/i })).toBeInTheDocument()
  })
})
