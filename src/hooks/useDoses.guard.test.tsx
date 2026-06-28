import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const upsert = vi.fn().mockResolvedValue({ error: null })
const getUser = vi.fn().mockResolvedValue({ data: { user: null } })
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert,
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    })),
    auth: { getUser: () => getUser() },
  },
}))

import { useMarkDose } from './useDoses'
import type { Medication } from '@/lib/medications'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const med = { id: 'm1', dose_amount: 1, stock_quantity: 10 } as Medication

describe('useMarkDose sem usuário', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejeita e não faz upsert quando não há usuário', async () => {
    const { result } = renderHook(() => useMarkDose(), { wrapper })
    await expect(
      result.current.mutateAsync({
        medication: med,
        scheduledAt: '2026-06-27T11:00:00.000Z',
        action: 'tomado',
      }),
    ).rejects.toThrow()
    expect(upsert).not.toHaveBeenCalled()
  })
})
