# Cuidi — Plano de Implementação 6: Motor de Notificações

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar lembretes de dose e aviso de estoque baixo por **Web Push** (canal principal) e **e-mail** (fallback garantido, via Resend), acionados por uma Edge Function `tick` (Deno) agendada por `pg_cron`, com dedupe via `notification_log`.

**Architecture:** O cliente registra um **service worker custom** (vite-plugin-pwa `injectManifest`) que recebe `push` e abre o app no `notificationclick`. Uma lib de cliente (`src/lib/push.ts`) faz subscribe/unsubscribe e grava/remove a subscription em `push_subscriptions`; um hook (`usePushSubscription`) liga isso ao toggle de push de Configurações. No servidor, a Edge Function `tick` materializa as doses das próximas 24–48h no fuso do usuário, seleciona as doses "na hora", dispara push + e-mail, marca as perdidas e (1×/dia) avisa estoque baixo — toda a **lógica pura** vive em `supabase/functions/_shared/schedule.ts`, testada no Vitest; a orquestração Deno (`tick/index.ts`) é entregue como arquivo e validada manualmente pelo usuário.

**Tech Stack:** (continuação) Vite + React 19 + TS, Tailwind 3.4, @supabase/supabase-js 2, TanStack Query 5, **vite-plugin-pwa 1.3 (injectManifest)** + **workbox-precaching** (novo), Web Push API + VAPID, **Edge Functions Deno** (`npm:web-push`, Resend REST), `pg_cron`/`pg_net`, Vitest + Testing Library.

## Global Constraints

- **Idioma da UI e das mensagens:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** Tailwind **3.4** (não 4); shadcn escrito **à mão** (Radix+cva); tokens Cuidi (`hsl()` completos) — **nunca** opacidade-no-token (`bg-x/NN`); usar `border-text` (não `border-foreground`). **Zod 4** → `z.number()` + `valueAsNumber:true` no RHF (não `z.coerce.number()`).
- **Custo zero:** Supabase free + Resend free + Web Push (VAPID, sem custo). Nada que exija plano pago.
- **Fuso:** todos os cálculos de horário no servidor usam `profiles.timezone` (default `America/Sao_Paulo`) via `Intl.DateTimeFormat` com timeZone nomeado — **nunca** offset fixo.
- **Idempotência:** índice único `(medication_id, scheduled_at)` (já existe) + `notification_log` garantem que materialização e avisos não dupliquem.
- **Segurança/RLS:** `push_subscriptions` e `notification_log` com RLS estrita por dono. A Edge Function usa a **service-role key** (bypassa RLS) e roda só no servidor; a service-role key **nunca** vai pro cliente.
- **Banco/Infra = manual do usuário:** migrations e a Edge Function são entregues como **arquivos**; o projeto Supabase do Cuidi (ref `jlfflxcsvncnwcfzgizw`) **não** está conectado à integração desta máquina. O usuário aplica migrations, gera VAPID, configura secrets, faz deploy da função e agenda o cron seguindo `supabase/functions/SETUP.md`.
- **Edge Function NÃO roda no Vitest:** `tick/index.ts` usa `Deno.env`, `npm:web-push` e o client service-role — fora do grafo do Vite/tsc. A **lógica pura** está isolada em `_shared/schedule.ts` (sem globais Deno) e essa SIM é testada no Vitest.
- **Commits:** um por task, mensagem em português, prefixo convencional.

---

## Estrutura de arquivos (criada/alterada)

```
supabase/migrations/0004_notifications.sql        # push_subscriptions + notification_log (+RLS) — NOVO (arquivo; aplicar = usuário)
src/lib/push.ts                                    # helpers de Web Push (subscribe/unsubscribe/save) — NOVO (TDD)
src/lib/push.test.ts
src/hooks/usePushSubscription.ts                   # hook que liga push.ts ao toggle — NOVO (TDD)
src/hooks/usePushSubscription.test.tsx
src/sw.ts                                           # service worker custom (push + notificationclick) — NOVO
vite.config.ts                                      # injectManifest + srcDir/filename
tsconfig.app.json                                   # exclui src/sw.ts do tsc -b
src/pages/Configuracoes.tsx                         # liga o toggle de push ao usePushSubscription
src/pages/Configuracoes.test.tsx                    # atualizado
supabase/functions/_shared/schedule.ts             # lógica pura (materializar/selecionar/estoque) — NOVO (testada no Vitest)
supabase/functions/_shared/schedule.test.ts        # testes Vitest da lógica pura
supabase/functions/tick/index.ts                   # Edge Function Deno (orquestração) — NOVO (não-Vitest)
supabase/cron.example.sql                           # snippet pg_cron+pg_net (placeholders) — NOVO
supabase/functions/SETUP.md                         # guia: VAPID, secrets, deploy, cron, teste — NOVO
.env.example                                        # + VITE_VAPID_PUBLIC_KEY
```

---

### Task 1: Migration `0004_notifications.sql` (push_subscriptions + notification_log)

**Files:**
- Create: `supabase/migrations/0004_notifications.sql`

