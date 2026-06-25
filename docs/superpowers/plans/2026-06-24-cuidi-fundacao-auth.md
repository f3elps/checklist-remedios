# Cuidi — Plano de Implementação 1: Fundação + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um PWA instalável e tematizável (Vite+React+TS+Tailwind+shadcn) onde o usuário cadastra conta, faz login, recupera senha e chega numa shell autenticada com navegação inferior.

**Architecture:** SPA React servido como PWA. Autenticação e dados no Supabase (Auth + Postgres + RLS). Tema (cor via `data-theme`, modo via classe `.dark`) aplicado por um provider que persiste a escolha. Roteamento protegido separa rotas públicas (auth) das privadas (app).

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix), @supabase/supabase-js 2, react-router-dom 6, @tanstack/react-query 5, react-hook-form + zod, date-fns 3, vite-plugin-pwa, Vitest + @testing-library/react.

## Global Constraints

- **Idioma da UI:** Português do Brasil. Nome do app: **Cuidi**.
- **Custo:** tudo no free tier (Supabase free, Vercel Hobby). Nenhuma dependência paga.
- **Stack fixo:** reusar o stack do `casa-gestao` (acima). Não introduzir libs fora dessa lista sem necessidade.
- **Design tokens:** usar `docs/design/theme.css` como fonte da verdade de cor. Tema padrão `verde`. 6 temas: `verde, azul, violeta, rosa, ambar, teal`. Modo claro/escuro.
- **Fonte:** Plus Jakarta Sans (import já no `theme.css`).
- **RLS:** toda tabela com RLS estrita por `auth.uid()`.
- **Segurança:** segredos só em `.env` (nunca commitado). Apenas a `anon/publishable key` no cliente.
- **Commits:** frequentes, um por task concluída. Mensagens em português, prefixo convencional (`feat:`, `chore:`, `test:`).

---

## Estrutura de arquivos (criada neste plano)

```
.
├── index.html                       # entry HTML + manifest link
├── package.json / vite.config.ts / tsconfig*.json
├── tailwind.config.ts / postcss.config.js
├── .env.example                     # template de variáveis (commitado)
├── .env.local                       # variáveis reais (gitignored)
├── components.json                  # config shadcn
├── public/
│   ├── manifest.webmanifest
│   └── icons/                        # placeholders nesta fase (finalizados no Plano 7)
├── supabase/
│   └── migrations/
│       └── 0001_profiles.sql        # tabela profiles + RLS + trigger
└── src/
    ├── main.tsx                     # bootstrap React + providers
    ├── App.tsx                      # rotas
    ├── index.css                    # @tailwind + import do theme.css
    ├── styles/theme.css             # cópia de docs/design/theme.css
    ├── lib/
    │   ├── supabase.ts              # cliente Supabase
    │   ├── theme.ts                 # lógica pura de tema (TDD)
    │   └── utils.ts                 # cn() do shadcn
    ├── providers/
    │   ├── ThemeProvider.tsx        # aplica data-theme + .dark, persiste
    │   └── AuthProvider.tsx         # sessão Supabase
    ├── components/
    │   ├── ui/                      # componentes shadcn (button, input, etc.)
    │   └── layout/
    │       ├── AppShell.tsx         # layout privado + bottom nav
    │       └── BottomNav.tsx
    ├── routes/
    │   ├── ProtectedRoute.tsx
    │   └── PublicRoute.tsx
    ├── pages/
    │   ├── auth/Login.tsx
    │   ├── auth/Signup.tsx
    │   ├── auth/ForgotPassword.tsx
    │   ├── auth/ResetPassword.tsx
    │   ├── Hoje.tsx                 # placeholder autenticado
    │   ├── Remedios.tsx             # placeholder
    │   ├── Historico.tsx            # placeholder
    │   └── Configuracoes.tsx        # placeholder (tema vem no Plano 5)
    └── test/setup.ts                # setup do Vitest/Testing Library
```

