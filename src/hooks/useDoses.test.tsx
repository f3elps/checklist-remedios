import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDosesForDay } from './useDoses'

const lt = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null })
const gte = vi.fn(() => ({ lt }))
const select = vi.fn(() => ({ gte }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useDosesForDay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca doses no intervalo do dia', async () => {
    const { result } = renderHook(() => useDosesForDay('2026-06-25'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'd1' }])
    expect(select).toHaveBeenCalled()
    expect(gte).toHaveBeenCalledWith('scheduled_at', expect.any(String))
    expect(lt).toHaveBeenCalledWith('scheduled_at', expect.any(String))
  })
})
