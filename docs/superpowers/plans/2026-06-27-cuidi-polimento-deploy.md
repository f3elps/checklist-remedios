# Cuidi — Plano de Implementação 7: Polimento PWA + Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Cuidi pronto para uso real: dividir o bundle por rota (carregamento mais rápido), polir os metadados do PWA (apple-touch-icon), fechar os nits de UX/segurança do backlog (link de voltar no reset de senha, guards de `uid` nos mutation hooks) e publicar na Vercel com um guia de deploy.

**Architecture:** O `App` passa a carregar cada página com `React.lazy` + `Suspense` (fallback acessível), tirando as 9 páginas do chunk principal. Os ajustes de PWA são metadados estáticos no `index.html`/manifest. As correções de backlog são pontuais e cobertas por testes. O deploy é estático na Vercel (preset Vite) com `vercel.json` para o fallback de SPA das rotas do client-side router.

**Tech Stack:** (continuação) Vite + React 19 + TS, react-router-dom 7, Tailwind 3.4, Vitest + Testing Library, vite-plugin-pwa, Vercel (Hobby).

## Global Constraints

- **Idioma da UI:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** Tailwind **3.4**; shadcn manual; tokens Cuidi (`hsl()` completos) — **nunca** opacidade-no-token (`bg-x/NN`); usar `border-text`/`border-t-primary` (não `border-foreground`). Lazy-load já é o padrão do projeto para libs pesadas (PDF).
- **Sem regressão funcional:** todas as rotas e fluxos dos Planos 1–6 continuam funcionando; a suíte inteira (`npm run test`) e o `npm run build` (tsc) permanecem verdes.
- **PWA:** continua instalável (injectManifest do Plano 6) com manifest pt-BR e ícones existentes em `public/icons/`.
- **Custo zero:** Vercel Hobby; sem dependências novas pesadas.
- **Commits:** um por task, mensagem em português, prefixo convencional.

---

## Estrutura de arquivos (criada/alterada)

```
src/components/layout/PageFallback.tsx       # fallback de Suspense (spinner acessível) — NOVO
src/components/layout/PageFallback.test.tsx
src/App.tsx                                   # React.lazy + Suspense por rota
src/components/layout/AppShell.tsx            # Suspense em volta do <Outlet/> (shell persiste no load)
index.html                                    # apple-touch-icon
src/pages/auth/ResetPassword.tsx              # link "voltar para o login" quando o token expira
src/pages/auth/ResetPassword.test.tsx         # NOVO
src/hooks/useProfile.ts                        # guard de uid em useUpdateProfile
src/hooks/useProfile.guard.test.tsx           # NOVO
src/hooks/useDoses.ts                          # guard de uid em useMarkDose
src/hooks/useDoses.guard.test.tsx             # NOVO
vercel.json                                    # rewrites de SPA — NOVO
docs/DEPLOY.md                                 # guia de deploy na Vercel — NOVO
```

---

### Task 1: Code-splitting por rota (`React.lazy` + `Suspense`)

**Files:**
- Create: `src/components/layout/PageFallback.tsx`, `src/components/layout/PageFallback.test.tsx`
- Modify: `src/App.tsx`, `src/components/layout/AppShell.tsx`

**Interfaces:**
- Produces: `function PageFallback(): JSX.Element` — estado de carregamento acessível (`role="status"`). `App` carrega as 9 páginas via `lazy(() => import(...))` sob `Suspense`; `AppShell` envolve o `<Outlet/>` num `Suspense` próprio (o cabeçalho/nav permanecem durante a troca de rota).

- [ ] **Step 1: Escrever o teste que falha** (`src/components/layout/PageFallback.test.tsx`)

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageFallback } from './PageFallback'