---

### Task 1: Scaffold Vite + React + TS no repositório existente

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore` (merge)

**Interfaces:**
- Produces: app Vite rodável (`npm run dev`) e buildável (`npm run build`); script `npm run test`.

- [ ] **Step 1: Gerar o scaffold em um diretório temporário e copiar para o repo (sem tocar em `.git`/`docs`)**

```bash
npm create vite@latest /tmp/cuidi-scaffold -- --template react-ts
rsync -a --exclude node_modules --exclude .git /tmp/cuidi-scaffold/ ./
rm -rf /tmp/cuidi-scaffold
```

- [ ] **Step 2: Garantir o `.gitignore`**

Acrescentar (se não existir) ao `.gitignore`:

```
node_modules
dist
.env
.env.local
.env.*.local
*.local
coverage
```

- [ ] **Step 3: Instalar dependências base**

```bash
npm install
npm install @supabase/supabase-js react-router-dom @tanstack/react-query \
  react-hook-form zod @hookform/resolvers date-fns lucide-react \
  class-variance-authority clsx tailwind-merge
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom @types/node
```

- [ ] **Step 4: Configurar alias `@` e Vitest no `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

Adicionar ao `tsconfig.json` em `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 5: Criar o setup de testes**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Adicionar script em `package.json` (`scripts`): `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Verificar build, dev e teste**

```bash
npm run build      # deve compilar sem erros
npm run test       # "No test files found" é OK nesta fase (exit 0 com --passWithNoTests)
```

Se `vitest run` falhar por não achar testes, ajustar o script para `"test": "vitest run --passWithNoTests"`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS"
```

---

### Task 2: Tailwind + shadcn + design tokens (theme.css)

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/styles/theme.css`, `src/lib/utils.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: utilitários Tailwind mapeados aos tokens do Cuidi; `cn()` disponível; `Button` shadcn instalado.

- [ ] **Step 1: Instalar Tailwind 3.4 e inicializar**

```bash
npm install -D tailwindcss@3.4 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Copiar os tokens de design para dentro de `src`**

```bash
cp docs/design/theme.css src/styles/theme.css
```

- [ ] **Step 3: Escrever `src/index.css`**

```css
@import './styles/theme.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: var(--bg); color: var(--text); font-family: var(--font-sans); }
```

- [ ] **Step 4: Configurar `tailwind.config.ts` mapeando os tokens**

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
        text: 'var(--text)', muted: 'var(--muted)', border: 'var(--border)',
        primary: 'var(--primary)', 'primary-strong': 'var(--primary-strong)',
        'primary-soft': 'var(--primary-soft)', 'on-primary': 'var(--on-primary)',
        amber: 'var(--amber)', 'amber-soft': 'var(--amber-soft)',
        error: 'var(--error)', 'error-soft': 'var(--error-soft)',
      },
      borderRadius: { sm: 'var(--radius-sm)', DEFAULT: 'var(--radius)', lg: 'var(--radius-lg)' },
      fontFamily: { sans: 'var(--font-sans)' },
      boxShadow: { card: 'var(--card-shadow)' },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Criar `src/lib/utils.ts` (helper `cn`)**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Inicializar shadcn e instalar componentes base**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card sonner
```

Se o init perguntar caminhos, aceitar defaults (`src/components/ui`, alias `@`). Em `components.json` confirmar `"css": "src/index.css"` e `"baseColor"` neutro (vamos sobrescrever via nossas vars, então a paleta do shadcn é secundária).

- [ ] **Step 7: Verificar build**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: tailwind + shadcn + design tokens do Cuidi"
```

---

