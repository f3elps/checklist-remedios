# Cuidi — Plano de Implementação 4: Histórico (heatmap) + exportar PDF

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar um gráfico de adesão por dia (heatmap estilo "contribution graph"), com filtro por remédio, e permitir exportar em PDF para mostrar ao médico. Inclui o teste de `useMarkDose` recomendado na revisão do Plano 3.

**Architecture:** A adesão vem das linhas de `doses` (criadas ao marcar Tomei/Pular). A tela "Histórico" busca as doses de uma janela (padrão 91 dias), agrupa por dia (função pura), e renderiza um heatmap (células coloridas por nível, via estilo inline `var(--primary)` + opacidade — porque os tokens são `hsl(...)` completos e o modificador de opacidade do Tailwind não funciona neles). Filtro por remédio reduz a uma medicação. Exportar PDF captura o container com `html2canvas` → `jsPDF`.

**Tech Stack:** (continuação) Vite + React 19 + TS, Tailwind 3.4, shadcn (manual), @supabase/supabase-js 2, @tanstack/react-query 5, date-fns 4, **jspdf + html2canvas** (novas), Vitest + Testing Library.

## Global Constraints

- **Idioma da UI:** Português do Brasil. App: **Cuidi**.
- **Stack fixo:** o dos planos 1–3. Tailwind **3.4**. shadcn manual. Tokens do Cuidi; **nenhum hex hardcoded** (cores do heatmap via `var(--primary)`/`var(--surface-2)` em estilo inline com `opacity`).
- **Opacidade em tokens:** NÃO usar `bg-primary/50` (token é `hsl()` completo → vira cor inválida). Para níveis do heatmap, usar `style={{ background: 'var(--primary)', opacity }}`.
- **RLS já existente:** as queries de `doses` herdam a RLS por dono do Plano 3.
- **Datas/fuso:** dia local via `date-fns` `format(date, 'yyyy-MM-dd')` (consistente com `scheduledAtFor` do Plano 3, que grava local→UTC).
- **Commits:** um por task, mensagem em português, prefixo convencional.
- **Banco:** sem novas migrations neste plano (usa `doses`/`medications` já existentes). Lembrar: as migrations 0001–0003 ainda dependem de aplicação manual do usuário.

---

## Estrutura de arquivos (criada/alterada)

```
src/hooks/useDoses.test.tsx                       # + testes de useMarkDose (guarda da baixa de estoque)
src/hooks/useDoses.ts                             # + useDosesRange(startISO, endISO)
src/lib/history.ts                                # puro: agrupar por dia, níveis, janela, resumo
src/lib/history.test.ts
src/components/history/AdherenceHeatmap.tsx       # grid de células coloridas por nível
src/components/history/AdherenceHeatmap.test.tsx
src/lib/pdf.ts                                    # exportElementToPdf (html2canvas + jsPDF)
src/pages/Historico.tsx                           # reescrita: filtro + heatmap + resumo + exportar PDF
```

---

### Task 1: Testes de `useMarkDose` (guarda da baixa de estoque)

**Files:**
- Modify: `src/hooks/useDoses.test.tsx`

**Interfaces:**
- Consumes: `useMarkDose` (já existe, Plano 3).
- Produces: cobertura que fixa o comportamento: upsert com `user_id`+`onConflict`; `taken_at` null no "pular"; estoque decrementado 1x no "tomado" e **intacto** no "pular".

> Observação: a implementação JÁ existe e está correta; estes testes são de caracterização (devem PASSAR). Se algum falhar, encontramos um bug — reporte, não enfraqueça o teste.

- [ ] **Step 1: Acrescentar o bloco de testes de `useMarkDose`** ao `src/hooks/useDoses.test.tsx`

