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
