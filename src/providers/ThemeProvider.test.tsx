import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, dark, setTheme, setDark } = useTheme()
  return (
    <div>
      <span data-testid="t">{theme}</span>
      <span data-testid="d">{String(dark)}</span>
      <button onClick={() => setTheme('rosa')}>rosa</button>
      <button onClick={() => setDark(true)}>dark</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Mock localStorage if not available
    const store: Record<string, string> = {}
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = String(value) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
      key: (index: number) => Object.keys(store)[index] || null,
      length: Object.keys(store).length,
    }
    vi.stubGlobal('localStorage', mockStorage)
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('default verde claro e reflete no <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('t').textContent).toBe('verde')
    expect(document.documentElement.getAttribute('data-theme')).toBe('verde')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('troca tema/modo, aplica no <html> e persiste', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('rosa'))
    await userEvent.click(screen.getByText('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('rosa')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('cuidi.theme')).toBe('rosa')
    expect(localStorage.getItem('cuidi.dark')).toBe('true')
  })
})
