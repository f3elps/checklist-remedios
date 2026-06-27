import { supabase } from '@/lib/supabase'

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  )
}

// Converte a chave pública VAPID (base64url) no Uint8Array que o PushManager espera.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('Push não suportado neste navegador.')
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }))
  await saveSubscription(sub)
  return sub
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getActiveSubscription()
  if (!sub) return
  await removeSubscription(sub.endpoint)
  await sub.unsubscribe()
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const { data: u, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const user_id = u.user?.id
  if (!user_id) throw new Error('Sem usuário autenticado para salvar a subscription.')
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id, endpoint: sub.endpoint, keys: json.keys }, { onConflict: 'endpoint' })
  if (error) throw error
}

async function removeSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
