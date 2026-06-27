import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const isPushSupported = vi.fn(() => true)
const getActiveSubscription = vi.fn().mockResolvedValue(null)
const subscribeToPush = vi.fn().mockResolvedValue({})
const unsubscribeFromPush = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/push', () => ({
  isPushSupported: () => isPushSupported(),
  getActiveSubscription: () => getActiveSubscription(),
  subscribeToPush: (k: string) => subscribeToPush(k),
  unsubscribeFromPush: () => unsubscribeFromPush(),
}))

import { usePushSubscription } from './usePushSubscription'

beforeEach(() => {
  vi.clearAllMocks()
  isPushSupported.mockReturnValue(true)
  getActiveSubscription.mockResolvedValue(null)
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'testkey')
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
})

describe('usePushSubscription', () => {
  it('enable() pede permissão, inscreve e marca subscribed', async () => {
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok = false
    await act(async () => { ok = await result.current.enable() })
    expect(ok).toBe(true)
    expect(subscribeToPush).toHaveBeenCalledWith('testkey')
    expect(result.current.subscribed).toBe(true)
  })

  it('enable() retorna false se a permissão for negada', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok = true
    await act(async () => { ok = await result.current.enable() })
    expect(ok).toBe(false)
    expect(subscribeToPush).not.toHaveBeenCalled()
  })

  it('disable() desinscreve e zera subscribed', async () => {
    getActiveSubscription.mockResolvedValue({ endpoint: 'x' })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.subscribed).toBe(true))
    await act(async () => { await result.current.disable() })
    expect(unsubscribeFromPush).toHaveBeenCalled()
    expect(result.current.subscribed).toBe(false)
  })

  it('supported=false quando o browser não suporta', async () => {
    isPushSupported.mockReturnValue(false)
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(false)
  })
})
