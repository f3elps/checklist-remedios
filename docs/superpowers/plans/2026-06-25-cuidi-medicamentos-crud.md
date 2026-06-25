# Cuidi — Plano de Implementação 2: Medicamentos (CRUD) + lógica de domínio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastrar, listar, editar e excluir medicamentos (ilimitados), com posologia e estoque, mostrando "acaba em X dias" calculado pelo consumo.

**Architecture:** Tabela `medications` (Postgres + RLS) acessada via hooks TanStack Query sobre o cliente Supabase. Lógica de domínio pura e testada (doses/dia a partir da posologia; dias restantes a partir do estoque) isolada em `src/lib/medications.ts`. Telas: lista de remédios + formulário guiado de criar/editar, reusando o app shell e os tokens de design do Plano 1.

**Tech Stack:** (continuação do Plano 1) Vite + React 19 + TS, Tailwind 3.4, shadcn/ui (Radix, manual), @supabase/supabase-js 2, @tanstack/react-query 5, react-hook-form + zod, react-router-dom 7, date-fns 4, Vitest + Testing Library.

## Global Constraints

- **Idioma da UI:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** o do Plano 1. Tailwind **3.4** (não 4). Componentes shadcn adicionados **manualmente** (Radix + cva), no padrão dos já existentes em `src/components/ui/`.
- **Design tokens:** usar as classes/tokens do Cuidi (`bg-surface`, `text-text`, `text-muted`, `text-primary`, `border-border`, `text-error`, `shadow-card`, `rounded`/`rounded-sm`/`rounded-lg`). **Nenhum hex hardcoded.**
- **RLS:** `medications` com RLS estrita por `auth.uid()` (select/insert/update/delete do próprio dono).
- **Unidades:** `unit` é a MESMA para dose e estoque de um remédio (ex.: comprimido/ml/gota). `dose_amount` e `stock_quantity` são `numeric` na mesma unidade.
- **schedule_config (jsonb)** por `schedule_type`:
  - `vezes_por_dia` → `{ "per_day": <int ≥ 1> }`
  - `de_x_em_x_horas` → `{ "interval_hours": <int 1..24> }`
  - `horarios_fixos` → `{ "times": ["HH:MM", ...] }` (≥ 1)
- **Commits:** um por task, mensagem em português, prefixo convencional.
- **Banco:** a migration deste plano (`0002_medications.sql`) é criada como arquivo; **aplicar no projeto Supabase é ação do usuário** (projeto não conectado à integração). Os testes mockam o Supabase, então não dependem do banco vivo.

---

## Estrutura de arquivos (criada/alterada neste plano)

```
supabase/migrations/0002_medications.sql        # tabela medications + RLS + índice
src/lib/medications.ts                           # tipos + lógica pura (doses/dia, dias restantes)
src/lib/medications.test.ts
src/hooks/useMedications.ts                      # hooks TanStack Query (list/create/update/delete)
src/hooks/useMedications.test.tsx
src/components/ui/select.tsx                      # shadcn (Radix) — novo
src/components/ui/textarea.tsx                    # shadcn — novo
src/components/ui/alert-dialog.tsx                # shadcn (Radix) — novo (confirmar exclusão)
src/components/medications/MedicationCard.tsx
src/components/medications/MedicationCard.test.tsx
src/components/medications/MedicationForm.tsx
src/components/medications/MedicationForm.test.tsx
src/pages/Remedios.tsx                            # reescrita: lista real
src/pages/MedicationFormPage.tsx                  # criar/editar (mesma página, 2 rotas)
src/App.tsx                                        # + rotas /remedios/novo e /remedios/:id/editar
```

---

### Task 1: Migration `medications`

**Files:**
- Create: `supabase/migrations/0002_medications.sql`

**Interfaces:**
- Produces: tabela `public.medications` com RLS por dono e índice `(user_id, active)`.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0002_medications.sql`:

```sql
-- Medicamentos do usuário (ilimitados)
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null,                         -- comprimido | ml | gota | aplicacao | ...
  dose_amount numeric not null check (dose_amount > 0),
  schedule_type text not null check (schedule_type in ('vezes_por_dia','de_x_em_x_horas','horarios_fixos')),
  schedule_config jsonb not null default '{}'::jsonb,
  stock_quantity numeric not null default 0 check (stock_quantity >= 0),
  start_date date not null default current_date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index medications_user_active_idx on public.medications (user_id, active);

