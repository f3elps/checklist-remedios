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
