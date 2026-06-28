import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renderiza um SVG decorativo que herda a cor via currentColor', () => {
    const { container } = render(<Logo className="h-7 w-7 text-primary" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // decorativa: não expõe role/label próprios (o texto visível dá o nome)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('h-7', 'w-7', 'text-primary')
    // o coração herda a cor do tema
    expect(container.querySelector('path')).toHaveAttribute('fill', 'currentColor')
  })
})