**Interfaces:**
- Produces (no banco, após o usuário aplicar): tabela `push_subscriptions(id, user_id, endpoint UNIQUE, keys jsonb, created_at)` e `notification_log(id, user_id, medication_id?, dose_id?, type, channel, sent_at)`, ambas com RLS por dono. `push.ts` (Task 2) faz upsert em `push_subscriptions` com `onConflict: 'endpoint'`; `tick` (Task 7) insere em `notification_log`.

- [ ] **Step 1: Criar `supabase/migrations/0004_notifications.sql`**

```sql
-- Web Push: assinaturas do navegador por usuário (1 linha por endpoint/dispositivo)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,                         -- { p256dh, auth }
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Log de notificações enviadas (dedupe de lembretes e de estoque baixo)
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete cascade,
  dose_id uuid references public.doses(id) on delete cascade,
  type text not null check (type in ('lembrete_dose','estoque_baixo')),
  channel text not null check (channel in ('push','email')),
  sent_at timestamptz not null default now()
);

create index notification_log_dose_idx on public.notification_log (dose_id, type);
create index notification_log_med_type_sent_idx on public.notification_log (medication_id, type, sent_at);

alter table public.notification_log enable row level security;

-- O dono pode ler o próprio log; a escrita é feita pela Edge Function (service-role, bypassa RLS).
create policy "notification_log_select_own" on public.notification_log
  for select using (auth.uid() = user_id);
```

- [ ] **Step 2: Sanidade SQL (revisão visual)**

Conferir: FKs com `on delete cascade`, `endpoint` UNIQUE (alvo do upsert), RLS habilitada nas duas tabelas, `notification_log` sem policy de insert para usuário comum (só a service-role escreve). Não há como aplicar no banco aqui — aplicação é do usuário (SETUP.md, Task 8).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_notifications.sql
git commit -m "feat: migration push_subscriptions e notification_log (RLS)"
```

---

### Task 2: Lib de Web Push no cliente — `src/lib/push.ts` (TDD)

**Files:**
- Create: `src/lib/push.ts`, `src/lib/push.test.ts`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`); APIs do browser `navigator.serviceWorker`, `PushManager`.
- Produces:
  - `function isPushSupported(): boolean`
  - `function urlBase64ToUint8Array(base64String: string): Uint8Array`
  - `function getActiveSubscription(): Promise<PushSubscription | null>`
  - `function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription>` (subscribe + grava em `push_subscriptions`)
  - `function unsubscribeFromPush(): Promise<void>` (remove da tabela + `subscription.unsubscribe()`)

- [ ] **Step 1: Escrever o teste que falha** (`src/lib/push.test.ts`)

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/push.test.ts` → FAIL (módulo `./push` não existe).

- [ ] **Step 3: Implementar `src/lib/push.ts`**

```ts
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
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
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
  const { data: u } = await supabase.auth.getUser()
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/push.test.ts` → PASS (5 testes).

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/lib/push.ts src/lib/push.test.ts
git commit -m "feat: lib de Web Push (subscribe/unsubscribe + grava em push_subscriptions)"
```

---

### Task 3: Hook `usePushSubscription` (TDD)

**Files:**
- Create: `src/hooks/usePushSubscription.ts`, `src/hooks/usePushSubscription.test.tsx`

**Interfaces:**
- Consumes: `isPushSupported`, `getActiveSubscription`, `subscribeToPush`, `unsubscribeFromPush` (`@/lib/push`); `Notification.requestPermission`; `import.meta.env.VITE_VAPID_PUBLIC_KEY`.
- Produces: `interface PushState { supported: boolean; subscribed: boolean; loading: boolean; enable: () => Promise<boolean>; disable: () => Promise<void> }` e `function usePushSubscription(): PushState`. `enable()` retorna `false` se sem suporte ou permissão negada; lança se faltar a chave VAPID.

- [ ] **Step 1: Escrever o teste que falha** (`src/hooks/usePushSubscription.test.tsx`)