alter table public.medications enable row level security;

create policy "medications_select_own" on public.medications
  for select using (auth.uid() = user_id);
create policy "medications_insert_own" on public.medications
  for insert with check (auth.uid() = user_id);
create policy "medications_update_own" on public.medications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "medications_delete_own" on public.medications
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit** (NÃO aplicar no banco — ação do usuário)

```bash
git add supabase/migrations/0002_medications.sql
git commit -m "feat(db): tabela medications + RLS"
```

---

### Task 2: Tipos + lógica de domínio (TDD)

**Files:**
- Create: `src/lib/medications.ts`, `src/lib/medications.test.ts`

**Interfaces:**
- Produces:
  - `type Unit = string` (livre, ex. 'comprimido')
  - `type ScheduleType = 'vezes_por_dia' | 'de_x_em_x_horas' | 'horarios_fixos'`
  - `type ScheduleConfig = { per_day: number } | { interval_hours: number } | { times: string[] }`
  - `interface Medication { id; user_id; name; unit; dose_amount; schedule_type; schedule_config; stock_quantity; start_date; active; notes; created_at }`
  - `type MedicationInput` = campos editáveis (sem id/user_id/created_at)
  - `function dosesPerDay(type: ScheduleType, cfg: ScheduleConfig): number`
  - `function dailyConsumption(doseAmount: number, type: ScheduleType, cfg: ScheduleConfig): number`
  - `function daysLeft(stock: number, doseAmount: number, type: ScheduleType, cfg: ScheduleConfig): number | null` (null quando consumo = 0)

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/medications.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dosesPerDay, dailyConsumption, daysLeft } from './medications'

describe('dosesPerDay', () => {
  it('vezes_por_dia usa per_day', () => {
    expect(dosesPerDay('vezes_por_dia', { per_day: 3 })).toBe(3)
  })
  it('de_x_em_x_horas = floor(24 / interval)', () => {
    expect(dosesPerDay('de_x_em_x_horas', { interval_hours: 8 })).toBe(3)
    expect(dosesPerDay('de_x_em_x_horas', { interval_hours: 5 })).toBe(4)
  })
  it('horarios_fixos usa o tamanho da lista', () => {
    expect(dosesPerDay('horarios_fixos', { times: ['08:00', '20:00'] })).toBe(2)
  })
})

describe('dailyConsumption', () => {
  it('multiplica dose pela quantidade de doses no dia', () => {
    expect(dailyConsumption(2, 'vezes_por_dia', { per_day: 3 })).toBe(6)
  })
})

