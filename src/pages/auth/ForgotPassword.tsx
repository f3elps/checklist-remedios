import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/Logo'

const schema = z.object({ email: z.string().email('E-mail inválido') })
type Form = z.infer<typeof schema>

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    await supabase.auth.resetPasswordForEmail(v.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    toast.success('Se o e-mail existir, enviamos um link de redefinição.')
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <Card className="w-full max-w-sm p-6 shadow-card">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo className="h-14 w-14 text-primary" />
          <h1 className="text-2xl font-bold mt-3">Recuperar senha</h1>
          <p className="text-muted">Enviaremos um link para o seu e-mail.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-error text-sm mt-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>Enviar link</Button>
        </form>
        <div className="mt-4 text-sm"><Link to="/entrar" className="text-primary">Voltar ao login</Link></div>
      </Card>
    </div>
  )
}