### Task 3: Lógica pura de tema (TDD)

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeSlug = 'verde'|'azul'|'violeta'|'rosa'|'ambar'|'teal'`
  - `const THEMES: { slug: ThemeSlug; label: string }[]`
  - `function isThemeSlug(v: unknown): v is ThemeSlug`
  - `function applyTheme(root: HTMLElement, slug: ThemeSlug, dark: boolean): void` — seta `data-theme` e a classe `dark`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyTheme, isThemeSlug, THEMES } from './theme'

describe('theme', () => {
  it('lista 6 temas com verde como primeiro', () => {
    expect(THEMES.map(t => t.slug)).toEqual(['verde','azul','violeta','rosa','ambar','teal'])
  })

  it('valida slugs', () => {
    expect(isThemeSlug('verde')).toBe(true)
    expect(isThemeSlug('roxo')).toBe(false)
    expect(isThemeSlug(null)).toBe(false)
  })

  it('aplica data-theme e classe dark no elemento', () => {
    const el = document.createElement('html')
    applyTheme(el, 'azul', true)
    expect(el.getAttribute('data-theme')).toBe('azul')
    expect(el.classList.contains('dark')).toBe(true)

    applyTheme(el, 'verde', false)
    expect(el.getAttribute('data-theme')).toBe('verde')
    expect(el.classList.contains('dark')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL (módulo `./theme` não existe).

- [ ] **Step 3: Implementar `src/lib/theme.ts`**

```ts
export type ThemeSlug = 'verde' | 'azul' | 'violeta' | 'rosa' | 'ambar' | 'teal'

export const THEMES: { slug: ThemeSlug; label: string }[] = [
  { slug: 'verde', label: 'Verde Cuidado' },
  { slug: 'azul', label: 'Azul Sereno' },
  { slug: 'violeta', label: 'Violeta' },
  { slug: 'rosa', label: 'Rosa' },
  { slug: 'ambar', label: 'Âmbar' },
  { slug: 'teal', label: 'Teal' },
]

const SLUGS = new Set(THEMES.map(t => t.slug))

export function isThemeSlug(v: unknown): v is ThemeSlug {
  return typeof v === 'string' && SLUGS.has(v as ThemeSlug)
}