describe('daysLeft', () => {
  it('floor(estoque / consumo diário)', () => {
    // estoque 20, dose 1, 2x/dia => consumo 2/dia => 10 dias
    expect(daysLeft(20, 1, 'vezes_por_dia', { per_day: 2 })).toBe(10)
    // estoque 13, consumo 2/dia => floor(6.5) = 6
    expect(daysLeft(13, 1, 'vezes_por_dia', { per_day: 2 })).toBe(6)
  })
  it('retorna null quando o consumo diário é zero', () => {
    expect(daysLeft(10, 0, 'vezes_por_dia', { per_day: 2 })).toBeNull()
    expect(daysLeft(10, 1, 'de_x_em_x_horas', { interval_hours: 0 as unknown as number })).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/medications.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/medications.ts`**

```ts
export type ScheduleType = 'vezes_por_dia' | 'de_x_em_x_horas' | 'horarios_fixos'

export type ScheduleConfig =
  | { per_day: number }
  | { interval_hours: number }
  | { times: string[] }

export interface Medication {
  id: string
  user_id: string
  name: string
  unit: string
  dose_amount: number
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  stock_quantity: number
  start_date: string
  active: boolean
  notes: string | null
  created_at: string
}

export type MedicationInput = Pick<
  Medication,
  'name' | 'unit' | 'dose_amount' | 'schedule_type' | 'schedule_config' | 'stock_quantity' | 'start_date' | 'notes'
>

export function dosesPerDay(type: ScheduleType, cfg: ScheduleConfig): number {
  if (type === 'vezes_por_dia' && 'per_day' in cfg) return Math.max(0, Math.floor(cfg.per_day))
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) {
    const h = cfg.interval_hours
    return h > 0 ? Math.floor(24 / h) : 0
  }
  if (type === 'horarios_fixos' && 'times' in cfg) return cfg.times.length
  return 0
}

export function dailyConsumption(doseAmount: number, type: ScheduleType, cfg: ScheduleConfig): number {
  return doseAmount * dosesPerDay(type, cfg)
}

export function daysLeft(
  stock: number,
  doseAmount: number,
  type: ScheduleType,
  cfg: ScheduleConfig,
): number | null {
  const perDay = dailyConsumption(doseAmount, type, cfg)
  if (perDay <= 0) return null
  return Math.floor(stock / perDay)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/medications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/medications.ts src/lib/medications.test.ts
git commit -m "feat: tipos e lógica de domínio de medicamentos (doses/dia, dias restantes)"
```

---

### Task 3: Hooks de dados (TanStack Query) — TDD

**Files:**
- Create: `src/hooks/useMedications.ts`, `src/hooks/useMedications.test.tsx`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `Medication`, `MedicationInput` de `@/lib/medications`.
- Produces:
  - `function useMedications(): UseQueryResult<Medication[]>` (lista ativos, ordem por `name`)
  - `function useCreateMedication(): UseMutationResult<Medication, Error, MedicationInput>`
  - `function useUpdateMedication(): UseMutationResult<Medication, Error, { id: string; values: Partial<MedicationInput> }>`
  - `function useDeleteMedication(): UseMutationResult<void, Error, string>`
  - Chave de query: `['medications']`. Mutations invalidam `['medications']`.

- [ ] **Step 1: Escrever o teste que falha**

`src/hooks/useMedications.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMedications } from './useMedications'

const order = vi.fn().mockResolvedValue({
  data: [{ id: '1', name: 'Dipirona' }], error: null,
})
const eq = vi.fn(() => ({ order }))
const select = vi.fn(() => ({ eq }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMedications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca os medicamentos ativos via supabase', async () => {
    const { result } = renderHook(() => useMedications(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '1', name: 'Dipirona' }])
    expect(select).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('active', true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useMedications.test.tsx`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/hooks/useMedications.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Medication, MedicationInput } from '@/lib/medications'

const KEY = ['medications'] as const

export function useMedications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as Medication[]
    },
  })
}

export function useCreateMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MedicationInput): Promise<Medication> => {
      const { data: userData } = await supabase.auth.getUser()
      const user_id = userData.user?.id
      const { data, error } = await supabase
        .from('medications')
        .insert({ ...input, user_id })
        .select()
        .single()
      if (error) throw error
      return data as Medication
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<MedicationInput> }): Promise<Medication> => {
      const { data, error } = await supabase
        .from('medications')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Medication
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('medications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/useMedications.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte e commit**

```bash
npm run test
git add src/hooks/useMedications.ts src/hooks/useMedications.test.tsx
git commit -m "feat: hooks de medicamentos (list/create/update/delete via React Query)"
```

---

### Task 4: Componentes shadcn novos (select, textarea, alert-dialog)

**Files:**
- Create: `src/components/ui/select.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/alert-dialog.tsx`

**Interfaces:**
- Produces: primitivas shadcn (Radix + tokens Cuidi) usadas pelo formulário e pela exclusão.

- [ ] **Step 1: Instalar as deps Radix necessárias**

```bash
npm install @radix-ui/react-select @radix-ui/react-alert-dialog
```

- [ ] **Step 2: Criar `src/components/ui/textarea.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-sm border border-border bg-surface px-3 py-2 text-base',
        'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
```

- [ ] **Step 3: Criar `src/components/ui/select.tsx`** (wrapper shadcn padrão sobre `@radix-ui/react-select`, com tokens Cuidi)

```tsx
import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-base',
      'focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-sm border border-border bg-surface text-text shadow-card',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-base',
      'outline-none focus:bg-primary-soft data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName
```

- [ ] **Step 4: Criar `src/components/ui/alert-dialog.tsx`** (wrapper shadcn padrão sobre `@radix-ui/react-alert-dialog`, tokens Cuidi)

```tsx
import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogPortal = AlertDialogPrimitive.Portal

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/40', className)}
    {...props}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2',
        'rounded-lg border border-border bg-surface p-6 shadow-card',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-2', className)} {...props} />
}
export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex justify-end gap-2', className)} {...props} />
}

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('text-lg font-bold', className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn('text-muted', className)} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'secondary' }), className)}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName
```

> **Pré-requisito:** `src/components/ui/button.tsx` deve exportar `buttonVariants` (o template shadcn do Plano 1 já exporta `Button` e `buttonVariants`). Se por acaso não exportar, adicione `export` ao `buttonVariants` existente — alteração mínima, registre no relatório.

- [ ] **Step 5: Verificar build e commit**

```bash
npm run build
git add src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/alert-dialog.tsx package.json package-lock.json
git commit -m "feat: componentes shadcn select, textarea e alert-dialog"
```

---

### Task 5: `MedicationCard` (TDD)

**Files:**
- Create: `src/components/medications/MedicationCard.tsx`, `src/components/medications/MedicationCard.test.tsx`

**Interfaces:**
- Consumes: `Medication`, `daysLeft` de `@/lib/medications`; `Card`.
- Produces: `function MedicationCard({ med, onEdit, onDelete }: { med: Medication; onEdit: (m: Medication) => void; onDelete: (m: Medication) => void }): JSX.Element`
  - Mostra nome, posologia legível, e linha de estoque: `"{stock} {unit} · acaba em {n} dias"`; se `daysLeft` é null, mostra `"sem consumo definido"`.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/medications/MedicationCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MedicationCard } from './MedicationCard'
import type { Medication } from '@/lib/medications'

const med: Medication = {
  id: '1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 20, start_date: '2026-01-01', active: true, notes: null, created_at: '',
}

describe('MedicationCard', () => {
  it('mostra nome e estoque com dias restantes', () => {
    render(<MedicationCard med={med} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Dipirona')).toBeInTheDocument()
    // 20 / (1*2) = 10 dias
    expect(screen.getByText(/acaba em 10 dias/i)).toBeInTheDocument()
    expect(screen.getByText(/20 comprimido/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/medications/MedicationCard.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/medications/MedicationCard.tsx`**

