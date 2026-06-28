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
import { Logo } from '@/components/Logo'

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
        <div className="flex flex-col items-center text-center mb-6">
          <Logo className="h-14 w-14 text-primary" />
          <h1 className="text-2xl font-bold mt-3">Cuidi</h1>
          <p className="text-muted">Entre para cuidar dos seus remédios.</p>
        </div>
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
