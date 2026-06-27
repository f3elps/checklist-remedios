export type ThemeSlug = 'verde' | 'azul' | 'violeta' | 'rosa' | 'ambar' | 'teal'

export const THEMES: { slug: ThemeSlug; label: string; primary: string }[] = [
  { slug: 'verde', label: 'Verde Cuidado', primary: 'hsl(160 60% 40%)' },
  { slug: 'azul', label: 'Azul Sereno', primary: 'hsl(212 72% 48%)' },
  { slug: 'violeta', label: 'Violeta', primary: 'hsl(262 52% 56%)' },
  { slug: 'rosa', label: 'Rosa', primary: 'hsl(338 68% 56%)' },
  { slug: 'ambar', label: 'Âmbar', primary: 'hsl(35 90% 48%)' },
  { slug: 'teal', label: 'Teal', primary: 'hsl(184 64% 40%)' },
]

const SLUGS = new Set(THEMES.map(t => t.slug))

export function isThemeSlug(v: unknown): v is ThemeSlug {
  return typeof v === 'string' && SLUGS.has(v as ThemeSlug)
}

export function applyTheme(root: HTMLElement, slug: ThemeSlug, dark: boolean): void {
  root.setAttribute('data-theme', slug)
  root.classList.toggle('dark', dark)
}