```tsx
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/usePushSubscription.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/hooks/usePushSubscription.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/usePushSubscription.test.tsx` → PASS (4 testes).

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/hooks/usePushSubscription.ts src/hooks/usePushSubscription.test.tsx
git commit -m "feat: hook usePushSubscription (liga push.ts ao toggle)"
```

---

### Task 4: Service Worker custom + `injectManifest` (push + notificationclick)

**Files:**
- Create: `src/sw.ts`
- Modify: `vite.config.ts`, `tsconfig.app.json`
- Install: `workbox-precaching`

**Interfaces:**
- Produces: SW que (a) faz precache do app shell (`self.__WB_MANIFEST`), (b) no evento `push` mostra a notificação com `title/body/url/tag` do payload JSON, (c) no `notificationclick` foca/abre o app na `url`. O build passa a usar `strategies: 'injectManifest'` compilando `src/sw.ts` → `dist/sw.js`.

- [ ] **Step 1: Instalar a dep do Workbox**

```bash
npm install -D workbox-precaching
```

- [ ] **Step 2: Criar `src/sw.ts`**

```ts
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
      for (const client of clients) {
        if ('focus' in client) {
          ;(client as WindowClient).navigate(url)
          return (client as WindowClient).focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 3: Excluir `src/sw.ts` do `tsc -b`** (`tsconfig.app.json`)

O SW usa o contexto WebWorker e `self.__WB_MANIFEST` — ele é compilado pelo vite-plugin-pwa (esbuild), não pelo `tsc -b`. Adicionar a chave `exclude` ao final do JSON (após `"include": ["src"]`):

```jsonc
  "include": ["src"],
  "exclude": ["src/sw.ts"]
```

(O arquivo passa a ser: `{ "compilerOptions": { ... }, "include": ["src"], "exclude": ["src/sw.ts"] }`.)

- [ ] **Step 4: Trocar para `injectManifest` em `vite.config.ts`**

Substituir o bloco `VitePWA({ ... })` por:

```ts
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'Cuidi',
        short_name: 'Cuidi',
        description: 'Gestão dos seus remédios, com lembretes e controle de estoque.',
        lang: 'pt-BR',
        theme_color: '#2aa179',
        background_color: '#fbfffe',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
```

(Só o objeto do plugin muda; o resto de `vite.config.ts` — `react()`, `resolve.alias`, `test` — fica igual.)

- [ ] **Step 5: Build e verificar o SW gerado**

```bash
npm run build
```

Esperado: build limpo. Conferir que o SW custom foi compilado e contém os handlers:

```bash
test -f dist/sw.js && grep -q "addEventListener" dist/sw.js && grep -q "showNotification" dist/sw.js && echo "SW OK"
```

Esperado: imprime `SW OK`.

- [ ] **Step 6: Rodar a suíte + commit**

```bash
npm run test
git add src/sw.ts vite.config.ts tsconfig.app.json package.json package-lock.json
git commit -m "feat: service worker custom (push + notificationclick) via injectManifest"
```

---

### Task 5: Ligar o toggle de push em `Configurações` (TDD)

**Files:**
- Modify: `src/pages/Configuracoes.tsx`, `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `usePushSubscription` (Task 3); o resto da página fica igual (`useTheme`, `useProfile`, `useUpdateProfile`, `THEMES`, `Switch`, `Card`, `toast`).
- Produces: o switch "Lembretes por push" reflete `push.subscribed` e, ao ligar, chama `push.enable()` → se ok, grava `push_enabled: true` e dá toast de sucesso; ao desligar, chama `push.disable()` e grava `push_enabled: false`. Quando `!push.supported`, o switch fica desabilitado com uma dica.

- [ ] **Step 1: Reescrever o teste** (`src/pages/Configuracoes.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setTheme = vi.fn()
const setDark = vi.fn()
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'verde', dark: false, setTheme, setDark }),
}))
const mutate = vi.fn().mockResolvedValue(undefined)
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    data: { theme_color: 'verde', dark_mode: false, email_enabled: true, push_enabled: true },
  }),
  useUpdateProfile: () => ({ mutateAsync: mutate, isPending: false }),
}))
const enable = vi.fn().mockResolvedValue(true)
const disable = vi.fn().mockResolvedValue(undefined)
const pushState = { supported: true, subscribed: false, loading: false, enable, disable }
vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => pushState,
}))

import Configuracoes from './Configuracoes'

