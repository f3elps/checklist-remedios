# Cuidi — Plano de Implementação 5: Configurações + preferências

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a interface de Configurações: trocar a cor do tema (6 presets) e o modo escuro, alternar preferências de notificação (e-mail/push), e instruções de "adicionar à tela inicial" — tudo persistido em `profiles` e sincronizado com o tema do app.

**Architecture:** O tema continua aplicado pelo `ThemeProvider` (Plano 1, fonte da verdade + localStorage para boot instantâneo). Um par de hooks (`useProfile`/`useUpdateProfile`) lê/grava a linha do usuário em `profiles`. Um componente `ProfileThemeSync` (montado dentro do `AppShell`, já sob auth) reconcilia DB → provider quando o perfil carrega. A tela Configurações altera o provider (instantâneo) **e** grava em `profiles` (persistência entre dispositivos).

**Tech Stack:** (continuação) Vite + React 19 + TS, Tailwind 3.4, shadcn (manual) + **@radix-ui/react-switch** (novo), @supabase/supabase-js 2, @tanstack/react-query 5, Vitest + Testing Library.

## Global Constraints

- **Idioma da UI:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** o dos planos 1–4. Tailwind **3.4**. shadcn manual. Tokens do Cuidi; **nenhum hex hardcoded** em className (as cores dos swatches vêm de `THEMES[].primary` via estilo inline — são valores `hsl()` de dado, não tokens de UI).
- **Tema:** 6 presets (`verde, azul, violeta, rosa, ambar, teal`) + modo claro/escuro. `verde` é o padrão. Persistir em `profiles.theme_color` e `profiles.dark_mode`.
- **Notificações:** `profiles.email_enabled` / `profiles.push_enabled` são só preferências aqui; a entrega (push real / e-mail) é o Plano 6. O toggle de push **não** dispara o fluxo de subscription neste plano.
- **RLS:** `profiles` já tem RLS por dono (Plano 1). Sem novas migrations.
- **Commits:** um por task, mensagem em português, prefixo convencional.
- **Banco:** sem novas migrations. Lembrar que 0001–0003 ainda dependem de aplicação manual do usuário; com o banco não aplicado, `useProfile` retorna `null` e o app cai no tema do localStorage (degrada bem).

---

## Estrutura de arquivos (criada/alterada)

```
src/components/ui/switch.tsx                      # shadcn Switch (Radix) — novo
src/lib/theme.ts                                  # + cor `primary` por preset (para os swatches)
src/lib/theme.test.ts                             # + asserção da cor
src/hooks/useProfile.ts                           # useProfile + useUpdateProfile
src/hooks/useProfile.test.tsx
src/providers/ProfileThemeSync.tsx                # reconcilia profiles -> ThemeProvider
src/providers/ProfileThemeSync.test.tsx
src/components/layout/AppShell.tsx                # monta <ProfileThemeSync/>
src/pages/Configuracoes.tsx                       # reescrita: tema + dark + notificações + instalar
src/pages/Configuracoes.test.tsx
```

---

### Task 1: Componente `Switch` (shadcn manual)

**Files:**
- Create: `src/components/ui/switch.tsx`

**Interfaces:**
- Produces: `Switch` (Radix Switch + tokens Cuidi) — usado pelos toggles de dark/notificações.

- [ ] **Step 1: Instalar a dep Radix**

```bash
npm install @radix-ui/react-switch
```

- [ ] **Step 2: Criar `src/components/ui/switch.tsx`**

```tsx
import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-2',
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/ui/switch.tsx package.json package-lock.json
git commit -m "feat: componente shadcn Switch"
```

---

### Task 2: Cores dos presets em `theme.ts` (TDD)

**Files:**
- Modify: `src/lib/theme.ts`, `src/lib/theme.test.ts`

**Interfaces:**
- Produces: cada entrada de `THEMES` ganha `primary: string` (cor do preset no modo claro, para o swatch). Tipo passa a ser `{ slug: ThemeSlug; label: string; primary: string }`.