export function applyTheme(root: HTMLElement, slug: ThemeSlug, dark: boolean): void {
  root.setAttribute('data-theme', slug)
  root.classList.toggle('dark', dark)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: lógica pura de tema (slugs, validação, applyTheme)"
```

---

### Task 4: Cliente Supabase + variáveis de ambiente

**Files:**
- Create: `src/lib/supabase.ts`, `.env.example`, `.env.local`

**Interfaces:**
- Produces: `const supabase: SupabaseClient` exportado de `@/lib/supabase`.

- [ ] **Step 1: Criar projeto no Supabase e pegar as chaves**

Pelo painel do Supabase (ou MCP), criar um projeto free. Anotar `Project URL` e `publishable/anon key`.

- [ ] **Step 2: Criar `.env.example` (commitado) e `.env.local` (gitignored)**

`.env.example`:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=cole-a-publishable-key-aqui
```

`.env.local`: mesma estrutura, com os valores reais.

- [ ] **Step 3: Implementar `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env.local')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
```

- [ ] **Step 4: Verificar que o app sobe lendo as envs**

```bash
npm run dev    # não deve lançar o erro de envs faltando; Ctrl+C depois
```

- [ ] **Step 5: Commit (sem segredos)**

```bash
git add src/lib/supabase.ts .env.example
git commit -m "feat: cliente Supabase + template de env"
```

---

### Task 5: Banco — tabela `profiles` + RLS + trigger de criação

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Produces: tabela `public.profiles` (1:1 com `auth.users`), RLS por dono, e trigger que cria a linha de profile no signup.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0001_profiles.sql`:

```sql
-- Profiles: estende auth.users (1:1)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  theme_color text not null default 'verde',
  dark_mode boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Cria o profile automaticamente quando um usuário se cadastra
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase**

Via Supabase CLI (`supabase db push`) ou pelo SQL editor / MCP `apply_migration`. Conferir no painel que a tabela `profiles` existe com RLS ativo.

- [ ] **Step 3: Verificação manual do trigger**

Criar um usuário de teste pelo painel de Auth e confirmar que apareceu uma linha em `profiles` com `theme_color = 'verde'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat(db): tabela profiles + RLS + trigger de signup"
```

---

### Task 6: AuthProvider (sessão Supabase)

**Files:**
- Create: `src/providers/AuthProvider.tsx`, `src/providers/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`.
- Produces:
  - `function AuthProvider({ children }): JSX.Element`
  - `function useAuth(): { session: Session | null; user: User | null; loading: boolean }`

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/AuthProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthProvider'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

function Probe() {
  const { loading, user } = useAuth()
  return <div>{loading ? 'carregando' : user ? 'logado' : 'deslogado'}</div>
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('começa carregando e resolve para deslogado quando não há sessão', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/providers/AuthProvider.test.tsx`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/providers/AuthProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = { session: Session | null; user: User | null; loading: boolean }
const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/providers/AuthProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/AuthProvider.tsx src/providers/AuthProvider.test.tsx
git commit -m "feat: AuthProvider com sessão Supabase + useAuth"
```

---

### Task 7: ThemeProvider (aplica e persiste tema)

**Files:**
- Create: `src/providers/ThemeProvider.tsx`, `src/providers/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: `applyTheme`, `isThemeSlug`, `ThemeSlug` de `@/lib/theme`.
- Produces:
  - `function ThemeProvider({ children }): JSX.Element`
  - `function useTheme(): { theme: ThemeSlug; dark: boolean; setTheme(s: ThemeSlug): void; setDark(d: boolean): void }`
  - Persiste em `localStorage` (`cuidi.theme`, `cuidi.dark`). *(Sincronização com `profiles` entra no Plano 5.)*

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/ThemeProvider.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, dark, setTheme, setDark } = useTheme()
  return (
    <div>
      <span data-testid="t">{theme}</span>
      <span data-testid="d">{String(dark)}</span>
      <button onClick={() => setTheme('rosa')}>rosa</button>
      <button onClick={() => setDark(true)}>dark</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.className = '' })

  it('default verde claro e reflete no <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('t').textContent).toBe('verde')
    expect(document.documentElement.getAttribute('data-theme')).toBe('verde')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('troca tema/modo, aplica no <html> e persiste', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('rosa'))
    await userEvent.click(screen.getByText('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('rosa')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('cuidi.theme')).toBe('rosa')
    expect(localStorage.getItem('cuidi.dark')).toBe('true')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/providers/ThemeProvider.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/providers/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, isThemeSlug, type ThemeSlug } from '@/lib/theme'

type ThemeState = {
  theme: ThemeSlug; dark: boolean
  setTheme: (s: ThemeSlug) => void; setDark: (d: boolean) => void
}
const ThemeContext = createContext<ThemeState | null>(null)

function readInitial(): { theme: ThemeSlug; dark: boolean } {
  const t = localStorage.getItem('cuidi.theme')
  const d = localStorage.getItem('cuidi.dark')
  return { theme: isThemeSlug(t) ? t : 'verde', dark: d === 'true' }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [{ theme, dark }, setState] = useState(readInitial)

  useEffect(() => {
    applyTheme(document.documentElement, theme, dark)
    localStorage.setItem('cuidi.theme', theme)
    localStorage.setItem('cuidi.dark', String(dark))
  }, [theme, dark])

  return (
    <ThemeContext.Provider value={{
      theme, dark,
      setTheme: (s) => setState(prev => ({ ...prev, theme: s })),
      setDark: (d) => setState(prev => ({ ...prev, dark: d })),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/providers/ThemeProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/ThemeProvider.tsx src/providers/ThemeProvider.test.tsx
git commit -m "feat: ThemeProvider aplica e persiste tema/modo"
```

---

### Task 8: Rotas protegidas/públicas + bootstrap dos providers

**Files:**
- Create: `src/routes/ProtectedRoute.tsx`, `src/routes/PublicRoute.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider`, `ThemeProvider`.
- Produces:
  - `function ProtectedRoute(): JSX.Element` — redireciona para `/entrar` se deslogado.
  - `function PublicRoute(): JSX.Element` — redireciona para `/` se logado.

- [ ] **Step 1: Escrever `src/routes/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted">Carregando…</div>
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}
```

- [ ] **Step 2: Escrever `src/routes/PublicRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted">Carregando…</div>
  return user ? <Navigate to="/" replace /> : <Outlet />
}
```

- [ ] **Step 3: Escrever `src/main.tsx` (providers + router + query client)**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 4: Esqueleto de rotas em `src/App.tsx`** (páginas reais nas próximas tasks; placeholders temporários aqui)

```tsx
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/entrar" element={<div>login em breve</div>} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<div>hoje em breve</div>} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 5: Verificar build e navegação**

```bash
npm run build
npm run dev   # abrir /; deslogado deve redirecionar para /entrar
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: rotas protegidas/públicas + bootstrap de providers"
```

---

### Task 9: Página de Login

**Files:**
- Create: `src/pages/auth/Login.tsx`, `src/pages/auth/Login.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, componentes shadcn `Button/Input/Label/Card`, `sonner` toast.
- Produces: `function Login(): JSX.Element` na rota `/entrar`.

- [ ] **Step 1: Escrever o teste que falha (validação de formulário)**

`src/pages/auth/Login.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } },
}))

describe('Login', () => {
  it('mostra erro de validação quando e-mail é inválido', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'invalido')
    await userEvent.type(screen.getByLabelText(/senha/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(await screen.findByText(/e-mail inválido/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/auth/Login.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/pages/auth/Login.tsx`**

```tsx
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

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Form) {
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) { toast.error('Não foi possível entrar. Confira e-mail e senha.'); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <Card className="w-full max-w-sm p-6 shadow-card">
        <h1 className="text-2xl font-bold mb-1">Cuidi</h1>
        <p className="text-muted mb-6">Entre para cuidar dos seus remédios.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-error text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-error text-sm mt-1">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>Entrar</Button>
        </form>
        <div className="flex justify-between mt-4 text-sm">
          <Link to="/esqueci-senha" className="text-primary">Esqueci a senha</Link>
          <Link to="/cadastrar" className="text-primary">Criar conta</Link>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Ligar a rota em `src/App.tsx`** (substituir o placeholder de `/entrar`)

```tsx
import Login from '@/pages/auth/Login'
// ...
<Route path="/entrar" element={<Login />} />
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/pages/auth/Login.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: página de login com validação"
```

---

### Task 10: Cadastro + recuperação de senha

**Files:**
- Create: `src/pages/auth/Signup.tsx`, `src/pages/auth/ForgotPassword.tsx`, `src/pages/auth/ResetPassword.tsx`, `src/pages/auth/Signup.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signUp`, `supabase.auth.resetPasswordForEmail`, `supabase.auth.updateUser`.
- Produces: rotas `/cadastrar`, `/esqueci-senha`, `/redefinir-senha`.

- [ ] **Step 1: Escrever o teste que falha (cadastro chama signUp)**

`src/pages/auth/Signup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Signup from './Signup'

const signUp = vi.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null })
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a) } } }))