describe('Configuracoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushState.supported = true
    pushState.subscribed = false
  })

  it('trocar de tema aplica e persiste', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('button', { name: /tema rosa/i }))
    expect(setTheme).toHaveBeenCalledWith('rosa')
    expect(mutate).toHaveBeenCalledWith({ theme_color: 'rosa' })
  })

  it('ligar o push pede permissão (enable) e persiste push_enabled', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('switch', { name: /lembretes por push/i }))
    expect(enable).toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith({ push_enabled: true })
  })

  it('desabilita o switch de push quando não há suporte', () => {
    pushState.supported = false
    render(<Configuracoes />)
    expect(screen.getByRole('switch', { name: /lembretes por push/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/Configuracoes.test.tsx` → FAIL (push ainda só grava a preferência).

- [ ] **Step 3: Atualizar `src/pages/Configuracoes.tsx`**

Adicionar o import e a função `togglePush`, e trocar o `<Switch>` de push. Diff conceitual (manter o resto do arquivo igual ao atual):

```tsx
import { usePushSubscription } from '@/hooks/usePushSubscription'
// ...dentro do componente, junto dos outros hooks:
  const push = usePushSubscription()

  async function togglePush(v: boolean) {
    try {
      if (v) {
        const ok = await push.enable()
        if (!ok) {
          toast.error('Permita as notificações no navegador para ativar o push.')
          return
        }
        await persist({ push_enabled: true })
        toast.success('Lembretes por push ativados.')
      } else {
        await push.disable()
        await persist({ push_enabled: false })
      }
    } catch {
      toast.error('Não foi possível atualizar o push.')
    }
  }
```

Substituir o bloco do switch de push pelo seguinte (na seção "Notificações"):

```tsx
        <div className="flex items-center justify-between">
          <div>
            <span>Lembretes por push</span>
            <p className="text-muted text-sm">
              {push.supported
                ? 'Avisos na hora da dose, mesmo com o app fechado.'
                : 'Seu navegador não suporta push. Instale o app na tela inicial.'}
            </p>
          </div>
          <Switch
            checked={push.subscribed}
            onCheckedChange={togglePush}
            disabled={!push.supported || push.loading}
            aria-label="Lembretes por push"
          />
        </div>
```

(O `pushOn` derivado de `profile?.push_enabled` deixa de ser usado pelo switch de push; pode remover a linha `const pushOn = ...` se ela ficar sem uso para não quebrar o `tsc` por `noUnusedLocals`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/pages/Configuracoes.test.tsx` → PASS (3 testes).

- [ ] **Step 5: Build + suíte + commit**

```bash
npm run build && npm run test
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: liga o toggle de push à subscription real (Configurações)"
```

---

### Task 6: Lógica pura da Edge Function — `_shared/schedule.ts` (TDD no Vitest)

**Files:**
- Create: `supabase/functions/_shared/schedule.ts`, `supabase/functions/_shared/schedule.test.ts`

**Interfaces:**
- Produces (sem nenhum global Deno; só `Date`/`Intl` — por isso roda no Vitest e é importável pelo `tick`):
  - tipos `ScheduleType`, `MedRow`, `DoseRow`, `PlannedDose`
  - `zonedTimeToUtc(dateISO: string, hhmm: string, timeZone: string): Date`
  - `doseTimesForDay(type: ScheduleType, cfg: Record<string, unknown>): string[]`
  - `materializeWindow(meds: MedRow[], now: Date, hoursAhead: number, timeZone: string): PlannedDose[]`
  - `selectDue(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[]`
  - `selectMissed(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[]`
  - `dosesPerDay(type: ScheduleType, cfg: Record<string, unknown>): number`
  - `daysOfStock(m: MedRow): number | null`
  - `isLowStock(m: MedRow, threshold?: number): boolean`
- Consumes: nada do projeto (cópia mínima/independente da lógica de `src/lib/doses.ts` + `src/lib/medications.ts`, adaptada para fuso nomeado no servidor — duplicação intencional pela fronteira Deno↔Vite).

- [ ] **Step 1: Escrever os testes que falham** (`supabase/functions/_shared/schedule.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import {
  zonedTimeToUtc,
  doseTimesForDay,
  materializeWindow,
  selectDue,
  selectMissed,
  isLowStock,
  type MedRow,
  type DoseRow,
} from './schedule.ts'

const baseMed: MedRow = {
  id: 'm1',
  user_id: 'u1',
  name: 'Losartana',
  unit: 'comprimido',
  dose_amount: 1,
  schedule_type: 'horarios_fixos',
  schedule_config: { times: ['08:00', '20:00'] },
  stock_quantity: 30,
  active: true,
}

describe('zonedTimeToUtc', () => {
  it('08:00 em America/Sao_Paulo (UTC-3) vira 11:00Z', () => {
    expect(zonedTimeToUtc('2026-06-27', '08:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-06-27T11:00:00.000Z',
    )
  })
})

describe('doseTimesForDay', () => {
  it('horarios_fixos retorna os horários ordenados', () => {
    expect(doseTimesForDay('horarios_fixos', { times: ['20:00', '08:00'] })).toEqual([
      '08:00',
      '20:00',
    ])
  })
  it('de_x_em_x_horas a cada 8h a partir das 08:00', () => {
    expect(doseTimesForDay('de_x_em_x_horas', { interval_hours: 8 })).toEqual([
      '08:00',
      '16:00',
      '00:00',
    ].sort())
  })
})

describe('materializeWindow', () => {
  it('gera as doses dentro da janela, no fuso do usuário', () => {
    // now = 2026-06-27T10:00:00Z = 07:00 local SP; janela 24h
    const now = new Date('2026-06-27T10:00:00.000Z')
    const planned = materializeWindow([baseMed], now, 24, 'America/Sao_Paulo')
    const isos = planned.map((p) => p.scheduled_at)
    expect(isos).toContain('2026-06-27T11:00:00.000Z') // 08:00 local hoje
    expect(isos).toContain('2026-06-27T23:00:00.000Z') // 20:00 local hoje
    // 08:00 de amanhã (28) também cabe em 24h
    expect(isos).toContain('2026-06-28T11:00:00.000Z')
    // nada antes de `now`
    expect(isos.every((iso) => new Date(iso) >= now)).toBe(true)
  })
})

describe('selectDue / selectMissed', () => {
  const now = new Date('2026-06-27T12:00:00.000Z')
  const mk = (id: string, mins: number, status = 'pendente'): DoseRow => ({
    id,
    medication_id: 'm1',
    user_id: 'u1',
    scheduled_at: new Date(now.getTime() + mins * 60_000).toISOString(),
    status,
  })
  it('due = pendente, já passou da hora, dentro da tolerância', () => {
    const doses = [mk('a', -10), mk('b', -200), mk('c', 30), mk('d', -10, 'tomado')]
    const due = selectDue(doses, now, 120).map((d) => d.id)
    expect(due).toEqual(['a'])
  })
  it('missed = pendente, passou da tolerância', () => {
    const doses = [mk('a', -10), mk('b', -200), mk('c', -200, 'tomado')]
    const missed = selectMissed(doses, now, 120).map((d) => d.id)
    expect(missed).toEqual(['b'])
  })
})

describe('isLowStock', () => {
  it('true quando faltam ≤ 7 dias', () => {
    // 2 doses/dia × 1 comp = 2/dia; estoque 10 → 5 dias
    expect(isLowStock({ ...baseMed, stock_quantity: 10 })).toBe(true)
  })
  it('false quando há folga', () => {
    expect(isLowStock({ ...baseMed, stock_quantity: 60 })).toBe(false) // 30 dias
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run supabase/functions/_shared/schedule.test.ts` → FAIL.

- [ ] **Step 3: Implementar `supabase/functions/_shared/schedule.ts`**

```ts
// Lógica pura do motor de notificações — SEM globais Deno (roda no Vitest e é
// importada pela Edge Function `tick`). Espelha src/lib/doses.ts + medications.ts,
// adaptada para fuso horário nomeado no servidor (Intl.DateTimeFormat).

export type ScheduleType = 'vezes_por_dia' | 'de_x_em_x_horas' | 'horarios_fixos'

export interface MedRow {
  id: string
  user_id: string
  name: string
  unit: string
  dose_amount: number
  schedule_type: ScheduleType
  schedule_config: Record<string, unknown>
  stock_quantity: number
  active: boolean
}

export interface DoseRow {
  id: string
  medication_id: string
  user_id: string
  scheduled_at: string
  status: string
}

export interface PlannedDose {
  medication_id: string
  user_id: string
  scheduled_at: string
}

function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function dosesPerDay(type: ScheduleType, cfg: Record<string, unknown>): number {
  if (type === 'vezes_por_dia' && typeof cfg.per_day === 'number') return Math.max(0, Math.floor(cfg.per_day))
  if (type === 'de_x_em_x_horas' && typeof cfg.interval_hours === 'number') {
    const h = cfg.interval_hours
    return h > 0 ? Math.floor(24 / h) : 0
  }
  if (type === 'horarios_fixos' && Array.isArray(cfg.times)) return cfg.times.length
  return 0
}

export function doseTimesForDay(type: ScheduleType, cfg: Record<string, unknown>): string[] {
  if (type === 'horarios_fixos' && Array.isArray(cfg.times)) {
    return [...(cfg.times as string[])].sort()
  }
  const n = dosesPerDay(type, cfg)
  if (n <= 0) return []
  if (type === 'de_x_em_x_horas' && typeof cfg.interval_hours === 'number') {
    return Array.from({ length: n }, (_, k) => minutesToHHMM((8 + k * cfg.interval_hours) * 60)).sort()
  }
  // vezes_por_dia: espalha entre 08:00 (480) e 20:00 (1200)
  if (n === 1) return ['08:00']
  const start = 480
  const step = (1200 - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => minutesToHHMM(Math.round(start + i * step)))
}

// Offset (ms) de um fuso nomeado para um instante.
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second)
  return asUTC - date.getTime()
}

// Instante UTC de um horário de parede (dateISO + hh:mm) num fuso nomeado.
export function zonedTimeToUtc(dateISO: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const offset = tzOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset)
}

function localDateISO(date: Date, timeZone: string): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function localDaysBetween(start: Date, end: Date, timeZone: string): string[] {
  const endISO = localDateISO(end, timeZone)
  const days: string[] = []
  let cursor = localDateISO(start, timeZone)
  for (let guard = 0; guard < 7; guard++) {
    days.push(cursor)
    if (cursor === endISO) break
    cursor = addDaysISO(cursor, 1)
  }
  return days
}

export function materializeWindow(
  meds: MedRow[],
  now: Date,
  hoursAhead: number,
  timeZone: string,
): PlannedDose[] {
  const end = new Date(now.getTime() + hoursAhead * 3600_000)
  const days = localDaysBetween(now, end, timeZone)
  const out: PlannedDose[] = []
  for (const m of meds) {
    if (!m.active) continue
    const times = doseTimesForDay(m.schedule_type, m.schedule_config)
    for (const day of days) {
      for (const hhmm of times) {
        const at = zonedTimeToUtc(day, hhmm, timeZone)
        if (at >= now && at <= end) {
          out.push({ medication_id: m.id, user_id: m.user_id, scheduled_at: at.toISOString() })
        }
      }
    }
  }
  return out
}

export function selectDue(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[] {
  const t = now.getTime()
  const tol = toleranceMin * 60_000
  return doses.filter((d) => {
    if (d.status !== 'pendente') return false
    const at = new Date(d.scheduled_at).getTime()
    return at <= t && at > t - tol
  })
}

export function selectMissed(doses: DoseRow[], now: Date, toleranceMin: number): DoseRow[] {
  const cutoff = now.getTime() - toleranceMin * 60_000
  return doses.filter((d) => d.status === 'pendente' && new Date(d.scheduled_at).getTime() <= cutoff)
}

export function daysOfStock(m: MedRow): number | null {
  const perDay = m.dose_amount * dosesPerDay(m.schedule_type, m.schedule_config)
  if (perDay <= 0) return null
  return Math.floor(m.stock_quantity / perDay)
}

export function isLowStock(m: MedRow, threshold = 7): boolean {
  const d = daysOfStock(m)
  return d !== null && d <= threshold
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run supabase/functions/_shared/schedule.test.ts` → PASS.

> Nota de fuso: o Brasil não tem horário de verão em 2026, então SP = UTC-3 fixo. A implementação via `Intl.DateTimeFormat` continua correta em fusos com DST.

- [ ] **Step 5: Suíte completa + commit**

```bash
npm run test
git add supabase/functions/_shared/schedule.ts supabase/functions/_shared/schedule.test.ts
git commit -m "feat: lógica pura do motor de notificações (schedule.ts) + testes"
```

> **Atenção (gate):** `npm run build` (tsc) **não** cobre `supabase/` (fora do `include`). A rede de segurança aqui são os testes Vitest acima (valores concretos). Não pular o Step 4.

---

### Task 7: Edge Function `tick` (Deno) — orquestração

**Files:**
- Create: `supabase/functions/tick/index.ts`

**Interfaces:**
- Consumes: `_shared/schedule.ts` (Task 6); `npm:@supabase/supabase-js@2`; `npm:web-push@3.6.7`; Resend REST API; secrets via `Deno.env`.
- Produces: handler `Deno.serve` que, a cada chamada (cron ~15min): materializa doses 0–48h, avisa as doses "na hora" (push + e-mail, dedupe via `notification_log`), marca perdidas, e 1×/dia avisa estoque baixo. Retorna um JSON de resumo.

> **Esta task não tem gate automático** (Deno fora do Vitest/tsc; `deno` não está instalado nesta máquina). É código entregue como arquivo, revisado com cuidado (revisão final opus) e testado pelo usuário via `SETUP.md` (Task 8). A lógica de horário/seleção já está coberta pelos testes da Task 6.

- [ ] **Step 1: Criar `supabase/functions/tick/index.ts`**

```ts
// Edge Function (Deno) — NÃO roda no Vitest (usa Deno.env, npm:web-push e o client service-role).
// Toda a lógica pura (fuso/seleção/estoque) está em ../_shared/schedule.ts (testada no Vitest).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  materializeWindow,
  selectDue,
  selectMissed,
  isLowStock,
  type MedRow,
  type DoseRow,
} from '../_shared/schedule.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:cuidi@exemplo.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Cuidi <onboarding@resend.dev>'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const WINDOW_HOURS = 48
const DUE_TOLERANCE_MIN = 120 // marca "perdido" e para de avisar 2h após a hora

interface ProfileRow {
  id: string
  timezone: string
  email_enabled: boolean
  push_enabled: boolean
}
interface PushSubRow {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, text }),
  })
}

async function pushTo(subs: PushSubRow[], payload: unknown): Promise<number> {
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }
  return sent
}

Deno.serve(async () => {
  const now = new Date()
  const summary = { materialized: 0, pushed: 0, emailed: 0, missed: 0, lowStock: 0 }

  const { data: medsData } = await admin.from('medications').select('*').eq('active', true)
  const { data: profsData } = await admin.from('profiles').select('id, timezone, email_enabled, push_enabled')
  const meds = (medsData ?? []) as MedRow[]
  const profById = new Map((profsData ?? []).map((p: ProfileRow) => [p.id, p]))
  const medById = new Map(meds.map((m) => [m.id, m]))

  // 1) Materializa doses 0–48h por remédio, no fuso do dono.
  for (const m of meds) {
    const tz = profById.get(m.user_id)?.timezone ?? 'America/Sao_Paulo'
    const planned = materializeWindow([m], now, WINDOW_HOURS, tz)
    if (planned.length) {
      const { error } = await admin
        .from('doses')
        .upsert(planned.map((p) => ({ ...p, status: 'pendente' })), {
          onConflict: 'medication_id,scheduled_at',
          ignoreDuplicates: true,
        })
      if (!error) summary.materialized += planned.length
    }
  }

  // 2) Doses "na hora" (pendentes, dentro da tolerância) → avisa.
  const fromISO = new Date(now.getTime() - DUE_TOLERANCE_MIN * 60_000).toISOString()
  const toISO = new Date(now.getTime() + 60_000).toISOString()
  const { data: windowDoses } = await admin
    .from('doses')
    .select('*')
    .eq('status', 'pendente')
    .gte('scheduled_at', fromISO)
    .lte('scheduled_at', toISO)

  for (const dose of selectDue((windowDoses ?? []) as DoseRow[], now, DUE_TOLERANCE_MIN)) {
    const med = medById.get(dose.medication_id)
    const prof = profById.get(dose.user_id)
    if (!med || !prof) continue

    // dedupe: já avisamos esta dose?
    const { data: already } = await admin
      .from('notification_log')
      .select('id')
      .eq('dose_id', dose.id)
      .eq('type', 'lembrete_dose')
      .limit(1)
    if (already && already.length) continue

    const title = 'Hora do remédio 💊'
    const body = `${med.name} — ${med.dose_amount} ${med.unit}`

    if (prof.push_enabled) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, keys')
        .eq('user_id', dose.user_id)
      summary.pushed += await pushTo((subs ?? []) as PushSubRow[], {
        title,
        body,
        url: '/',
        tag: `dose-${dose.id}`,
      })
    }
    if (prof.email_enabled) {
      const { data: u } = await admin.auth.admin.getUserById(dose.user_id)
      const email = u.user?.email
      if (email) {
        await sendEmail(email, title, `${body}\n\nAbra o Cuidi para registrar.`)
        summary.emailed++
      }
    }
    await admin.from('notification_log').insert({
      user_id: dose.user_id,
      medication_id: med.id,
      dose_id: dose.id,
      type: 'lembrete_dose',
      channel: 'push',
    })
  }

  // 3) Marca perdidas (pendentes além da tolerância).
  const cutoffISO = new Date(now.getTime() - DUE_TOLERANCE_MIN * 60_000).toISOString()
  const { data: stale } = await admin
    .from('doses')
    .select('*')
    .eq('status', 'pendente')
    .lte('scheduled_at', cutoffISO)
  for (const d of selectMissed((stale ?? []) as DoseRow[], now, DUE_TOLERANCE_MIN)) {
    const { error } = await admin.from('doses').update({ status: 'perdido' }).eq('id', d.id)
    if (!error) summary.missed++
  }

  // 4) Estoque baixo, 1×/dia (dedupe pelo notification_log do dia).
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  for (const m of meds) {
    if (!isLowStock(m)) continue
    const prof = profById.get(m.user_id)
    if (!prof) continue
    const { data: sent } = await admin
      .from('notification_log')
      .select('id')
      .eq('medication_id', m.id)
      .eq('type', 'estoque_baixo')
      .gte('sent_at', dayStart.toISOString())
      .limit(1)
    if (sent && sent.length) continue

    const title = 'Estoque acabando 📦'
    const body = `${m.name} está quase no fim. Reponha o estoque.`
    if (prof.push_enabled) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, keys')
        .eq('user_id', m.user_id)
      await pushTo((subs ?? []) as PushSubRow[], { title, body, url: '/remedios' })
    }
    if (prof.email_enabled) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id)
      if (u.user?.email) await sendEmail(u.user.email, title, body)
    }
    await admin.from('notification_log').insert({
      user_id: m.user_id,
      medication_id: m.id,
      type: 'estoque_baixo',
      channel: 'push',
    })
    summary.lowStock++
  }

  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } })
})
```

- [ ] **Step 2: Revisão visual** (sem gate automático)

Conferir: dedupe de `lembrete_dose` por `dose_id`; dedupe de `estoque_baixo` por dia; remoção de subscription morta (404/410); fuso vindo de `profiles.timezone`; service-role só no servidor. Marcar para a revisão final opus.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/tick/index.ts
git commit -m "feat: Edge Function tick (materializa, avisa push+email, marca perdidas, estoque baixo)"
```

---

### Task 8: Cron + secrets + guia de setup (`SETUP.md`, `cron.example.sql`, `.env.example`)

**Files:**
- Create: `supabase/cron.example.sql`, `supabase/functions/SETUP.md`
- Modify: `.env.example`

**Interfaces:**
- Produces: o snippet `pg_cron`+`pg_net` (com placeholders) e o passo-a-passo que o usuário segue para colocar o Plano 6 no ar. Nenhum código de app muda.

- [ ] **Step 1: Criar `supabase/cron.example.sql`**

```sql
-- Agendamento da Edge Function `tick` (rode no SQL Editor do projeto).
-- Troque <PROJECT_REF> e <SERVICE_ROLE_KEY> pelos valores reais (ver SETUP.md).
-- NÃO commite este arquivo preenchido — a service-role key é secreta.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Re)agenda a cada 15 minutos.
select cron.unschedule('cuidi-tick') where exists (select 1 from cron.job where jobname = 'cuidi-tick');

select cron.schedule(
  'cuidi-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/tick',
    headers:= jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Criar `supabase/functions/SETUP.md`**

````markdown
# Cuidi — Setup das Notificações (Plano 6)

Guia para colocar push + e-mail no ar. Tudo no **free tier**. Faça uma vez.
Projeto Supabase do Cuidi: ref `jlfflxcsvncnwcfzgizw`.

## 0. Pré-requisitos
- Supabase CLI (`supabase`) logado: `supabase login`
- Conta no [Resend](https://resend.com) (free) para e-mail

## 1. Aplicar as migrations
No SQL Editor do projeto (ou `supabase db push`), aplique **na ordem** as que ainda faltam:
`0001_profiles.sql`, `0002_medications.sql`, `0003_doses.sql`, `0004_notifications.sql`.

## 2. Gerar as chaves VAPID (Web Push)
```bash
npx web-push generate-vapid-keys
```
Guarde a **Public Key** e a **Private Key**.

- No app (cliente): coloque a pública no `.env.local`:
  ```
  VITE_VAPID_PUBLIC_KEY=<public-key>
  ```
  (e na Vercel, como variável de ambiente do projeto — Plano 7).

## 3. Configurar os secrets da Edge Function
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public-key> \
  VAPID_PRIVATE_KEY=<private-key> \
  VAPID_SUBJECT=mailto:voce@seu-email.com \
  RESEND_API_KEY=<resend-api-key> \
  RESEND_FROM="Cuidi <onboarding@resend.dev>"
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções (injetados pela plataforma) — não precisa setar.

> Resend free envia de `onboarding@resend.dev` sem domínio próprio. Para usar um remetente seu, verifique um domínio no Resend e troque o `RESEND_FROM`.

## 4. Deploy da função
```bash
supabase functions deploy tick
```

## 5. Agendar o cron (pg_cron + pg_net)
No SQL Editor, rode `supabase/cron.example.sql` trocando `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`
(Project Settings → API). Habilite as extensões `pg_cron` e `pg_net` em Database → Extensions se ainda não estiverem.

## 6. Testar
- **Função na unha:** `supabase functions invoke tick` → deve responder um JSON de resumo
  (`materialized`, `pushed`, `emailed`, `missed`, `lowStock`).
- **Push:** instale o app no iPhone (Safari → Compartilhar → Adicionar à Tela de Início),
  abra, vá em Ajustes → ligue "Lembretes por push" e aceite a permissão. Crie um remédio com
  horário daqui a alguns minutos e espere o cron (ou invoque a função).
- **E-mail:** confira a caixa de entrada (e spam) no horário da dose.
- **Logs:** `supabase functions logs tick`.

## Notas
- iOS só entrega Web Push para PWA **instalado** (iOS 16.4+). E-mail é o fallback garantido.
- Idempotência: índice único `(medication_id, scheduled_at)` + `notification_log` evitam duplicatas.
- Tolerância: a função para de avisar e marca `perdido` 2h após a hora da dose (`DUE_TOLERANCE_MIN`).
- Custo: Supabase free + Resend free (100/dia) + Web Push (sem custo).
````

- [ ] **Step 3: Acrescentar a chave VAPID ao `.env.example`**

Adicionar ao final de `.env.example`:

```
# Web Push (VAPID) — gere com: npx web-push generate-vapid-keys
# A chave PÚBLICA vai aqui (cliente). A PRIVADA é secret da Edge Function (ver supabase/functions/SETUP.md).
VITE_VAPID_PUBLIC_KEY=cole-a-chave-publica-vapid-aqui
```

- [ ] **Step 4: Build de sanidade + commit**

```bash
npm run build && npm run test
git add supabase/cron.example.sql supabase/functions/SETUP.md .env.example
git commit -m "docs: SETUP de notificações (VAPID, secrets, deploy, cron) + .env.example"
```

---

## Self-Review (cobertura do spec)

- **Web Push (canal principal):** Tasks 2 (lib), 3 (hook), 4 (SW), 5 (toggle). ✅
- **E-mail de reforço (Resend, fallback):** Task 7 (`sendEmail`), 8 (secrets). ✅
- **Materialização de doses 24–48h no fuso do usuário:** Tasks 6 (`materializeWindow`/`zonedTimeToUtc`), 7. ✅
- **Lembrete "na hora" + marcação de perdidas:** Tasks 6 (`selectDue`/`selectMissed`), 7. ✅
- **Estoque baixo ≤7 dias, 1×/dia, com dedupe:** Tasks 6 (`isLowStock`), 7. ✅
- **Dedupe via `notification_log` + índice único:** Tasks 1, 7. ✅
- **`push_subscriptions` + `notification_log` com RLS:** Task 1. ✅
- **Cron ~15min via pg_cron/pg_net:** Task 8. ✅
- **Guia de setup (VAPID, secrets, deploy, cron, teste):** Task 8. ✅
- **Fuso via `profiles.timezone` (nunca offset fixo):** Tasks 6, 7. ✅
- **Fora do escopo (Plano 7):** code-splitting, vercel.json/deploy, ícones finais, backlog de uid-guard.

**Notas:**
- A Edge Function (`tick/index.ts`) é Deno e **não** roda no Vitest/tsc; a lógica pura foi isolada em `_shared/schedule.ts` e essa é testada (Task 6). Validação fim-a-fim é manual do usuário (Task 8).
- `notification_log.channel` registra um único valor por dose (usamos `'push'`); o dedupe é por `dose_id+type`, então isso não duplica avisos mesmo quando push **e** e-mail são enviados.
- `tsconfig.app.json` exclui `src/sw.ts` (contexto WebWorker, compilado pelo plugin) para não quebrar `tsc -b`.
- Sem placeholders de implementação no código do cliente. Tipos/nomes consistentes (`PushState`, `usePushSubscription`, `MedRow`, `DoseRow`, `PlannedDose`, `materializeWindow`, `selectDue`, `selectMissed`, `isLowStock`).
</content>
</invoke>