```tsx
import { useMarkDose } from './useDoses'
import type { Medication } from '@/lib/medications'

describe('useMarkDose', () => {
  const med: Medication = {
    id: 'm1', user_id: 'u1', name: 'Dipirona', unit: 'comprimido',
    dose_amount: 2, schedule_type: 'vezes_por_dia', schedule_config: { per_day: 2 },
    stock_quantity: 10, start_date: '2026-01-01', active: true, notes: null, created_at: '',
  }

  function setup() {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
    const from = vi.fn((table: string) => (table === 'doses' ? { upsert } : { update }))
    return { upsert, update, eq, getUser, from }
  }

  it('tomado: upsert com user_id/status/taken_at + onConflict, e baixa de estoque 1x', async () => {
    const m = setup()
    vi.doMock('@/lib/supabase', () => ({ supabase: { from: m.from, auth: { getUser: m.getUser } } }))
    const { useMarkDose: hook } = await import('./useDoses')
    const { result } = renderHook(() => hook(), { wrapper })
    await result.current.mutateAsync({ medication: med, scheduledAt: '2026-06-25T11:00:00.000Z', action: 'tomado' })

    expect(m.upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = m.upsert.mock.calls[0]
    expect(payload).toMatchObject({ medication_id: 'm1', user_id: 'u1', status: 'tomado', scheduled_at: '2026-06-25T11:00:00.000Z' })
    expect(payload.taken_at).toEqual(expect.any(String))
    expect(opts).toEqual({ onConflict: 'medication_id,scheduled_at' })
    // baixa de estoque: 10 - 2 = 8
    expect(m.update).toHaveBeenCalledTimes(1)
    expect(m.update).toHaveBeenCalledWith({ stock_quantity: 8 })
    vi.doUnmock('@/lib/supabase')
  })

  it('pulado: taken_at null e NÃO mexe no estoque', async () => {
    const m = setup()
    vi.doMock('@/lib/supabase', () => ({ supabase: { from: m.from, auth: { getUser: m.getUser } } }))
    const { useMarkDose: hook } = await import('./useDoses')
    const { result } = renderHook(() => hook(), { wrapper })
    await result.current.mutateAsync({ medication: med, scheduledAt: '2026-06-25T11:00:00.000Z', action: 'pulado' })

    const [payload] = m.upsert.mock.calls[0]
    expect(payload).toMatchObject({ status: 'pulado', taken_at: null })
    expect(m.update).not.toHaveBeenCalled()
    vi.doUnmock('@/lib/supabase')
  })
})
```

> Nota técnica: o arquivo já tem um `vi.mock('@/lib/supabase', ...)` no topo (para o teste de leitura). Para os testes de mutação, use `vi.doMock` + `await import('./useDoses')` DENTRO de cada teste (como acima) para sobrescrever o mock com `upsert`/`update`/`auth`. Se preferir, refatore o mock do topo para um objeto configurável compartilhado — desde que o teste de leitura existente continue passando. Garanta `vi.doUnmock` ao fim de cada teste.

- [ ] **Step 2: Rodar e ver passar** (caracterização — a impl já existe)

Run: `npx vitest run src/hooks/useDoses.test.tsx`
Expected: PASS (todos, incluindo os 2 novos). Se algum dos novos FALHAR, há um bug em `useMarkDose` — reporte os detalhes.

- [ ] **Step 3: Rodar a suíte e commit**

```bash
npm run test && npm run build
git add src/hooks/useDoses.test.tsx
git commit -m "test: cobre useMarkDose (upsert, taken_at e baixa de estoque)"
```

---

### Task 2: Hook `useDosesRange` (TDD)

**Files:**
- Modify: `src/hooks/useDoses.ts`
- Modify: `src/hooks/useDoses.test.tsx`

**Interfaces:**
- Consumes: `supabase`; `Dose`.
- Produces: `function useDosesRange(startISO: string, endISO: string): UseQueryResult<Dose[]>` — busca doses com `scheduled_at` em `[startISO, endISO)`, ordenadas por `scheduled_at`. Chave `['doses', 'range', startISO, endISO]`.

- [ ] **Step 1: Acrescentar o teste que falha** ao `src/hooks/useDoses.test.tsx`

```tsx
describe('useDosesRange', () => {
  it('busca doses no intervalo informado', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null })
    const lt = vi.fn(() => ({ order }))
    const gte = vi.fn(() => ({ lt }))
    const select = vi.fn(() => ({ gte }))
    vi.doMock('@/lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))
    const { useDosesRange } = await import('./useDoses')
    const { result } = renderHook(() => useDosesRange('2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'd1' }])
    expect(gte).toHaveBeenCalledWith('scheduled_at', '2026-06-01T00:00:00.000Z')
    expect(lt).toHaveBeenCalledWith('scheduled_at', '2026-07-01T00:00:00.000Z')
    vi.doUnmock('@/lib/supabase')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useDoses.test.tsx` → o novo teste FALHA (`useDosesRange` não existe).

- [ ] **Step 3: Implementar `useDosesRange`** (acrescentar ao `src/hooks/useDoses.ts`)