describe('Signup', () => {
  it('chama signUp com e-mail, senha e display_name', async () => {
    render(<MemoryRouter><Signup /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Maria')
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'maria@ex.com')
    await userEvent.type(screen.getByLabelText(/senha/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }))
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'maria@ex.com', password: '123456',
      options: expect.objectContaining({ data: { display_name: 'Maria' } }),
    }))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/auth/Signup.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/pages/auth/Signup.tsx`**

```tsx
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

const schema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function Signup() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    const { error } = await supabase.auth.signUp({
      email: v.email, password: v.password,
      options: { data: { display_name: v.name } },
    })
    if (error) { toast.error('Não foi possível criar a conta.'); return }
    toast.success('Conta criada! Confira seu e-mail se a confirmação estiver ativa.')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <Card className="w-full max-w-sm p-6 shadow-card">
        <h1 className="text-2xl font-bold mb-6">Criar conta</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-error text-sm mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-error text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-error text-sm mt-1">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>Criar conta</Button>
        </form>
        <div className="mt-4 text-sm">
          <Link to="/entrar" className="text-primary">Já tenho conta</Link>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Implementar `src/pages/auth/ForgotPassword.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

const schema = z.object({ email: z.string().email('E-mail inválido') })
type Form = z.infer<typeof schema>

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    await supabase.auth.resetPasswordForEmail(v.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    toast.success('Se o e-mail existir, enviamos um link de redefinição.')
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <Card className="w-full max-w-sm p-6 shadow-card">
        <h1 className="text-2xl font-bold mb-1">Recuperar senha</h1>
        <p className="text-muted mb-6">Enviaremos um link para o seu e-mail.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-error text-sm mt-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>Enviar link</Button>
        </form>
        <div className="mt-4 text-sm"><Link to="/entrar" className="text-primary">Voltar ao login</Link></div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Implementar `src/pages/auth/ResetPassword.tsx`** (usuário chega aqui pelo link do e-mail; a sessão de recovery já está ativa via `detectSessionInUrl`)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) { toast.error('Link expirado. Peça um novo.'); return }
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
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Ligar as rotas em `src/App.tsx`** (dentro de `<PublicRoute>`, exceto `/redefinir-senha` que pode ficar fora dos guards)

```tsx
import Signup from '@/pages/auth/Signup'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
// dentro de <Route element={<PublicRoute />}>:
<Route path="/cadastrar" element={<Signup />} />
<Route path="/esqueci-senha" element={<ForgotPassword />} />
// fora dos guards (sessão de recovery):
<Route path="/redefinir-senha" element={<ResetPassword />} />
```

- [ ] **Step 7: Rodar testes e build**

Run: `npx vitest run && npm run build`
Expected: PASS + build OK.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: cadastro e recuperação de senha"
```

