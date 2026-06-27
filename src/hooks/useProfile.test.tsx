import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'u1', theme_color: 'azul' }, error: null })
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })), auth: { getUser: () => getUser() } },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca a linha do usuário em profiles', async () => {
    const { useProfile } = await import('./useProfile')
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 'u1', theme_color: 'azul' })
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })
})