- [ ] **Step 1: Acrescentar o teste que falha** (em `src/lib/theme.test.ts`)

```ts
it('cada tema tem uma cor primary em hsl', () => {
  for (const t of THEMES) {
    expect(t.primary).toMatch(/^hsl\(/)
  }
  expect(THEMES.find((t) => t.slug === 'verde')?.primary).toBe('hsl(160 60% 40%)')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/theme.test.ts` → o novo teste FALHA (`primary` undefined).

- [ ] **Step 3: Atualizar `THEMES` em `src/lib/theme.ts`**

```ts
export const THEMES: { slug: ThemeSlug; label: string; primary: string }[] = [
  { slug: 'verde', label: 'Verde Cuidado', primary: 'hsl(160 60% 40%)' },
  { slug: 'azul', label: 'Azul Sereno', primary: 'hsl(212 72% 48%)' },
  { slug: 'violeta', label: 'Violeta', primary: 'hsl(262 52% 56%)' },
  { slug: 'rosa', label: 'Rosa', primary: 'hsl(338 68% 56%)' },
  { slug: 'ambar', label: 'Âmbar', primary: 'hsl(35 90% 48%)' },
  { slug: 'teal', label: 'Teal', primary: 'hsl(184 64% 40%)' },
]
```

(O resto de `theme.ts` — `ThemeSlug`, `isThemeSlug`, `applyTheme`, `SLUGS` — fica igual.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/theme.test.ts` → PASS (incluindo os testes anteriores de slug/applyTheme).

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: cor de cada preset de tema (para os swatches)"
```

---

### Task 3: Hooks `useProfile` + `useUpdateProfile` (TDD)

**Files:**
- Create: `src/hooks/useProfile.ts`, `src/hooks/useProfile.test.tsx`

**Interfaces:**
- Consumes: `supabase`.
- Produces:
  - `interface Profile { id; display_name: string | null; theme_color: string; dark_mode: boolean; timezone: string; email_enabled: boolean; push_enabled: boolean; created_at: string }`
  - `function useProfile(): UseQueryResult<Profile | null>` (chave `['profile']`; lê a linha do usuário; `maybeSingle`)
  - `function useUpdateProfile(): UseMutationResult<void, Error, Partial<Profile>>` (atualiza por id; invalida `['profile']`)

- [ ] **Step 1: Escrever o teste que falha**

`src/hooks/useProfile.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'u1', theme_color: 'azul' }, error: null })
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })), auth: { getUser: () => getUser() } },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca a linha do usuário em profiles', async () => {
    const { useProfile } = await import('./useProfile')
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 'u1', theme_color: 'azul' })
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useProfile.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/hooks/useProfile.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  display_name: string | null
  theme_color: string
  dark_mode: boolean
  timezone: string
  email_enabled: boolean
  push_enabled: boolean
  created_at: string
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) return null
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (error) throw error
      return (data as Profile | null) ?? null
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Profile>): Promise<void> => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      const { error } = await supabase.from('profiles').update(values).eq('id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/useProfile.test.tsx` → PASS.

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/hooks/useProfile.ts src/hooks/useProfile.test.tsx
git commit -m "feat: hooks useProfile e useUpdateProfile"
```

---

### Task 4: `ProfileThemeSync` (reconcilia DB → tema) + montar no shell

**Files:**
- Create: `src/providers/ProfileThemeSync.tsx`, `src/providers/ProfileThemeSync.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `useProfile`; `useTheme` (Plano 1); `isThemeSlug` (`@/lib/theme`).
- Produces: `function ProfileThemeSync(): null` — quando o perfil carrega, aplica `theme_color`/`dark_mode` ao `ThemeProvider` (DB → provider). Montado em `AppShell`.

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/ProfileThemeSync.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const setTheme = vi.fn()
const setDark = vi.fn()
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'verde', dark: false, setTheme, setDark }),
}))
const useProfileMock = vi.fn()
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => useProfileMock() }))