```ts
export function useDosesRange(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['doses', 'range', startISO, endISO],
    queryFn: async (): Promise<Dose[]> => {
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .gte('scheduled_at', startISO)
        .lt('scheduled_at', endISO)
        .order('scheduled_at')
      if (error) throw error
      return (data ?? []) as Dose[]
    },
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/useDoses.test.tsx` → PASS.

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/hooks/useDoses.ts src/hooks/useDoses.test.tsx
git commit -m "feat: hook useDosesRange (doses num intervalo)"
```

---

### Task 3: Lógica de histórico (TDD, pura)

**Files:**
- Create: `src/lib/history.ts`, `src/lib/history.test.ts`

**Interfaces:**
- Consumes: `Dose` de `@/lib/doses`.
- Produces:
  - `function dayKeyLocal(iso: string): string` (dia local "yyyy-MM-dd")
  - `interface DayAdherence { tomado: number; pulado: number; perdido: number; total: number }`
  - `function groupDosesByDay(doses: Dose[]): Map<string, DayAdherence>`
  - `function heatLevel(tomado: number): 0 | 1 | 2 | 3 | 4` (0 se 0; senão `min(4, ceil(tomado/2))`)
  - `function lastNDays(endDayISO: string, n: number): string[]` (n chaves de dia consecutivas terminando em endDay, em ordem crescente)
  - `interface Summary { taken: number; skipped: number; activeDays: number }`
  - `function summarize(doses: Dose[]): Summary` (taken=tomado total; skipped=pulado total; activeDays=dias com ≥1 tomado)

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/history.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dayKeyLocal, groupDosesByDay, heatLevel, lastNDays, summarize } from './history'
import type { Dose } from '@/lib/doses'

const dose = (over: Partial<Dose>): Dose => ({
  id: 'd', medication_id: 'm', user_id: 'u', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'tomado', taken_at: null, created_at: '', ...over,
})

describe('dayKeyLocal', () => {
  it('retorna yyyy-MM-dd', () => {
    expect(dayKeyLocal('2026-06-25T11:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('heatLevel', () => {
  it('mapeia tomados para 0..4', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(2)).toBe(1)
    expect(heatLevel(3)).toBe(2)
    expect(heatLevel(8)).toBe(4)
    expect(heatLevel(20)).toBe(4)
  })
})

describe('lastNDays', () => {
  it('gera n dias consecutivos terminando no dia informado, crescente', () => {
    expect(lastNDays('2026-06-25', 3)).toEqual(['2026-06-23', '2026-06-24', '2026-06-25'])
  })
})

describe('groupDosesByDay + summarize', () => {
  const doses = [
    dose({ status: 'tomado' }),
    dose({ status: 'tomado' }),
    dose({ status: 'pulado' }),
  ]
  it('agrupa contagens por dia', () => {
    const m = groupDosesByDay(doses)
    const day = dayKeyLocal('2026-06-25T11:00:00.000Z')
    expect(m.get(day)).toEqual({ tomado: 2, pulado: 1, perdido: 0, total: 3 })
  })
  it('resume taken/skipped/activeDays', () => {
    expect(summarize(doses)).toEqual({ taken: 2, skipped: 1, activeDays: 1 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/history.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/lib/history.ts`**

