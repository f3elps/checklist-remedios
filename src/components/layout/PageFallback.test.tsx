import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageFallback } from './PageFallback'

describe('PageFallback', () => {
  it('mostra um estado de carregamento acessível', () => {
    render(<PageFallback />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
  })
})
