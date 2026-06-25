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
