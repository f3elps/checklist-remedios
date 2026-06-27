/// <reference lib="WebWorker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

// Precache do app shell (a lista é injetada pelo vite-plugin-pwa no build).
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

// Recebe o push enviado pela Edge Function `tick` e mostra a notificação.
self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {}
  try {
    data = (event.data?.json() as PushPayload) ?? {}
  } catch {
    data = {}
  }
  const title = data.title ?? 'Cuidi'
  const options: NotificationOptions = {
    body: data.body ?? 'Hora do seu remédio.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    data: { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Ao tocar na notificação, foca uma janela aberta (navegando) ou abre uma nova.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matching = clients.find((c) => c.url === url)
      if (matching) return (matching as WindowClient).focus()
      const open = clients.find((c) => 'focus' in c)
      if (open) {
        ;(open as WindowClient).navigate(url)
        return (open as WindowClient).focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
