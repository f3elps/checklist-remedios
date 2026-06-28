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
