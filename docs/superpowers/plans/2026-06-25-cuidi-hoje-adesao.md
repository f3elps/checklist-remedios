# Cuidi — Plano de Implementação 3: Hoje + registro de adesão

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar as doses de hoje (com horário) e deixar o usuário marcar "Tomei" / "Pular"; marcar "Tomei" dá baixa no estoque. Faixa de aviso de estoque baixo no topo.

**Architecture:** Tabela `doses` (Postgres + RLS) guarda o registro de adesão. As doses do dia NÃO são materializadas especulativamente: a tela "Hoje" calcula em memória os horários esperados de cada medicamento ativo (função pura), cruza com as linhas de `doses` já existentes do dia, e cria/atualiza uma linha de `doses` só quando o usuário toca "Tomei"/"Pular" (upsert idempotente pela unique `(medication_id, scheduled_at)`). "Tomei" também decrementa o estoque do medicamento. *(A materialização server-side + status "perdido" automático ficam no Plano 6 / Edge Function; aqui "atrasado" é só visual.)*

**Tech Stack:** (continuação) Vite + React 19 + TS, Tailwind 3.4, shadcn/ui (manual), @supabase/supabase-js 2, @tanstack/react-query 5, date-fns 4, react-router-dom 7, Vitest + Testing Library.

## Global Constraints

- **Idioma da UI:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** o dos planos 1–2. Tailwind **3.4**. shadcn manual. Tokens de design do Cuidi (`bg-surface`, `text-text`, `text-muted`, `text-primary`, `text-on-primary`, `bg-primary`, `bg-amber-soft`, `text-amber`, `border-border`, `text-error`, `shadow-card`, `rounded`/`-sm`/`-lg`). **Nenhum hex hardcoded.**
- **RLS:** `doses` com RLS estrita por `auth.uid()` (4 operações).
- **Tipos de dose/status:** `status` ∈ `pendente | tomado | pulado | perdido`.
- **Consistência com Plano 2:** a quantidade de horários gerados por dia é igual a `dosesPerDay(...)` (de `@/lib/medications`), para casar com o cálculo de depleção.
- **Baixa de estoque:** ao "Tomei", `stock_quantity := max(0, stock_quantity - dose_amount)`. "Pular" não mexe no estoque. (Decremento read-modify-write a partir do cache; aceitável para 1 usuário — registrar como nota.)
- **Sem `z.coerce` numérico:** se algum form numérico aparecer, usar `z.number()` + `valueAsNumber` (Zod 4). *(Este plano não tem forms.)*
- **Commits:** um por task, mensagem em português, prefixo convencional.
- **Banco:** a migration `0003_doses.sql` é criada como arquivo; **aplicar é ação do usuário** (projeto Supabase não conectado à integração). Testes mockam o Supabase.

---

## Estrutura de arquivos (criada/alterada)

```
supabase/migrations/0003_doses.sql               # tabela doses + RLS + índice + unique
src/lib/doses.ts                                  # tipos Dose + horários do dia + merge dos slots (puro)
src/lib/doses.test.ts
src/hooks/useDoses.ts                             # useDosesForDay + useMarkDose (TanStack Query)
src/hooks/useDoses.test.tsx
src/components/today/DoseItem.tsx                 # uma linha de dose (hora, nome, dose, status, Tomei/Pular)
src/components/today/DoseItem.test.tsx
src/components/today/LowStockBanner.tsx           # faixa de estoque baixo
src/pages/Hoje.tsx                                # reescrita: doses de hoje + banner
```

---

### Task 1: Migration `doses`

**Files:**
- Create: `supabase/migrations/0003_doses.sql`

**Interfaces:**
- Produces: tabela `public.doses` com RLS por dono, unique `(medication_id, scheduled_at)` e índice `(user_id, scheduled_at)`.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0003_doses.sql`:

```sql
-- Doses agendadas/registradas (fonte da adesão e do gráfico)
create table public.doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','tomado','pulado','perdido')),
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  unique (medication_id, scheduled_at)
);

create index doses_user_scheduled_idx on public.doses (user_id, scheduled_at);

alter table public.doses enable row level security;

create policy "doses_select_own" on public.doses
  for select using (auth.uid() = user_id);
create policy "doses_insert_own" on public.doses
  for insert with check (auth.uid() = user_id);
