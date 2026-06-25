export type ThemeSlug = 'verde' | 'azul' | 'violeta' | 'rosa' | 'ambar' | 'teal'

export const THEMES: { slug: ThemeSlug; label: string }[] = [
  { slug: 'verde', label: 'Verde Cuidado' },
  { slug: 'azul', label: 'Azul Sereno' },
  { slug: 'violeta', label: 'Violeta' },
  { slug: 'rosa', label: 'Rosa' },
  { slug: 'ambar', label: 'Âmbar' },
  { slug: 'teal', label: 'Teal' },
]

const SLUGS = new Set(THEMES.map(t => t.slug))

export function isThemeSlug(v: unknown): v is ThemeSlug {
  return typeof v === 'string' && SLUGS.has(v as ThemeSlug)
}

export function applyTheme(root: HTMLElement, slug: ThemeSlug, dark: boolean): void {
  root.setAttribute('data-theme', slug)
  root.classList.toggle('dark', dark)
}
