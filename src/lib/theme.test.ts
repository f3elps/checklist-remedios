import { describe, it, expect } from 'vitest'
import { applyTheme, isThemeSlug, THEMES } from './theme'

describe('theme', () => {
  it('lista 6 temas com verde como primeiro', () => {
    expect(THEMES.map(t => t.slug)).toEqual(['verde','azul','violeta','rosa','ambar','teal'])
  })

  it('valida slugs', () => {
    expect(isThemeSlug('verde')).toBe(true)
    expect(isThemeSlug('roxo')).toBe(false)
    expect(isThemeSlug(null)).toBe(false)
  })

  it('aplica data-theme e classe dark no elemento', () => {
    const el = document.createElement('html')
    applyTheme(el, 'azul', true)
    expect(el.getAttribute('data-theme')).toBe('azul')
    expect(el.classList.contains('dark')).toBe(true)

    applyTheme(el, 'verde', false)
    expect(el.getAttribute('data-theme')).toBe('verde')
    expect(el.classList.contains('dark')).toBe(false)
  })

  it('cada tema tem uma cor primary em hsl', () => {
    for (const t of THEMES) {
      expect(t.primary).toMatch(/^hsl\(/)
    }
    expect(THEMES.find((t) => t.slug === 'verde')?.primary).toBe('hsl(160 60% 40%)')
  })
})
