import { useCallback, useEffect, useState } from 'react'
import {
  isPushSupported,
  getActiveSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push'

export interface PushState {
  supported: boolean
  subscribed: boolean
  loading: boolean
  enable: () => Promise<boolean>
  disable: () => Promise<void>
}

export function usePushSubscription(): PushState {
  const supported = isPushSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(supported)

  useEffect(() => {
    let alive = true
    if (!supported) {
      setLoading(false)
      return
    }
    getActiveSubscription()
      .then((sub) => {
        if (alive) setSubscribed(!!sub)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [supported])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported) return false
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!key) throw new Error('VITE_VAPID_PUBLIC_KEY ausente — configure no .env.local')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false
    await subscribeToPush(key)
    setSubscribed(true)
    return true
  }, [supported])

  const disable = useCallback(async (): Promise<void> => {
    await unsubscribeFromPush()
    setSubscribed(false)
  }, [])

  return { supported, subscribed, loading, enable, disable }
}
