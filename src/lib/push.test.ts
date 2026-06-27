import { describe, it, expect, vi, beforeEach } from 'vitest'

const eqDelete = vi.fn().mockResolvedValue({ error: null })
const del = vi.fn(() => ({ eq: eqDelete }))
const upsert = vi.fn().mockResolvedValue({ error: null })
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ upsert, delete: del })),
    auth: { getUser: () => getUser() },
  },
}))

import {
  urlBase64ToUint8Array,
  subscribeToPush,
  unsubscribeFromPush,
} from './push'

const subscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
}
const pushManager = {
  getSubscription: vi.fn().mockResolvedValue(null),
  subscribe: vi.fn().mockResolvedValue(subscription),
}

beforeEach(() => {
  vi.clearAllMocks()
  pushManager.getSubscription.mockResolvedValue(null)
  Object.defineProperty(window, 'PushManager', { value: function () {}, configurable: true })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager }) },
    configurable: true,
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url para bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AAAA'))).toEqual([0, 0, 0])
  })
})

describe('subscribeToPush', () => {
  it('inscreve com userVisibleOnly e grava a subscription', async () => {
    await subscribeToPush('AAAA')
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        endpoint: 'https://push.example/abc',
        keys: { p256dh: 'p', auth: 'a' },
      }),
      { onConflict: 'endpoint' },
    )
  })

  it('reusa a subscription existente (não re-inscreve)', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription)
    await subscribeToPush('AAAA')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalled()
  })
})

describe('unsubscribeFromPush', () => {
  it('remove da tabela e desinscreve no browser', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription)
    await unsubscribeFromPush()
    expect(del).toHaveBeenCalled()
    expect(eqDelete).toHaveBeenCalledWith('endpoint', 'https://push.example/abc')
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('é no-op sem subscription ativa', async () => {
    pushManager.getSubscription.mockResolvedValue(null)
    await unsubscribeFromPush()
    expect(del).not.toHaveBeenCalled()
  })
})