create policy "doses_update_own" on public.doses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doses_delete_own" on public.doses
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit** (NÃO aplicar no banco — ação do usuário)

```bash
git add supabase/migrations/0003_doses.sql
git commit -m "feat(db): tabela doses + RLS"
```

---

### Task 2: Horários do dia + tipos (TDD)

**Files:**
- Create: `src/lib/doses.ts`, `src/lib/doses.test.ts`

**Interfaces:**
- Consumes: `dosesPerDay`, `ScheduleType`, `ScheduleConfig` de `@/lib/medications`.
- Produces:
  - `type DoseStatus = 'pendente' | 'tomado' | 'pulado' | 'perdido'`
  - `interface Dose { id; medication_id; user_id; scheduled_at; status; taken_at; created_at }`
  - `function minutesToHHMM(min: number): string`
  - `function doseTimesForDay(type: ScheduleType, cfg: ScheduleConfig): string[]` (HH:MM ordenados, comprimento = `dosesPerDay`)
  - `function scheduledAtFor(dayISO: string, hhmm: string): string` (ISO timestamp; `new Date(\`${dayISO}T${hhmm}:00\`).toISOString()`)

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/doses.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { minutesToHHMM, doseTimesForDay, scheduledAtFor } from './doses'

describe('minutesToHHMM', () => {
  it('formata com zero à esquerda', () => {
    expect(minutesToHHMM(480)).toBe('08:00')
    expect(minutesToHHMM(0)).toBe('00:00')
    expect(minutesToHHMM(1230)).toBe('20:30')
  })
})

describe('doseTimesForDay', () => {
  it('horarios_fixos usa e ordena os horários', () => {
    expect(doseTimesForDay('horarios_fixos', { times: ['20:00', '08:00'] })).toEqual(['08:00', '20:00'])
  })
  it('vezes_por_dia espalha entre 08:00 e 20:00', () => {
    expect(doseTimesForDay('vezes_por_dia', { per_day: 1 })).toEqual(['08:00'])
    expect(doseTimesForDay('vezes_por_dia', { per_day: 2 })).toEqual(['08:00', '20:00'])
    expect(doseTimesForDay('vezes_por_dia', { per_day: 3 })).toEqual(['08:00', '14:00', '20:00'])
  })
  it('de_x_em_x_horas gera dosesPerDay horários a partir das 08:00', () => {
    // interval 8 => 3 doses: 08:00, 16:00, 00:00 -> ordenado
    expect(doseTimesForDay('de_x_em_x_horas', { interval_hours: 8 })).toEqual(['00:00', '08:00', '16:00'])
  })
})