```ts
import { format, subDays, parseISO } from 'date-fns'
import type { Dose } from '@/lib/doses'

export function dayKeyLocal(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd')
}

export interface DayAdherence { tomado: number; pulado: number; perdido: number; total: number }

export function groupDosesByDay(doses: Dose[]): Map<string, DayAdherence> {
  const map = new Map<string, DayAdherence>()
  for (const d of doses) {
    const key = dayKeyLocal(d.scheduled_at)
    const cur = map.get(key) ?? { tomado: 0, pulado: 0, perdido: 0, total: 0 }
    if (d.status === 'tomado') cur.tomado++
    else if (d.status === 'pulado') cur.pulado++
    else if (d.status === 'perdido') cur.perdido++
    cur.total++
    map.set(key, cur)
  }
  return map
}

export function heatLevel(tomado: number): 0 | 1 | 2 | 3 | 4 {
  if (tomado <= 0) return 0
  return Math.min(4, Math.ceil(tomado / 2)) as 1 | 2 | 3 | 4
}

export function lastNDays(endDayISO: string, n: number): string[] {
  const end = parseISO(`${endDayISO}T12:00:00`)
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(format(subDays(end, i), 'yyyy-MM-dd'))
  }
  return days
}

export interface Summary { taken: number; skipped: number; activeDays: number }

export function summarize(doses: Dose[]): Summary {
  const byDay = groupDosesByDay(doses)
  let taken = 0
  let skipped = 0
  let activeDays = 0
  for (const a of byDay.values()) {
    taken += a.tomado
    skipped += a.pulado
    if (a.tomado > 0) activeDays++
  }
  return { taken, skipped, activeDays }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/history.test.ts` → PASS.

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/lib/history.ts src/lib/history.test.ts
git commit -m "feat: lógica de histórico (agrupar por dia, níveis, janela, resumo)"
```

---

### Task 4: Componente `AdherenceHeatmap` (TDD)

**Files:**
- Create: `src/components/history/AdherenceHeatmap.tsx`, `src/components/history/AdherenceHeatmap.test.tsx`

**Interfaces:**
- Consumes: `Dose`; `dayKeyLocal`, `groupDosesByDay`, `heatLevel`, `lastNDays` de `@/lib/history`.
- Produces: `function AdherenceHeatmap({ doses, endDayISO, days }: { doses: Dose[]; endDayISO: string; days?: number }): JSX.Element`
  - Renderiza `days` (padrão 91) células. Cada célula: cor `var(--surface-2)` (nível 0) ou `var(--primary)` com `opacity` por nível (estilo inline). `title` = "{dia}: {n} tomada(s)". Layout grid 7 linhas (`grid-rows-7 grid-flow-col`), com `data-testid="heatmap"`.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/history/AdherenceHeatmap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdherenceHeatmap } from './AdherenceHeatmap'
import type { Dose } from '@/lib/doses'

const dose = (over: Partial<Dose>): Dose => ({
  id: 'd', medication_id: 'm', user_id: 'u', scheduled_at: '2026-06-25T11:00:00.000Z',
  status: 'tomado', taken_at: null, created_at: '', ...over,
})

describe('AdherenceHeatmap', () => {
  it('renderiza uma célula por dia da janela', () => {
    render(<AdherenceHeatmap doses={[]} endDayISO="2026-06-25" days={7} />)
    const grid = screen.getByTestId('heatmap')
    expect(grid.querySelectorAll('[data-cell]')).toHaveLength(7)
  })

  it('a célula de um dia com doses tem title com a contagem', () => {
    render(<AdherenceHeatmap doses={[dose({}), dose({})]} endDayISO="2026-06-25" days={7} />)
    expect(screen.getByTitle(/2 tomada/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/history/AdherenceHeatmap.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/history/AdherenceHeatmap.tsx`**

```tsx
import { groupDosesByDay, heatLevel, lastNDays } from '@/lib/history'
import type { Dose } from '@/lib/doses'

const OPACITY: Record<number, number> = { 1: 0.35, 2: 0.55, 3: 0.78, 4: 1 }

export function AdherenceHeatmap({
  doses, endDayISO, days = 91,
}: {
  doses: Dose[]
  endDayISO: string
  days?: number
}) {
  const byDay = groupDosesByDay(doses)
  const keys = lastNDays(endDayISO, days)

  return (
    <div data-testid="heatmap" className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto">
      {keys.map((day) => {
        const a = byDay.get(day)
        const tomado = a?.tomado ?? 0
        const level = heatLevel(tomado)
        const style =
          level === 0
            ? { background: 'var(--surface-2)' }
            : { background: 'var(--primary)', opacity: OPACITY[level] }
        return (
          <div
            key={day}
            data-cell
            title={`${day}: ${tomado} tomada(s)`}
            className="h-3.5 w-3.5 rounded-sm"
            style={style}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/history/AdherenceHeatmap.test.tsx` → PASS.

- [ ] **Step 5: Build + commit**

```bash
npm run build && npm run test
git add src/components/history/AdherenceHeatmap.tsx src/components/history/AdherenceHeatmap.test.tsx
git commit -m "feat: AdherenceHeatmap (grid de adesão por dia)"
```

---

### Task 5: Utilitário de export PDF

**Files:**
- Create: `src/lib/pdf.ts`

**Interfaces:**
- Produces: `async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void>` — captura `el` com html2canvas e gera um PDF (A4 retrato) com a imagem, e chama `doc.save(filename)`.

- [ ] **Step 1: Instalar as dependências**

```bash
npm install jspdf html2canvas
```

- [ ] **Step 2: Implementar `src/lib/pdf.ts`**

```ts
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
  const img = canvas.toDataURL('image/png')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 24
  const usableWidth = pageWidth - margin * 2
  const ratio = canvas.height / canvas.width
  const imgHeight = usableWidth * ratio
  doc.addImage(img, 'PNG', margin, margin, usableWidth, imgHeight)
  doc.save(filename)
}
```