```tsx
import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { daysLeft, type Medication, type ScheduleType, type ScheduleConfig } from '@/lib/medications'

function posologia(type: ScheduleType, cfg: ScheduleConfig): string {
  if (type === 'vezes_por_dia' && 'per_day' in cfg) return `${cfg.per_day}x por dia`
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) return `de ${cfg.interval_hours} em ${cfg.interval_hours} horas`
  if (type === 'horarios_fixos' && 'times' in cfg) return `às ${cfg.times.join(', ')}`
  return ''
}

export function MedicationCard({
  med, onEdit, onDelete,
}: {
  med: Medication
  onEdit: (m: Medication) => void
  onDelete: (m: Medication) => void
}) {
  const dl = daysLeft(med.stock_quantity, med.dose_amount, med.schedule_type, med.schedule_config)
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{med.name}</h3>
          <p className="text-muted text-sm">{med.dose_amount} {med.unit} · {posologia(med.schedule_type, med.schedule_config)}</p>
          <p className="text-sm mt-1">
            {med.stock_quantity} {med.unit} ·{' '}
            {dl === null ? 'sem consumo definido' : <span className={dl <= 7 ? 'text-amber' : ''}>acaba em {dl} dias</span>}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button aria-label="Editar" className="text-muted p-1" onClick={() => onEdit(med)}><Pencil size={18} /></button>
          <button aria-label="Excluir" className="text-muted p-1" onClick={() => onDelete(med)}><Trash2 size={18} /></button>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/medications/MedicationCard.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/medications/MedicationCard.tsx src/components/medications/MedicationCard.test.tsx
git commit -m "feat: MedicationCard com estoque e dias restantes"
```

---

### Task 6: `MedicationForm` (TDD)