describe('scheduledAtFor', () => {
  it('é estável: mesma data+hora => mesmo ISO', () => {
    const a = scheduledAtFor('2026-06-25', '08:00')
    const b = scheduledAtFor('2026-06-25', '08:00')
    expect(a).toBe(b)
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/doses.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/doses.ts`**

```ts
import { dosesPerDay, type ScheduleType, type ScheduleConfig } from '@/lib/medications'

export type DoseStatus = 'pendente' | 'tomado' | 'pulado' | 'perdido'

export interface Dose {
  id: string
  medication_id: string
  user_id: string
  scheduled_at: string
  status: DoseStatus
  taken_at: string | null
  created_at: string
}

export function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function doseTimesForDay(type: ScheduleType, cfg: ScheduleConfig): string[] {
  if (type === 'horarios_fixos' && 'times' in cfg) {
    return [...cfg.times].sort()
  }
  const n = dosesPerDay(type, cfg)
  if (n <= 0) return []
  if (type === 'de_x_em_x_horas' && 'interval_hours' in cfg) {
    const times = Array.from({ length: n }, (_, k) => minutesToHHMM((8 + k * cfg.interval_hours) * 60))
    return times.sort()
  }
  // vezes_por_dia: espalha entre 08:00 (480) e 20:00 (1200)
  if (n === 1) return ['08:00']
  const start = 480
  const end = 1200
  const step = (end - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => minutesToHHMM(Math.round(start + i * step)))
}

export function scheduledAtFor(dayISO: string, hhmm: string): string {
  return new Date(`${dayISO}T${hhmm}:00`).toISOString()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/doses.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/doses.ts src/lib/doses.test.ts
git commit -m "feat: tipos de dose e geração dos horários do dia"
```

---

### Task 3: Merge dos slots do dia (TDD, puro)

**Files:**
- Modify: `src/lib/doses.ts`
- Modify: `src/lib/doses.test.ts`

**Interfaces:**
- Consumes: `Medication` de `@/lib/medications`; `Dose`, `doseTimesForDay`, `scheduledAtFor`.
- Produces:
  - `interface DoseSlot { medication: Medication; time: string; scheduled_at: string; status: DoseStatus; overdue: boolean; doseId: string | null }`
  - `function buildTodaySlots(meds: Medication[], doses: Dose[], dayISO: string, nowMs: number): DoseSlot[]` — para cada medicamento ativo gera um slot por horário do dia, cruza com `doses` (match por `medication_id` + `scheduled_at`), define `status` (`pendente` se não há linha) e `overdue` (`status === 'pendente'` e `scheduled_at` já passou de `nowMs`). Ordena por `scheduled_at`.

- [ ] **Step 1: Acrescentar os testes que falham** (no `src/lib/doses.test.ts`)

```ts
import { buildTodaySlots } from './doses'
import type { Medication } from '@/lib/medications'

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
  ...over,
})

describe('buildTodaySlots', () => {
  const day = '2026-06-25'

  it('gera um slot por horário, pendente quando não há dose', () => {
    const nowMs = new Date(`${day}T07:00:00`).getTime() // antes de tudo
    const slots = buildTodaySlots([med()], [], day, nowMs)
    expect(slots).toHaveLength(2) // per_day: 2 => 08:00 e 20:00
    expect(slots.map((s) => s.time)).toEqual(['08:00', '20:00'])
    expect(slots.every((s) => s.status === 'pendente')).toBe(true)
    expect(slots.every((s) => s.overdue === false)).toBe(true)
  })

  it('marca overdue quando o horário já passou e ainda está pendente', () => {
    const nowMs = new Date(`${day}T09:00:00`).getTime() // depois das 08:00
    const slots = buildTodaySlots([med()], [], day, nowMs)
    expect(slots[0].overdue).toBe(true)  // 08:00
    expect(slots[1].overdue).toBe(false) // 20:00
  })

  it('reflete o status da dose existente e não marca overdue', () => {
    const m = med()
    const at8 = scheduledAtFor(day, '08:00')
    const doses = [{
      id: 'd1', medication_id: m.id, user_id: 'u', scheduled_at: at8,
      status: 'tomado' as const, taken_at: at8, created_at: '',
    }]
    const nowMs = new Date(`${day}T09:00:00`).getTime()
    const slots = buildTodaySlots([m], doses, day, nowMs)
    expect(slots[0].status).toBe('tomado')
    expect(slots[0].overdue).toBe(false) // tomado não é overdue
    expect(slots[0].doseId).toBe('d1')
  })

  it('ignora medicamentos inativos', () => {
    expect(buildTodaySlots([med({ active: false })], [], day, Date.parse(`${day}T07:00:00`))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/doses.test.ts` → FAIL (`buildTodaySlots` não existe).

- [ ] **Step 3: Implementar `buildTodaySlots`** (acrescentar ao `src/lib/doses.ts`)

```ts
import type { Medication } from '@/lib/medications'

export interface DoseSlot {
  medication: Medication
  time: string
  scheduled_at: string
  status: DoseStatus
  overdue: boolean
  doseId: string | null
}

export function buildTodaySlots(
  meds: Medication[],
  doses: Dose[],
  dayISO: string,
  nowMs: number,
): DoseSlot[] {
  const byKey = new Map(doses.map((d) => [`${d.medication_id}@${d.scheduled_at}`, d]))
  const slots: DoseSlot[] = []
  for (const m of meds) {
    if (!m.active) continue
    for (const time of doseTimesForDay(m.schedule_type, m.schedule_config)) {
      const scheduled_at = scheduledAtFor(dayISO, time)
      const dose = byKey.get(`${m.id}@${scheduled_at}`)
      const status: DoseStatus = dose?.status ?? 'pendente'
      const overdue = status === 'pendente' && new Date(scheduled_at).getTime() < nowMs
      slots.push({ medication: m, time, scheduled_at, status, overdue, doseId: dose?.id ?? null })
    }
  }
  return slots.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/doses.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/doses.ts src/lib/doses.test.ts
git commit -m "feat: merge dos slots de doses do dia (status + atrasado)"
```

---

### Task 4: Hooks de doses (TDD)

**Files:**
- Create: `src/hooks/useDoses.ts`, `src/hooks/useDoses.test.tsx`

**Interfaces:**
- Consumes: `supabase`; `Dose`, `DoseStatus` de `@/lib/doses`; `Medication` de `@/lib/medications`.
- Produces:
  - `function useDosesForDay(dayISO: string): UseQueryResult<Dose[]>` — busca doses com `scheduled_at` no intervalo `[dayISO 00:00, próximo dia 00:00)`. Chave `['doses', dayISO]`.
  - `function useMarkDose(): UseMutationResult<void, Error, { medication: Medication; scheduledAt: string; action: 'tomado' | 'pulado' }>` — upsert da dose (onConflict `medication_id,scheduled_at`) com `status` e `taken_at`; se `tomado`, atualiza `stock_quantity = max(0, stock - dose_amount)` do medicamento. Invalida `['doses']` e `['medications']`.

- [ ] **Step 1: Escrever o teste que falha**

`src/hooks/useDoses.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDosesForDay } from './useDoses'

const lt = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null })
const gte = vi.fn(() => ({ lt }))
const select = vi.fn(() => ({ gte }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select })) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useDosesForDay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca doses no intervalo do dia', async () => {
    const { result } = renderHook(() => useDosesForDay('2026-06-25'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'd1' }])
    expect(select).toHaveBeenCalled()
    expect(gte).toHaveBeenCalledWith('scheduled_at', expect.any(String))
    expect(lt).toHaveBeenCalledWith('scheduled_at', expect.any(String))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useDoses.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/hooks/useDoses.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Dose } from '@/lib/doses'
import type { Medication } from '@/lib/medications'

function dayRange(dayISO: string): { start: string; end: string } {
  const start = new Date(`${dayISO}T00:00:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function useDosesForDay(dayISO: string) {
  return useQuery({
    queryKey: ['doses', dayISO],
    queryFn: async (): Promise<Dose[]> => {
      const { start, end } = dayRange(dayISO)
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .gte('scheduled_at', start)
        .lt('scheduled_at', end)
      if (error) throw error
      return (data ?? []) as Dose[]
    },
  })
}

export function useMarkDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      medication, scheduledAt, action,
    }: {
      medication: Medication
      scheduledAt: string
      action: 'tomado' | 'pulado'
    }): Promise<void> => {
      const { data: userData } = await supabase.auth.getUser()
      const user_id = userData.user?.id
      const taken_at = action === 'tomado' ? new Date().toISOString() : null
      const { error } = await supabase
        .from('doses')
        .upsert(
          {
            medication_id: medication.id,
            user_id,
            scheduled_at: scheduledAt,
            status: action,
            taken_at,
          },
          { onConflict: 'medication_id,scheduled_at' },
        )
      if (error) throw error

      if (action === 'tomado') {
        const newStock = Math.max(0, medication.stock_quantity - medication.dose_amount)
        const { error: e2 } = await supabase
          .from('medications')
          .update({ stock_quantity: newStock })
          .eq('id', medication.id)
        if (e2) throw e2
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/useDoses.test.tsx` → PASS.

- [ ] **Step 5: Rodar a suíte e commit**

```bash
npm run test
git add src/hooks/useDoses.ts src/hooks/useDoses.test.tsx
git commit -m "feat: hooks de doses (busca do dia + marcar Tomei/Pular com baixa de estoque)"
```

---

### Task 5: `DoseItem` (TDD)

**Files:**
- Create: `src/components/today/DoseItem.tsx`, `src/components/today/DoseItem.test.tsx`

**Interfaces:**
- Consumes: `DoseSlot` de `@/lib/doses`; `Card`, `Button`.
- Produces: `function DoseItem({ slot, onTake, onSkip }: { slot: DoseSlot; onTake: (s: DoseSlot) => void; onSkip: (s: DoseSlot) => void }): JSX.Element`
  - Mostra hora, nome, dose+unidade. Se `status === 'pendente'`: botões "Tomei" e "Pular" (e selo "Atrasado" quando `overdue`). Se `tomado`/`pulado`: rótulo do estado, sem botões.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/today/DoseItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoseItem } from './DoseItem'
import type { DoseSlot } from '@/lib/doses'
import type { Medication } from '@/lib/medications'

const med: Medication = {
  id: 'm1', user_id: 'u', name: 'Dipirona', unit: 'comprimido',
  dose_amount: 1, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
  stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
}
const slot = (over: Partial<DoseSlot> = {}): DoseSlot => ({
  medication: med, time: '08:00', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'pendente', overdue: false, doseId: null, ...over,
})

describe('DoseItem', () => {
  it('pendente mostra Tomei/Pular e dispara onTake', async () => {
    const onTake = vi.fn()
    render(<DoseItem slot={slot()} onTake={onTake} onSkip={vi.fn()} />)
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('Dipirona')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tomei/i }))
    expect(onTake).toHaveBeenCalled()
  })

  it('overdue mostra selo Atrasado', () => {
    render(<DoseItem slot={slot({ overdue: true })} onTake={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/atrasado/i)).toBeInTheDocument()
  })

  it('tomado não mostra botões', () => {
    render(<DoseItem slot={slot({ status: 'tomado' })} onTake={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /tomei/i })).not.toBeInTheDocument()
    expect(screen.getByText(/tomado/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/today/DoseItem.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/today/DoseItem.tsx`**

```tsx
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DoseSlot } from '@/lib/doses'

const STATUS_LABEL: Record<string, string> = {
  tomado: 'Tomado',
  pulado: 'Pulado',
  perdido: 'Perdido',
}

export function DoseItem({
  slot, onTake, onSkip,
}: {
  slot: DoseSlot
  onTake: (s: DoseSlot) => void
  onSkip: (s: DoseSlot) => void
}) {
  const pending = slot.status === 'pendente'
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{slot.time}</span>
            {slot.overdue && (
              <span className="text-xs rounded-sm bg-amber-soft text-amber px-1.5 py-0.5">Atrasado</span>
            )}
          </div>
          <p className="truncate">{slot.medication.name}</p>
          <p className="text-muted text-sm">{slot.medication.dose_amount} {slot.medication.unit}</p>
        </div>
        <div className="shrink-0">
          {pending ? (
            <div className="flex gap-2">
              <Button onClick={() => onTake(slot)}>Tomei</Button>
              <Button variant="secondary" onClick={() => onSkip(slot)}>Pular</Button>
            </div>
          ) : (
            <span className="text-muted text-sm">{STATUS_LABEL[slot.status] ?? slot.status}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
```

> **Pré-requisito:** `Button` deve aceitar `variant="secondary"` (o `buttonVariants` do Plano 1 inclui `secondary`). Se não incluir, use `variant="outline"` ou o disponível e registre no relatório.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/today/DoseItem.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/DoseItem.tsx src/components/today/DoseItem.test.tsx
git commit -m "feat: DoseItem (linha de dose com Tomei/Pular e atrasado)"
```

---

### Task 6: `LowStockBanner` + página `Hoje`

**Files:**
- Create: `src/components/today/LowStockBanner.tsx`
- Modify: `src/pages/Hoje.tsx`

**Interfaces:**
- Consumes: `useMedications`; `daysLeft` de `@/lib/medications`; `useDosesForDay`, `useMarkDose`; `buildTodaySlots`, `DoseSlot`; `DoseItem`; `toast`.
- Produces:
  - `function LowStockBanner({ meds }: { meds: Medication[] }): JSX.Element | null` — nada se ninguém ≤7 dias; senão faixa `bg-amber-soft` listando os remédios que vão acabar.
  - `Hoje` reescrita: faixa de estoque baixo no topo + lista de `DoseItem` das doses de hoje; "Tomei/Pular" chamam `useMarkDose` com toast.

- [ ] **Step 1: Implementar `src/components/today/LowStockBanner.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react'
import { daysLeft, type Medication } from '@/lib/medications'

export function LowStockBanner({ meds }: { meds: Medication[] }) {
  const baixos = meds
    .map((m) => ({ m, dl: daysLeft(m.stock_quantity, m.dose_amount, m.schedule_type, m.schedule_config) }))
    .filter((x) => x.dl !== null && x.dl <= 7)
  if (baixos.length === 0) return null
  return (
    <div className="rounded bg-amber-soft text-text p-3 flex gap-2">
      <AlertTriangle className="text-amber shrink-0" size={18} />
      <div className="text-sm">
        <p className="font-semibold text-amber">Estoque baixo</p>
        <ul className="list-disc pl-4">
          {baixos.map(({ m, dl }) => (
            <li key={m.id}>{m.name}: acaba em {dl} {dl === 1 ? 'dia' : 'dias'}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reescrever `src/pages/Hoje.tsx`**

```tsx
import { toast } from 'sonner'
import { useMedications } from '@/hooks/useMedications'
import { useDosesForDay, useMarkDose } from '@/hooks/useDoses'
import { buildTodaySlots, type DoseSlot } from '@/lib/doses'
import { DoseItem } from '@/components/today/DoseItem'
import { LowStockBanner } from '@/components/today/LowStockBanner'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Hoje() {
  const day = todayISO()
  const { data: meds, isLoading: loadingMeds } = useMedications()
  const { data: doses, isLoading: loadingDoses } = useDosesForDay(day)
  const mark = useMarkDose()

  const slots = buildTodaySlots(meds ?? [], doses ?? [], day, Date.now())

  async function act(slot: DoseSlot, action: 'tomado' | 'pulado') {
    try {
      await mark.mutateAsync({ medication: slot.medication, scheduledAt: slot.scheduled_at, action })
      toast.success(action === 'tomado' ? 'Marcado como tomado!' : 'Dose pulada.')
    } catch {
      toast.error('Não foi possível salvar.')
    }
  }

  const loading = loadingMeds || loadingDoses

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Hoje</h1>
      <LowStockBanner meds={meds ?? []} />

      {loading && <p className="text-muted">Carregando…</p>}
      {!loading && slots.length === 0 && (
        <p className="text-muted">Nenhuma dose para hoje. Cadastre um remédio na aba “Remédios”.</p>
      )}

      <div className="space-y-3">
        {slots.map((s) => (
          <DoseItem
            key={`${s.medication.id}@${s.scheduled_at}`}
            slot={s}
            onTake={(slot) => act(slot, 'tomado')}
            onSkip={(slot) => act(slot, 'pulado')}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verificar build + suíte**

Run: `npm run build && npm run test`
Expected: build OK, testes passam. Sanidade manual (descrever no relatório): com um remédio ativo, "Hoje" lista as doses do dia; "Tomei" troca a linha para "Tomado" e baixa o estoque.

- [ ] **Step 4: Commit**

```bash
git add src/components/today/LowStockBanner.tsx src/pages/Hoje.tsx
git commit -m "feat: tela Hoje com doses do dia, Tomei/Pular e aviso de estoque baixo"
```

---

## Self-Review (cobertura do spec)

- **Lembrete/registro de adesão na tela:** doses do dia com horário + "Tomei/Pular" (Tasks 5, 6). ✅ *(Push/e-mail de lembrete é o Plano 6.)*
- **Baixa de estoque ao tomar:** `useMarkDose` (Task 4). ✅
- **Aviso de estoque baixo no topo:** `LowStockBanner` (Task 6). ✅
- **Base do gráfico de adesão:** linhas em `doses` (Task 1) com status/taken_at — o gráfico em si é o Plano 4. ✅
- **Geração de horários consistente com a depleção:** `doseTimesForDay` usa `dosesPerDay` (Task 2). ✅
- **RLS / tokens / pt-BR / Tailwind 3.4 / shadcn manual:** Tasks 1–6. ✅
- **Fora do escopo (próximos):** export PDF + heatmap (Plano 4); UI de tema/notificações (Plano 5); materialização server-side + "perdido" automático + envio de lembretes (Plano 6).

**Notas registradas:** baixa de estoque é read-modify-write a partir do cache (não atômica; ok p/ 1 usuário); "perdido" automático e materialização especulativa ficam no Plano 6; "atrasado" aqui é só visual.

Sem placeholders de implementação. Tipos/nomes consistentes (`Dose`, `DoseStatus`, `DoseSlot`, `doseTimesForDay`, `scheduledAtFor`, `buildTodaySlots`, `useDosesForDay`, `useMarkDose`, `DoseItem`, `LowStockBanner`).
```
