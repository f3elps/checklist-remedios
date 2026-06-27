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
  useProfile: () => ({
    data: { theme_color: 'verde', dark_mode: false, email_enabled: true, push_enabled: true },
  }),
  useUpdateProfile: () => ({ mutateAsync: mutate, isPending: false }),
}))
const enable = vi.fn().mockResolvedValue(true)
const disable = vi.fn().mockResolvedValue(undefined)
const pushState = { supported: true, subscribed: false, loading: false, enable, disable }
vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => pushState,
}))

import Configuracoes from './Configuracoes'

describe('Configuracoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushState.supported = true
    pushState.subscribed = false
  })

  it('trocar de tema aplica e persiste', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('button', { name: /tema rosa/i }))
    expect(setTheme).toHaveBeenCalledWith('rosa')
    expect(mutate).toHaveBeenCalledWith({ theme_color: 'rosa' })
  })

  it('ligar o push pede permissão (enable) e persiste push_enabled', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('switch', { name: /lembretes por push/i }))
    expect(enable).toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith({ push_enabled: true })
  })

  it('desabilita o switch de push quando não há suporte', () => {
    pushState.supported = false
    render(<Configuracoes />)
    expect(screen.getByRole('switch', { name: /lembretes por push/i })).toBeDisabled()
  })
})
