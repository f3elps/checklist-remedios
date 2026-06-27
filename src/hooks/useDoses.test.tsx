import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDosesForDay, useMarkDose, useDosesRange } from './useDoses'
import type { Medication } from '@/lib/medications'
import { supabase } from '@/lib/supabase'

// The vi.mock factory is hoisted, so we cannot reference variables declared
// in the module scope inside it. Instead we create mocks inside the factory
// and access them via the mocked module import.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}))

// Typed handle to the mocked supabase singleton
const mockedSupabase = vi.mocked(supabase)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// ---------------------------------------------------------------------------
// useDosesForDay (existing read test — kept passing)
// ---------------------------------------------------------------------------
describe('useDosesForDay', () => {
  const lt = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null })
  const gte = vi.fn(() => ({ lt }))
  const select = vi.fn(() => ({ gte }))

  beforeEach(() => {
    vi.clearAllMocks()
    mockedSupabase.from.mockReturnValue({ select } as never)
  })

  it('busca doses no intervalo do dia', async () => {
    const { result } = renderHook(() => useDosesForDay('2026-06-25'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'd1' }])
    expect(select).toHaveBeenCalled()
    expect(gte).toHaveBeenCalledWith('scheduled_at', expect.any(String))
    expect(lt).toHaveBeenCalledWith('scheduled_at', expect.any(String))
  })
})

// ---------------------------------------------------------------------------
// useMarkDose (new characterisation tests — guard stock-decrement behaviour)
// ---------------------------------------------------------------------------
describe('useMarkDose', () => {
  const med: Medication = {
    id: 'm1', user_id: 'u1', name: 'Dipirona', unit: 'comprimido',
    dose_amount: 2, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
    stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
  }

  // Per-test mock objects — reset in beforeEach
  let upsert: ReturnType<typeof vi.fn>
  let eq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    upsert = vi.fn().mockResolvedValue({ error: null })
    eq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq }))

    ;(mockedSupabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: 'u1' } },
    })
    mockedSupabase.from.mockImplementation((table: string) =>
      table === 'doses' ? ({ upsert } as never) : ({ update } as never)
    )
  })

  it('tomado: upsert com user_id/status/taken_at + onConflict, e baixa de estoque 1x', async () => {
    const { result } = renderHook(() => useMarkDose(), { wrapper })
    await result.current.mutateAsync({
      medication: med,
      scheduledAt: '2026-06-25T11:00:00.000Z',
      action: 'tomado',
    })

    expect(upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = upsert.mock.calls[0]
    expect(payload).toMatchObject({
      medication_id: 'm1',
      user_id: 'u1',
      status: 'tomado',
      scheduled_at: '2026-06-25T11:00:00.000Z',
    })
    expect(payload.taken_at).toEqual(expect.any(String))
    expect(opts).toEqual({ onConflict: 'medication_id,scheduled_at' })
    // stock: 10 - 2 = 8
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ stock_quantity: 8 })
  })

  it('pulado: taken_at null e NÃO mexe no estoque', async () => {
    const { result } = renderHook(() => useMarkDose(), { wrapper })
    await result.current.mutateAsync({
      medication: med,
      scheduledAt: '2026-06-25T11:00:00.000Z',
      action: 'pulado',
    })

    const [payload] = upsert.mock.calls[0]
    expect(payload).toMatchObject({ status: 'pulado', taken_at: null })
    expect(update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// useDosesRange (range query test)
// ---------------------------------------------------------------------------
describe('useDosesRange', () => {
  const order = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null })
  const lt = vi.fn(() => ({ order }))
  const gte = vi.fn(() => ({ lt }))
  const select = vi.fn(() => ({ gte }))

  beforeEach(() => {
    vi.clearAllMocks()
    mockedSupabase.from.mockReturnValue({ select } as never)
  })

  it('busca doses no intervalo informado', async () => {
    const { result } = renderHook(() => useDosesRange('2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'd1' }])
    expect(gte).toHaveBeenCalledWith('scheduled_at', '2026-06-01T00:00:00.000Z')
    expect(lt).toHaveBeenCalledWith('scheduled_at', '2026-07-01T00:00:00.000Z')
  })
})
