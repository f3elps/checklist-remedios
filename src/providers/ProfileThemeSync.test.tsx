import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const setTheme = vi.fn()
const setDark = vi.fn()
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'verde', dark: false, setTheme, setDark }),
}))
const useProfileMock = vi.fn()
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => useProfileMock() }))

import { ProfileThemeSync } from './ProfileThemeSync'

describe('ProfileThemeSync', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aplica o tema do perfil quando ele difere do atual', async () => {
    useProfileMock.mockReturnValue({ data: { theme_color: 'rosa', dark_mode: true } })
    render(<ProfileThemeSync />)
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('rosa')
      expect(setDark).toHaveBeenCalledWith(true)
    })
  })

  it('não faz nada sem perfil', () => {
    useProfileMock.mockReturnValue({ data: null })
    render(<ProfileThemeSync />)
    expect(setTheme).not.toHaveBeenCalled()
    expect(setDark).not.toHaveBeenCalled()
  })
})
