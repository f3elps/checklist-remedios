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
  dose_amount: z.number().positive('Dose deve ser maior que 0'),
  schedule_type: z.enum(['vezes_por_dia', 'de_x_em_x_horas', 'horarios_fixos']),
  per_day: z.number().int('Use um número inteiro').min(1, 'Mínimo 1').optional(),
  interval_hours: z.number().int('Use um número inteiro').min(1, 'Mínimo 1').max(24, 'Máximo 24').optional(),
  times: z.string().optional(), // "08:00, 20:00"
  stock_quantity: z.number().min(0, 'Estoque não pode ser negativo'),
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
      stock_quantity: v.stock_quantity, start_date: v.start_date, notes: v.notes?.trim() ? v.notes.trim() : null,
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
        <Input id="dose_amount" type="number" step="any" {...register('dose_amount', { valueAsNumber: true })} />
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
          <Input id="per_day" type="number" {...register('per_day', { valueAsNumber: true })} />
          {errors.per_day && <p className="text-error text-sm mt-1">{errors.per_day.message}</p>}
        </div>
      )}
      {type === 'de_x_em_x_horas' && (
        <div>
          <Label htmlFor="interval_hours">De quantas em quantas horas</Label>
          <Input id="interval_hours" type="number" {...register('interval_hours', { valueAsNumber: true })} />
          {errors.interval_hours && <p className="text-error text-sm mt-1">{errors.interval_hours.message}</p>}
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
        <Input id="stock_quantity" type="number" step="any" {...register('stock_quantity', { valueAsNumber: true })} />
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
