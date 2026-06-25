import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMedications } from './useMedications'

const order = vi.fn().mockResolvedValue({
  data: [{ id: '1', name: 'Dipirona' }], error: null,
})
const eq = vi.fn(() => ({ order }))
const select = vi.fn(() => ({ eq }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMedications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca os medicamentos ativos via supabase', async () => {
    const { result } = renderHook(() => useMedications(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '1', name: 'Dipirona' }])
    expect(select).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('active', true)
  })
})
