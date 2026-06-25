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
        <p className="text-muted">Você ainda não cadastrou remédios. Toque em "Adicionar".</p>
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
              Isso remove "{toDelete?.name}" da sua lista. Não dá pra desfazer.
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