describe('PageFallback', () => {
  it('mostra um estado de carregamento acessível', () => {
    render(<PageFallback />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/layout/PageFallback.test.tsx` → FAIL.

- [ ] **Step 3: Criar `src/components/layout/PageFallback.tsx`**

```tsx
export function PageFallback() {
  return (
    <div role="status" aria-live="polite" className="grid place-items-center py-16">
      <span className="sr-only">Carregando…</span>
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/layout/PageFallback.test.tsx` → PASS.

- [ ] **Step 5: Converter `src/App.tsx` para lazy**

```tsx
import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import { AppShell } from '@/components/layout/AppShell'
import { PageFallback } from '@/components/layout/PageFallback'

const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Hoje = lazy(() => import('@/pages/Hoje'))
const Remedios = lazy(() => import('@/pages/Remedios'))
const Historico = lazy(() => import('@/pages/Historico'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const MedicationFormPage = lazy(() => import('@/pages/MedicationFormPage'))

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastrar" element={<Signup />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
        </Route>
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Hoje />} />
            <Route path="/remedios" element={<Remedios />} />
            <Route path="/remedios/novo" element={<MedicationFormPage />} />
            <Route path="/remedios/:id/editar" element={<MedicationFormPage />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
```

- [ ] **Step 6: `Suspense` em volta do `<Outlet/>` no `AppShell`** (`src/components/layout/AppShell.tsx`)

Para o cabeçalho e a navegação não sumirem durante a troca de rota protegida, envolver o `<Outlet/>` num `Suspense` próprio:

```tsx
import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from './BottomNav'
import { ProfileThemeSync } from '@/providers/ProfileThemeSync'
import { PageFallback } from './PageFallback'

export function AppShell() {
  return (
    <div className="min-h-full max-w-md mx-auto pb-20">
      <header className="flex items-center justify-between p-4">
        <span className="text-xl font-bold text-primary">Cuidi</span>
        <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="text-muted">
          <LogOut size={20} />
        </button>
      </header>
      <ProfileThemeSync />
      <main className="px-4">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 7: Build e verificar o split**

```bash
npm run build
```

Esperado: build limpo. Conferir que as páginas viraram chunks separados (mais de um JS em `dist/assets`) e que o chunk principal encolheu:

```bash
ls dist/assets/*.js | wc -l   # deve ser > 1 (várias páginas em chunks próprios)
```

No resumo do `vite build`, o aviso de "chunk maior que 500 kB" deve sumir ou o `index-*.js` deve ficar bem menor do que antes (~770 kB).

- [ ] **Step 8: Suíte + commit**

```bash
npm run test
git add src/App.tsx src/components/layout/AppShell.tsx src/components/layout/PageFallback.tsx src/components/layout/PageFallback.test.tsx
git commit -m "perf: code-splitting por rota (React.lazy + Suspense)"
```

---

### Task 2: apple-touch-icon (polimento de PWA no iOS)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `<link rel="apple-touch-icon">` para o ícone na tela inicial do iPhone ficar com a marca Cuidi (e não um screenshot). Usa o ícone existente `public/icons/icon-192.png`.

- [ ] **Step 1: Acrescentar o apple-touch-icon ao `index.html`**

Logo após a linha do favicon (`<link rel="icon" ... href="/favicon.svg" />`), adicionar:

```html
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

(O resto do `<head>` — viewport, theme-color, apple-mobile-web-app-* — fica igual.)

- [ ] **Step 2: Build de sanidade**

```bash
npm run build
```

Esperado: build limpo; `dist/icons/icon-192.png` presente (já em `public/icons/`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: apple-touch-icon (ícone da marca na tela inicial do iOS)"
```

---

### Task 3: Link "voltar para o login" no `ResetPassword` (TDD)

**Files:**
- Modify: `src/pages/auth/ResetPassword.tsx`
- Create: `src/pages/auth/ResetPassword.test.tsx`

**Interfaces:**
- Consumes: `Link` (`react-router-dom`); `supabase.auth.updateUser`.
- Produces: quando o `updateUser` falha (token expirado), além do toast, a tela mostra um `Link` para `/entrar` ("Voltar para o login"), fechando o gap de UX do beco-sem-saída (backlog do Plano 1).

- [ ] **Step 1: Escrever o teste que falha** (`src/pages/auth/ResetPassword.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const updateUser = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: (a: unknown) => updateUser(a) } },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import ResetPassword from './ResetPassword'

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra "voltar para o login" quando o link expirou', async () => {
    updateUser.mockResolvedValue({ error: { message: 'expired' } })
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/nova senha/i), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByRole('link', { name: /voltar para o login/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/auth/ResetPassword.test.tsx` → FAIL.

- [ ] **Step 3: Atualizar `src/pages/auth/ResetPassword.tsx`**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

const schema = z.object({ password: z.string().min(6, 'Mínimo 6 caracteres') })
type Form = z.infer<typeof schema>

export default function ResetPassword() {
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) { setExpired(true); toast.error('Link expirado. Peça um novo.'); return }
    toast.success('Senha redefinida!')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <Card className="w-full max-w-sm p-6 shadow-card">
        <h1 className="text-2xl font-bold mb-6">Nova senha</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-error text-sm mt-1">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>Salvar</Button>
          {expired && (
            <Link to="/entrar" className="block text-center text-sm text-primary underline">
              Voltar para o login
            </Link>
          )}
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/pages/auth/ResetPassword.test.tsx` → PASS.

- [ ] **Step 5: Build + suíte + commit**

```bash
npm run build && npm run test
git add src/pages/auth/ResetPassword.tsx src/pages/auth/ResetPassword.test.tsx
git commit -m "feat: link de voltar ao login quando o token de reset expira"
```

---

### Task 4: Guards de `uid` nos mutation hooks (TDD)

**Files:**
- Modify: `src/hooks/useProfile.ts`, `src/hooks/useDoses.ts`
- Create: `src/hooks/useProfile.guard.test.tsx`, `src/hooks/useDoses.guard.test.tsx`

**Interfaces:**
- Produces: `useUpdateProfile` e `useMarkDose` passam a lançar cedo quando não há usuário autenticado, em vez de mandar `.eq('id', undefined)`/`user_id: undefined` ao banco (remove o footgun `id=eq.undefined`). Comportamento de sucesso permanece idêntico.

- [ ] **Step 1: Escrever os testes que falham**

`src/hooks/useProfile.guard.test.tsx`:

```tsx
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
```

`src/hooks/useDoses.guard.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useProfile.guard.test.tsx src/hooks/useDoses.guard.test.tsx` → FAIL (hoje não lançam; chamam o banco com uid undefined).

- [ ] **Step 3: Adicionar o guard em `useUpdateProfile`** (`src/hooks/useProfile.ts`)

No `mutationFn` de `useUpdateProfile`, após obter `uid`:

```ts
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) throw new Error('Sem usuário autenticado.')
      const { error } = await supabase.from('profiles').update(values).eq('id', uid)
      if (error) throw error
```

(O resto de `useProfile.ts` fica igual.)

- [ ] **Step 4: Adicionar o guard em `useMarkDose`** (`src/hooks/useDoses.ts`)

No `mutationFn` de `useMarkDose`, após obter `user_id`:

```ts
      const { data: userData } = await supabase.auth.getUser()
      const user_id = userData.user?.id
      if (!user_id) throw new Error('Sem usuário autenticado.')
      const taken_at = action === 'tomado' ? new Date().toISOString() : null
```

(O resto de `useMarkDose` — upsert e baixa de estoque — fica igual.)

- [ ] **Step 5: Rodar e ver passar (guards + suíte inteira)**

```bash
npx vitest run src/hooks/useProfile.guard.test.tsx src/hooks/useDoses.guard.test.tsx
npm run test
```

Esperado: os dois novos PASS, e a suíte inteira continua verde (os testes de sucesso existentes usam usuário presente).

- [ ] **Step 6: Build + commit**

```bash
npm run build
git add src/hooks/useProfile.ts src/hooks/useDoses.ts src/hooks/useProfile.guard.test.tsx src/hooks/useDoses.guard.test.tsx
git commit -m "fix: guard de uid em useUpdateProfile e useMarkDose (sem id=eq.undefined)"
```

---

### Task 5: `vercel.json` + guia de deploy

**Files:**
- Create: `vercel.json`, `docs/DEPLOY.md`

**Interfaces:**
- Produces: o fallback de SPA (todas as rotas sem extensão → `index.html`, para o react-router funcionar em refresh/deep-link) e o passo-a-passo de publicação na Vercel com as variáveis de ambiente.

- [ ] **Step 1: Criar `vercel.json`**

```json
{
  "rewrites": [{ "source": "/((?!.*\\.).*)", "destination": "/index.html" }]
}
```

(A negativa `(?!.*\\.)` evita reescrever arquivos com extensão — `assets/*.js`, `sw.js`, `manifest.webmanifest`, ícones — servindo o `index.html` só para rotas do app como `/`, `/remedios`, `/redefinir-senha`.)

- [ ] **Step 2: Criar `docs/DEPLOY.md`**

````markdown
# Cuidi — Deploy na Vercel

PWA estático (Vite). Free tier (Hobby). Deploy automático a cada push na `main`.

## 1. Importar o repositório
1. Vercel → **Add New… → Project** → importe `checklist-remedios`.
2. **Framework Preset:** Vite (detectado automaticamente).
   - Build Command: `npm run build`
   - Output Directory: `dist`

## 2. Variáveis de ambiente (Project → Settings → Environment Variables)
Use os mesmos valores do `.env.local`:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://jlfflxcsvncnwcfzgizw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a publishable key do projeto |
| `VITE_VAPID_PUBLIC_KEY` | a chave pública VAPID (ver `supabase/functions/SETUP.md`) |

Defina para **Production** (e Preview, se quiser testar PRs). Redeploy após salvar.

## 3. Supabase Auth → URL do site
Em Authentication → URL Configuration do projeto Supabase:
- **Site URL:** a URL da Vercel (ex.: `https://cuidi.vercel.app`).
- **Redirect URLs:** adicione `https://cuidi.vercel.app/redefinir-senha` (link do e-mail de
  recuperação de senha) e `https://cuidi.vercel.app/**`.

## 4. SPA fallback
Já tratado pelo `vercel.json` (rewrites → `index.html`). Sem isso, dar refresh em `/remedios`
retornaria 404.

## 5. Conferir
- App abre na URL da Vercel, login funciona.
- Instalar na tela inicial (iOS/Android) — ver instruções em Ajustes.
- Notificações: depende do Plano 6 estar configurado no Supabase (`supabase/functions/SETUP.md`)
  **e** da `VITE_VAPID_PUBLIC_KEY` estar setada aqui na Vercel.
````

- [ ] **Step 3: Verificação final independente do branch**

```bash
npm run build && npm run test
git status --porcelain   # working tree limpo
```

Esperado: build limpo (tsc + vite, com SW e manifest), suíte inteira verde, nada solto.

- [ ] **Step 4: Commit**

```bash
git add vercel.json docs/DEPLOY.md
git commit -m "chore: vercel.json (SPA rewrites) + guia de deploy"
```

---

## Self-Review (cobertura do escopo)

- **Code-splitting por rota (reduz o chunk ~770 kB):** Task 1. ✅
- **PWA instalável + ícones/onboarding:** Task 2 (apple-touch-icon); instruções de instalar já estão em Ajustes (Plano 5). ✅
- **Backlog — link de voltar no ResetPassword:** Task 3. ✅
- **Backlog — sweep de guard `if(!uid)` nos mutation hooks:** Task 4 (useUpdateProfile, useMarkDose; o helper de push já nasce guardado no Plano 6). ✅
- **Deploy na Vercel + env + guia:** Task 5. ✅

**Notas:**
- `Suspense` em dois níveis (App para rotas públicas/reset; AppShell em volta do `Outlet` para as protegidas) evita que o cabeçalho/nav pisquem na troca de rota.
- Toggles de notificação otimistas (`setQueryData`) ficam **adiados** (não bloqueiam; refetch atual degrada bem) — fora do escopo deste plano para não inflar a superfície.
- `vercel.json` cobre o fallback de SPA; o `vite-plugin-pwa` (Plano 6) gera `sw.js`/`manifest.webmanifest` na raiz de `dist`, que têm extensão e portanto não são reescritos.
- Sem placeholders. Tipos/nomes consistentes (`PageFallback`; guards lançam `Error` com a mesma mensagem).
````
</content>