---

### Task 11: App shell + bottom nav + páginas placeholder

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/BottomNav.tsx`, `src/pages/Hoje.tsx`, `src/pages/Remedios.tsx`, `src/pages/Historico.tsx`, `src/pages/Configuracoes.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth`, `supabase.auth.signOut`, `react-router-dom`, ícones `lucide-react`.
- Produces: layout privado com navegação inferior (Hoje, Remédios, Histórico, Config) e botão de sair. Páginas reais entram nos Planos 2–5.

- [ ] **Step 1: Implementar `src/components/layout/BottomNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { CalendarCheck, Pill, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Hoje', Icon: CalendarCheck, end: true },
  { to: '/remedios', label: 'Remédios', Icon: Pill },
  { to: '/historico', label: 'Histórico', Icon: BarChart3 },
  { to: '/configuracoes', label: 'Ajustes', Icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-border">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-2 text-xs',
              isActive ? 'text-primary' : 'text-muted',
            )}>
              <Icon size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Implementar `src/components/layout/AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-full max-w-md mx-auto pb-20">
      <header className="flex items-center justify-between p-4">
        <span className="text-xl font-bold text-primary">Cuidi</span>
        <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="text-muted">
          <LogOut size={20} />
        </button>
      </header>
      <main className="px-4"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Criar as 4 páginas placeholder**

`src/pages/Hoje.tsx`:

```tsx
export default function Hoje() {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">Hoje</h1>
      <p className="text-muted">Suas doses de hoje aparecerão aqui.</p>
    </section>
  )
}
```

`src/pages/Remedios.tsx`, `src/pages/Historico.tsx`, `src/pages/Configuracoes.tsx`: idênticos em estrutura, trocando título/texto:
- Remédios → "Meus remédios" / "Seus medicamentos aparecerão aqui."
- Histórico → "Histórico" / "Seu gráfico de adesão aparecerá aqui."
- Configurações → "Ajustes" / "Tema e notificações entram em breve."

- [ ] **Step 4: Montar as rotas privadas com o shell em `src/App.tsx`**

```tsx
import { AppShell } from '@/components/layout/AppShell'
import Hoje from '@/pages/Hoje'
import Remedios from '@/pages/Remedios'
import Historico from '@/pages/Historico'
import Configuracoes from '@/pages/Configuracoes'
// dentro de <Route element={<ProtectedRoute />}>:
<Route element={<AppShell />}>
  <Route path="/" element={<Hoje />} />
  <Route path="/remedios" element={<Remedios />} />
  <Route path="/historico" element={<Historico />} />
  <Route path="/configuracoes" element={<Configuracoes />} />
