import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthProvider'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

function Probe() {
  const { loading, user } = useAuth()
  return <div>{loading ? 'carregando' : user ? 'logado' : 'deslogado'}</div>
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('começa carregando e resolve para deslogado quando não há sessão', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument())
  })
})
