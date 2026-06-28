import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const eq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn(() => ({ eq }))
const getUser = vi.fn().mockResolvedValue({ data: { user: null } })
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update })), auth: { getUser: () => getUser() } },
}))

import { useUpdateProfile } from './useProfile'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useUpdateProfile sem usuário', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejeita e não chama o update quando não há usuário', async () => {
    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    await expect(result.current.mutateAsync({ theme_color: 'rosa' })).rejects.toThrow()
    expect(update).not.toHaveBeenCalled()
  })
})
