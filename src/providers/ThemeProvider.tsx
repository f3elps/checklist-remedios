import { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, isThemeSlug, type ThemeSlug } from '@/lib/theme'

type ThemeState = {
  theme: ThemeSlug; dark: boolean
  setTheme: (s: ThemeSlug) => void; setDark: (d: boolean) => void
}
const ThemeContext = createContext<ThemeState | null>(null)

function readInitial(): { theme: ThemeSlug; dark: boolean } {
  const t = localStorage.getItem('cuidi.theme')
  const d = localStorage.getItem('cuidi.dark')
  return { theme: isThemeSlug(t) ? t : 'verde', dark: d === 'true' }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [{ theme, dark }, setState] = useState(readInitial)

  useEffect(() => {
    applyTheme(document.documentElement, theme, dark)
    localStorage.setItem('cuidi.theme', theme)
    localStorage.setItem('cuidi.dark', String(dark))
  }, [theme, dark])

  return (
    <ThemeContext.Provider value={{
      theme, dark,
      setTheme: (s) => setState(prev => ({ ...prev, theme: s })),
      setDark: (d) => setState(prev => ({ ...prev, dark: d })),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