**Files:**
- Create: `src/components/medications/MedicationForm.tsx`, `src/components/medications/MedicationForm.test.tsx`

**Interfaces:**
- Consumes: react-hook-form + zod; `Select`, `Input`, `Label`, `Textarea`, `Button`; `MedicationInput`, `ScheduleType` de `@/lib/medications`.
- Produces: `function MedicationForm({ defaultValues, onSubmit, submitting }: { defaultValues?: Partial<MedicationInput>; onSubmit: (v: MedicationInput) => void; submitting?: boolean }): JSX.Element`
  - Campos: nome, unit, dose_amount (number), schedule_type (select), campo condicional de posologia conforme o tipo, stock_quantity (number), start_date (date), notes (textarea).
  - Validação zod; monta o `schedule_config` correto a partir do tipo + campo condicional antes de chamar `onSubmit`.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/medications/MedicationForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MedicationForm } from './MedicationForm'

describe('MedicationForm', () => {
  it('exige o nome', async () => {
    render(<MedicationForm onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument()
  })

  it('envia schedule_config de vezes_por_dia', async () => {
    const onSubmit = vi.fn()
    render(<MedicationForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Dipirona')
    await userEvent.type(screen.getByLabelText(/unidade/i), 'comprimido')
    await userEvent.clear(screen.getByLabelText(/dose por tomada/i))
    await userEvent.type(screen.getByLabelText(/dose por tomada/i), '1')
    await userEvent.clear(screen.getByLabelText(/vezes por dia/i))
    await userEvent.type(screen.getByLabelText(/vezes por dia/i), '2')
    await userEvent.clear(screen.getByLabelText(/estoque atual/i))
    await userEvent.type(screen.getByLabelText(/estoque atual/i), '20')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Dipirona', unit: 'comprimido', dose_amount: 1,
      schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 }, stock_quantity: 20,
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/medications/MedicationForm.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/medications/MedicationForm.tsx`**

> Nota de implementação: o `schedule_type` default é `vezes_por_dia`. O `<select>` nativo via `Select` do shadcn é controlado; para simplicidade e testabilidade, este formulário usa um `<select>` HTML nativo estilizado com as classes do `SelectTrigger` (mantém o teste com `getByLabelText`/`selectOptions` simples). Os campos condicionais de posologia trocam conforme o tipo.

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { MedicationInput, ScheduleConfig } from '@/lib/medications'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  unit: z.string().min(1, 'Informe a unidade'),
  dose_amount: z.coerce.number().positive('Dose deve ser maior que 0'),
  schedule_type: z.enum(['vezes_por_dia', 'de_x_em_x_horas', 'horarios_fixos']),
  per_day: z.coerce.number().int().min(1).optional(),
  interval_hours: z.coerce.number().int().min(1).max(24).optional(),
  times: z.string().optional(), // "08:00, 20:00"
  stock_quantity: z.coerce.number().min(0, 'Estoque não pode ser negativo'),
  start_date: z.string().min(1),
  notes: z.string().optional(),
})
type Form = z.infer<typeof schema>

function buildConfig(v: Form): ScheduleConfig {
  if (v.schedule_type === 'de_x_em_x_horas') return { interval_hours: v.interval_hours ?? 8 }
  if (v.schedule_type === 'horarios_fixos') {
    const times = (v.times ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    return { times: times.length ? times : ['08:00'] }
  }
  return { per_day: v.per_day ?? 1 }
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function MedicationForm({
  defaultValues, onSubmit, submitting,
}: {
  defaultValues?: Partial<MedicationInput>
  onSubmit: (v: MedicationInput) => void
  submitting?: boolean
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      unit: defaultValues?.unit ?? '',
      dose_amount: defaultValues?.dose_amount ?? 1,
      schedule_type: defaultValues?.schedule_type ?? 'vezes_por_dia',
      stock_quantity: defaultValues?.stock_quantity ?? 0,
      start_date: defaultValues?.start_date ?? todayISO(),
      notes: defaultValues?.notes ?? '',
      per_day: 1, interval_hours: 8, times: '08:00, 20:00',
    },
  })
  const type = watch('schedule_type')

  function submit(v: Form) {
    const input: MedicationInput = {
      name: v.name, unit: v.unit, dose_amount: v.dose_amount,
      schedule_type: v.schedule_type, schedule_config: buildConfig(v),
      stock_quantity: v.stock_quantity, start_date: v.start_date, notes: v.notes ?? null,
    }
    onSubmit(input)
  }

  const selectClass = 'flex h-10 w-full items-center rounded-sm border border-border bg-surface px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-error text-sm mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <Label htmlFor="unit">Unidade (comprimido, ml, gota…)</Label>
        <Input id="unit" {...register('unit')} />
        {errors.unit && <p className="text-error text-sm mt-1">{errors.unit.message}</p>}
      </div>
      <div>
        <Label htmlFor="dose_amount">Dose por tomada</Label>
        <Input id="dose_amount" type="number" step="any" {...register('dose_amount')} />
        {errors.dose_amount && <p className="text-error text-sm mt-1">{errors.dose_amount.message}</p>}
      </div>
      <div>
        <Label htmlFor="schedule_type">Posologia</Label>
        <select id="schedule_type" className={selectClass} {...register('schedule_type')}>
          <option value="vezes_por_dia">X vezes por dia</option>
          <option value="de_x_em_x_horas">De X em X horas</option>
          <option value="horarios_fixos">Horários fixos</option>
        </select>
      </div>
      {type === 'vezes_por_dia' && (
        <div>
          <Label htmlFor="per_day">Vezes por dia</Label>
          <Input id="per_day" type="number" {...register('per_day')} />
        </div>
      )}
      {type === 'de_x_em_x_horas' && (
        <div>
          <Label htmlFor="interval_hours">De quantas em quantas horas</Label>
          <Input id="interval_hours" type="number" {...register('interval_hours')} />
        </div>
      )}
      {type === 'horarios_fixos' && (
        <div>
          <Label htmlFor="times">Horários (ex.: 08:00, 20:00)</Label>
          <Input id="times" {...register('times')} />
        </div>
      )}
      <div>
        <Label htmlFor="stock_quantity">Estoque atual</Label>
        <Input id="stock_quantity" type="number" step="any" {...register('stock_quantity')} />
        {errors.stock_quantity && <p className="text-error text-sm mt-1">{errors.stock_quantity.message}</p>}
      </div>
      <div>
        <Label htmlFor="start_date">Data de início</Label>
        <Input id="start_date" type="date" {...register('start_date')} />
      </div>
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" {...register('notes')} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Salvar</Button>
    </form>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/medications/MedicationForm.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/medications/MedicationForm.tsx src/components/medications/MedicationForm.test.tsx
git commit -m "feat: MedicationForm (formulário guiado com posologia condicional)"
```

---

### Task 7: Página `Remedios` (lista real)

**Files:**
- Modify: `src/pages/Remedios.tsx`

**Interfaces:**
- Consumes: `useMedications`, `useDeleteMedication`; `MedicationCard`; `AlertDialog*`; `useNavigate`; `toast`.
- Produces: lista de cards (ou estado vazio) + botão "Adicionar" (vai para `/remedios/novo`); editar navega para `/remedios/:id/editar`; excluir abre confirmação e chama `useDeleteMedication`.

- [ ] **Step 1: Implementar `src/pages/Remedios.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { MedicationCard } from '@/components/medications/MedicationCard'
import { useMedications, useDeleteMedication } from '@/hooks/useMedications'
import type { Medication } from '@/lib/medications'

export default function Remedios() {
  const navigate = useNavigate()
  const { data: meds, isLoading } = useMedications()
  const del = useDeleteMedication()
  const [toDelete, setToDelete] = useState<Medication | null>(null)

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.id)
      toast.success('Remédio excluído.')
    } catch {
      toast.error('Não foi possível excluir.')
    } finally {
      setToDelete(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus remédios</h1>
        <Button onClick={() => navigate('/remedios/novo')} className="gap-1">
          <Plus size={18} /> Adicionar
        </Button>
      </div>

      {isLoading && <p className="text-muted">Carregando…</p>}
      {!isLoading && meds && meds.length === 0 && (
        <p className="text-muted">Você ainda não cadastrou remédios. Toque em “Adicionar”.</p>
      )}

      <div className="space-y-3">
        {meds?.map((m) => (
          <MedicationCard
            key={m.id}
            med={m}
            onEdit={(med) => navigate(`/remedios/${med.id}/editar`)}
            onDelete={(med) => setToDelete(med)}
          />
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir remédio?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove “{toDelete?.name}” da sua lista. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
```

- [ ] **Step 2: Verificar build + suíte**

Run: `npm run build && npm run test`
Expected: build OK, testes passam.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Remedios.tsx
git commit -m "feat: lista de remédios com excluir (confirmação)"
```

---

### Task 8: Página de criar/editar + rotas

**Files:**
- Create: `src/pages/MedicationFormPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `MedicationForm`; `useMedications`, `useCreateMedication`, `useUpdateMedication`; `useParams`, `useNavigate`; `toast`.
- Produces: rota `/remedios/novo` (cria) e `/remedios/:id/editar` (edita) sob o `AppShell` protegido.

- [ ] **Step 1: Implementar `src/pages/MedicationFormPage.tsx`**

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MedicationForm } from '@/components/medications/MedicationForm'
import { useMedications, useCreateMedication, useUpdateMedication } from '@/hooks/useMedications'
import type { MedicationInput } from '@/lib/medications'

export default function MedicationFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: meds } = useMedications()
  const create = useCreateMedication()
  const update = useUpdateMedication()
  const editing = id ? meds?.find((m) => m.id === id) : undefined

  async function onSubmit(values: MedicationInput) {
    try {
      if (id) {
        await update.mutateAsync({ id, values })
        toast.success('Remédio atualizado.')
      } else {
        await create.mutateAsync(values)
        toast.success('Remédio adicionado.')
      }
      navigate('/remedios', { replace: true })
    } catch {
      toast.error('Não foi possível salvar.')
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{id ? 'Editar remédio' : 'Novo remédio'}</h1>
      <MedicationForm
        defaultValues={editing}
        onSubmit={onSubmit}
        submitting={create.isPending || update.isPending}
      />
    </section>
  )
}
```

- [ ] **Step 2: Ligar as rotas em `src/App.tsx`** (dentro do grupo `<Route element={<AppShell/>}>` sob `ProtectedRoute`)

```tsx
import MedicationFormPage from '@/pages/MedicationFormPage'
// dentro de <Route element={<AppShell />}>:
<Route path="/remedios/novo" element={<MedicationFormPage />} />
<Route path="/remedios/:id/editar" element={<MedicationFormPage />} />
```

- [ ] **Step 3: Verificar build + suíte + sanidade manual**

Run: `npm run build && npm run test`
Manual (descrever no relatório): em `/remedios`, "Adicionar" abre o formulário; salvar volta para a lista.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MedicationFormPage.tsx src/App.tsx
git commit -m "feat: páginas de criar e editar remédio + rotas"
```

---

## Self-Review (cobertura do spec)

- **Medicamentos ilimitados (nome, dose, posologia, estoque):** Tasks 1, 2, 6, 7, 8. ✅
- **Posologia (X vezes/dia · de Y em Y horas · horários fixos):** modelada em `schedule_config` (Task 2) e no formulário (Task 6). ✅
- **"Avisa antes de acabar" (base de cálculo):** `daysLeft`/`dailyConsumption` (Task 2), exibido no card com destaque ≤7 dias (Task 5). O *envio* do alerta é o Plano 6. ✅
- **CRUD completo:** list (7), create/update (8), delete com confirmação (7). ✅
- **RLS:** Task 1. ✅
- **Tokens de design / pt-BR / Tailwind 3.4 / shadcn manual:** Tasks 4–8. ✅
- **Fora do escopo (próximos):** materialização de doses + tela Hoje + adesão (Plano 3); export PDF (Plano 4); UI de tema/notificações (Plano 5); motor de notificações (Plano 6).

Sem placeholders de implementação. Tipos/nomes consistentes entre tasks (`Medication`, `MedicationInput`, `ScheduleConfig`, `dosesPerDay`, `daysLeft`, `useMedications`, `useCreateMedication`, `useUpdateMedication`, `useDeleteMedication`, `MedicationCard`, `MedicationForm`).
```