</Route>
```

- [ ] **Step 5: Verificação manual ponta a ponta**

```bash
npm run dev
```
Fluxo: cadastrar → cair na shell em `/` → navegar pelas 4 abas → sair → cai em `/entrar` → logar de volta.

- [ ] **Step 6: Rodar toda a suíte e o build**

Run: `npx vitest run && npm run build`
Expected: todos PASS + build OK.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: app shell autenticado com navegação inferior"
```

---

### Task 12: PWA base (manifest + service worker + instalável)

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- Produces: app instalável ("Adicionar à tela inicial") com service worker. *(Ícones finais e onboarding de instalação detalhados no Plano 7; aqui geramos ícones provisórios a partir de `docs/design/logo.svg`.)*

- [ ] **Step 1: Instalar o plugin PWA**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Gerar ícones provisórios a partir do logo** (requer `rsvg-convert` ou `sharp`; alternativa: exportar manualmente)

```bash
mkdir -p public/icons
# Exemplo com rsvg-convert (brew install librsvg). Se indisponível, exporte do logo.svg manualmente.
rsvg-convert -w 192 -h 192 docs/design/logo.svg -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 docs/design/logo.svg -o public/icons/icon-512.png
cp public/icons/icon-512.png public/icons/maskable-512.png
```

- [ ] **Step 3: Configurar o plugin no `vite.config.ts`** (adicionar ao array `plugins`)

```ts
import { VitePWA } from 'vite-plugin-pwa'
// plugins: [react(), VitePWA({ ... })]
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/*.png'],
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
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```

- [ ] **Step 4: Garantir as metatags no `index.html`** (dentro de `<head>`)

```html
<meta name="theme-color" content="#2aa179" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<title>Cuidi</title>
```

- [ ] **Step 5: Verificar build do PWA**

```bash
npm run build
npm run preview   # abrir, verificar no DevTools > Application que o manifest e o SW carregam
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: PWA base (manifest + service worker + ícones provisórios)"
```

---

## Self-Review (cobertura do spec)

- **Auth (cadastro/login/recuperação):** Tasks 6, 9, 10. ✅
- **Tema personalizável (cor + dark):** Tasks 2, 3, 7 (UI de troca fica no Plano 5; mecanismo pronto). ✅
- **PWA instalável:** Task 12 (ícones/onboarding finais no Plano 7). ✅
- **RLS / profiles:** Task 5. ✅
- **Stack do `casa-gestao`:** Tasks 1, 2. ✅
- **Tokens de design do Cuidi:** Task 2 (consome `docs/design/theme.css`). ✅
- **Fora do escopo deste plano (próximos):** medications/doses/CRUD (Plano 2), Hoje/adesão (Plano 3), histórico/PDF (Plano 4), preferências/UI de tema (Plano 5), notificações (Plano 6), deploy/ícones finais (Plano 7).

Sem placeholders de implementação; tipos e nomes de função consistentes entre tasks (`applyTheme`, `useAuth`, `useTheme`, `AppShell`, `BottomNav`, rotas).
