import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setTheme = vi.fn()
const setDark = vi.fn()
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'verde', dark: false, setTheme, setDark }),
}))
const mutate = vi.fn().mockResolvedValue(undefined)
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { theme_color: 'verde', dark_mode: false, email_enabled: true, push_enabled: true } }),
  useUpdateProfile: () => ({ mutateAsync: mutate, isPending: false }),
}))

import Configuracoes from './Configuracoes'

describe('Configuracoes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trocar de tema aplica e persiste', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('button', { name: /tema rosa/i }))
    expect(setTheme).toHaveBeenCalledWith('rosa')
    expect(mutate).toHaveBeenCalledWith({ theme_color: 'rosa' })
  })
})
