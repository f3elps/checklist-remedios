import { useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useTheme } from '@/providers/ThemeProvider'
import { isThemeSlug } from '@/lib/theme'

export function ProfileThemeSync(): null {
  const { data: profile } = useProfile()
  const { theme, dark, setTheme, setDark } = useTheme()

  useEffect(() => {
    if (!profile) return
    if (isThemeSlug(profile.theme_color) && profile.theme_color !== theme) setTheme(profile.theme_color)
    if (typeof profile.dark_mode === 'boolean' && profile.dark_mode !== dark) setDark(profile.dark_mode)
    // Reconcilia apenas quando o perfil muda (DB -> provider); não depende de theme/dark para evitar laços.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return null
}