import { ProfileThemeSync } from './ProfileThemeSync'

describe('ProfileThemeSync', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aplica o tema do perfil quando ele difere do atual', async () => {
    useProfileMock.mockReturnValue({ data: { theme_color: 'rosa', dark_mode: true } })
    render(<ProfileThemeSync />)
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('rosa')
      expect(setDark).toHaveBeenCalledWith(true)
    })
  })

  it('não faz nada sem perfil', () => {
    useProfileMock.mockReturnValue({ data: null })
    render(<ProfileThemeSync />)
    expect(setTheme).not.toHaveBeenCalled()
    expect(setDark).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/providers/ProfileThemeSync.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/providers/ProfileThemeSync.tsx`**

```tsx
import { useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useTheme } from '@/providers/ThemeProvider'
import { isThemeSlug } from '@/lib/theme'

export function ProfileThemeSync(): null {
  const { data: profile } = useProfile()
  const { theme, dark, setTheme, setDark } = useTheme()

  useEffect(() => {
    if (!profile) return
    if (isThemeSlug(profile.theme_color) && profile.theme_color !== theme) setTheme(profile.theme_color)
    if (typeof profile.dark_mode === 'boolean' && profile.dark_mode !== dark) setDark(profile.dark_mode)
    // Reconcilia apenas quando o perfil muda (DB -> provider); não depende de theme/dark para evitar laços.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/providers/ProfileThemeSync.test.tsx` → PASS.

- [ ] **Step 5: Montar no `AppShell`** (`src/components/layout/AppShell.tsx`)

Acrescentar o import e renderizar `<ProfileThemeSync />` dentro do container (ex.: logo após `<header>`), sem alterar o resto:

```tsx
import { ProfileThemeSync } from '@/providers/ProfileThemeSync'
// dentro do JSX do AppShell, dentro do <div> raiz:
<ProfileThemeSync />
```

- [ ] **Step 6: Build + suíte + commit**

```bash
npm run build && npm run test
git add src/providers/ProfileThemeSync.tsx src/providers/ProfileThemeSync.test.tsx src/components/layout/AppShell.tsx
git commit -m "feat: ProfileThemeSync (aplica tema do perfil) montado no AppShell"
```

---

### Task 5: Página `Configurações`

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Create: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `THEMES` (`@/lib/theme`); `useTheme`; `useProfile`, `useUpdateProfile`; `Switch`; `Card`; `toast`.
- Produces: tela com seção de tema (6 swatches + switch de modo escuro), preferências de notificação (switches e-mail/push) e instruções de instalar na tela inicial. Trocar tema chama `setTheme` + `useUpdateProfile`; modo escuro chama `setDark` + update; toggles de notificação chamam update.

- [ ] **Step 1: Escrever o teste que falha**

`src/pages/Configuracoes.test.tsx`:

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
  useProfile: () => ({ data: { theme_color: 'verde', dark_mode: false, email_enabled: true, push_enabled: true } }),
  useUpdateProfile: () => ({ mutateAsync: mutate, isPending: false }),
}))

import Configuracoes from './Configuracoes'

describe('Configuracoes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trocar de tema aplica e persiste', async () => {
    render(<Configuracoes />)
    await userEvent.click(screen.getByRole('button', { name: /tema rosa/i }))
    expect(setTheme).toHaveBeenCalledWith('rosa')
    expect(mutate).toHaveBeenCalledWith({ theme_color: 'rosa' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/Configuracoes.test.tsx` → FAIL.

- [ ] **Step 3: Reescrever `src/pages/Configuracoes.tsx`**

```tsx
import { toast } from 'sonner'
import { THEMES, type ThemeSlug } from '@/lib/theme'
import { useTheme } from '@/providers/ThemeProvider'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function Configuracoes() {
  const { theme, dark, setTheme, setDark } = useTheme()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  async function persist(values: Parameters<typeof update.mutateAsync>[0]) {
    try {
      await update.mutateAsync(values)
    } catch {
      toast.error('Não foi possível salvar a preferência.')
    }
  }

  function pickTheme(slug: ThemeSlug) {
    setTheme(slug)
    persist({ theme_color: slug })
  }
  function toggleDark(v: boolean) {
    setDark(v)
    persist({ dark_mode: v })
  }

  const emailOn = profile?.email_enabled ?? true
  const pushOn = profile?.push_enabled ?? true

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <Card className="p-4 shadow-card space-y-4">
        <h2 className="font-semibold">Cor do app</h2>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => (
            <button
              key={t.slug}
              aria-label={`Tema ${t.label}`}
              onClick={() => pickTheme(t.slug)}
              className={cn(
                'h-10 w-10 rounded-full border-2',
                theme === t.slug ? 'border-foreground ring-2 ring-primary' : 'border-border',
              )}
              style={{ background: t.primary }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span>Modo escuro</span>
          <Switch checked={dark} onCheckedChange={toggleDark} aria-label="Modo escuro" />
        </div>
      </Card>

      <Card className="p-4 shadow-card space-y-4">
        <h2 className="font-semibold">Notificações</h2>
        <div className="flex items-center justify-between">
          <span>Avisos por e-mail</span>
          <Switch checked={emailOn} onCheckedChange={(v) => persist({ email_enabled: v })} aria-label="Avisos por e-mail" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span>Lembretes por push</span>
            <p className="text-muted text-sm">A ativação completa do push acontece ao instalar o app.</p>
          </div>
          <Switch checked={pushOn} onCheckedChange={(v) => persist({ push_enabled: v })} aria-label="Lembretes por push" />
        </div>
      </Card>

      <Card className="p-4 shadow-card space-y-2">
        <h2 className="font-semibold">Instalar na tela inicial</h2>
        <p className="text-muted text-sm">
          <strong>iPhone (Safari):</strong> toque em Compartilhar <span aria-hidden>⬆️</span> e depois em
          “Adicionar à Tela de Início”.
        </p>
        <p className="text-muted text-sm">
          <strong>Android (Chrome):</strong> toque no menu <span aria-hidden>⋮</span> e depois em
          “Instalar app” / “Adicionar à tela inicial”.
        </p>
      </Card>
    </section>
  )
}
```

> Nota: `border-foreground` mapeia para um token? Não. Use `border-text` (token Cuidi) no anel de seleção em vez de `border-foreground`. Ajuste a classe para `theme === t.slug ? 'border-text ring-2 ring-primary' : 'border-border'`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/pages/Configuracoes.test.tsx` → PASS.

- [ ] **Step 5: Build + suíte + commit**

```bash
npm run build && npm run test
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: tela Configurações (tema, modo escuro, notificações, instalar)"
```

---

## Self-Review (cobertura do spec)

- **"Pode mudar a cor do site" (6 presets):** Tasks 2, 5. ✅
- **Modo escuro:** Tasks 1, 5. ✅
- **Preferências de notificação (e-mail/push) persistidas:** Tasks 3, 5. ✅
- **Sincronização do tema com `profiles` (entre dispositivos):** Tasks 3, 4. ✅
- **Instalar na tela inicial (iOS/Android):** Task 5. ✅
- **Tokens / pt-BR / Tailwind 3.4 / shadcn manual:** Tasks 1, 5. ✅
- **Fora do escopo (próximos):** entrega real de push/e-mail + materialização server-side (Plano 6); ícones finais + code-splitting por rota + deploy (Plano 7).

**Notas:** o toggle de push só grava a preferência aqui (subscription real no Plano 6). Sem banco aplicado, `useProfile` retorna null e o tema cai no localStorage (degrada bem). Usar `border-text` (token), não `border-foreground`, no anel de seleção do swatch.

Sem placeholders de implementação. Tipos/nomes consistentes (`Profile`, `useProfile`, `useUpdateProfile`, `ProfileThemeSync`, `Switch`, `THEMES[].primary`).
```