> Sem teste unitário dedicado (depende de canvas/DOM real do navegador; jsdom não rasteriza). A validação é via build + uso manual na Task 6. Não criar um teste que apenas mocka tudo (testaria o mock).

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/lib/pdf.ts package.json package-lock.json
git commit -m "feat: exportElementToPdf (html2canvas + jsPDF)"
```

---

### Task 6: Página `Historico` (filtro + heatmap + resumo + exportar)

**Files:**
- Modify: `src/pages/Historico.tsx`

**Interfaces:**
- Consumes: `useMedications`; `useDosesRange`; `lastNDays`, `summarize` de `@/lib/history`; `AdherenceHeatmap`; `exportElementToPdf`; `Button`, `Select*`; `toast`.
- Produces: tela com select de remédio ("Todos" + cada medicamento), heatmap dos últimos 91 dias (filtrado), resumo (tomadas / puladas / dias ativos) e botão "Exportar PDF".

- [ ] **Step 1: Reescrever `src/pages/Historico.tsx`**

```tsx
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMedications } from '@/hooks/useMedications'
import { useDosesRange } from '@/hooks/useDoses'
import { lastNDays, summarize } from '@/lib/history'
import { AdherenceHeatmap } from '@/components/history/AdherenceHeatmap'
import { exportElementToPdf } from '@/lib/pdf'

const DAYS = 91

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Historico() {
  const end = todayISO()
  const days = lastNDays(end, DAYS)
  const startISO = new Date(`${days[0]}T00:00:00`).toISOString()
  const endISO = new Date(`${end}T23:59:59`).toISOString()

  const { data: meds } = useMedications()
  const { data: doses, isLoading } = useDosesRange(startISO, endISO)
  const [medId, setMedId] = useState<string>('todos')
  const printRef = useRef<HTMLDivElement>(null)

  const filtered = (doses ?? []).filter((d) => medId === 'todos' || d.medication_id === medId)
  const resumo = summarize(filtered)

  async function onExport() {
    if (!printRef.current) return
    try {
      await exportElementToPdf(printRef.current, 'cuidi-historico.pdf')
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Histórico</h1>
        <Button variant="secondary" className="gap-1" onClick={onExport}>
          <Download size={18} /> PDF
        </Button>
      </div>

      <Select value={medId} onValueChange={setMedId}>
        <SelectTrigger><SelectValue placeholder="Todos os remédios" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os remédios</SelectItem>
          {meds?.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && <p className="text-muted">Carregando…</p>}

      <div ref={printRef} className="space-y-4 bg-surface rounded p-4">
        <p className="text-muted text-sm">Adesão dos últimos {DAYS} dias</p>
        <AdherenceHeatmap doses={filtered} endDayISO={end} days={DAYS} />
        <div className="flex gap-4 text-sm">
          <span><strong>{resumo.taken}</strong> tomadas</span>
          <span><strong>{resumo.skipped}</strong> puladas</span>
          <span><strong>{resumo.activeDays}</strong> dias com adesão</span>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar build + suíte**

Run: `npm run build && npm run test`
Manual (descrever no relatório): a tela mostra o heatmap; trocar o filtro muda os dados; "PDF" baixa um arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Historico.tsx
git commit -m "feat: tela Histórico com heatmap, filtro por remédio e exportar PDF"
```

---

## Self-Review (cobertura do spec)

- **Gráfico de adesão por dia (heatmap):** Tasks 3, 4, 6. ✅
- **Filtro por remédio:** Task 6. ✅
- **Exportar PDF pro médico:** Tasks 5, 6. ✅
- **Guarda da baixa de estoque (recomendação da revisão do Plano 3):** Task 1. ✅
- **Tokens / pt-BR / Tailwind 3.4 / shadcn manual / opacidade via estilo inline:** Tasks 4, 6. ✅
- **Fora do escopo (próximos):** UI de tema/dark/notificações (Plano 5); motor de notificações + "perdido" automático + RPC atômico de estoque (Plano 6); ícones finais + deploy (Plano 7).

**Notas:** o heatmap usa o que existe em `doses` (tomado/pulado); "perdido" só aparece após o Plano 6. Sem teste unitário do `pdf.ts` (precisa de canvas real). Cor por nível via estilo inline (`var(--primary)` + opacidade) porque os tokens são `hsl()` completos.

Sem placeholders de implementação. Tipos/nomes consistentes (`dayKeyLocal`, `groupDosesByDay`, `heatLevel`, `lastNDays`, `summarize`, `useDosesRange`, `AdherenceHeatmap`, `exportElementToPdf`).
```
