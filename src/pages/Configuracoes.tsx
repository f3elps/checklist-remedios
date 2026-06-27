import { toast } from 'sonner'
import { THEMES, type ThemeSlug } from '@/lib/theme'
import { useTheme } from '@/providers/ThemeProvider'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function Configuracoes() {
  const { theme, dark, setTheme, setDark } = useTheme()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  async function persist(values: Parameters<typeof update.mutateAsync>[0]) {
    try {
      await update.mutateAsync(values)
    } catch {
      toast.error('Não foi possível salvar a preferência.')
    }
  }

  function pickTheme(slug: ThemeSlug) {
    setTheme(slug)
    persist({ theme_color: slug })
  }
  function toggleDark(v: boolean) {
    setDark(v)
    persist({ dark_mode: v })
  }

  const emailOn = profile?.email_enabled ?? true
  const pushOn = profile?.push_enabled ?? true

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <Card className="p-4 shadow-card space-y-4">
        <h2 className="font-semibold">Cor do app</h2>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => (
            <button
              key={t.slug}
              aria-label={`Tema ${t.label}`}
              onClick={() => pickTheme(t.slug)}
              className={cn(
                'h-10 w-10 rounded-full border-2',
                theme === t.slug ? 'border-text ring-2 ring-primary' : 'border-border',
              )}
              style={{ background: t.primary }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span>Modo escuro</span>
          <Switch checked={dark} onCheckedChange={toggleDark} aria-label="Modo escuro" />
        </div>
      </Card>

      <Card className="p-4 shadow-card space-y-4">
        <h2 className="font-semibold">Notificações</h2>
        <div className="flex items-center justify-between">
          <span>Avisos por e-mail</span>
          <Switch checked={emailOn} onCheckedChange={(v) => persist({ email_enabled: v })} aria-label="Avisos por e-mail" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span>Lembretes por push</span>
            <p className="text-muted text-sm">A ativação completa do push acontece ao instalar o app.</p>
          </div>
          <Switch checked={pushOn} onCheckedChange={(v) => persist({ push_enabled: v })} aria-label="Lembretes por push" />
        </div>
      </Card>

      <Card className="p-4 shadow-card space-y-2">
        <h2 className="font-semibold">Instalar na tela inicial</h2>
        <p className="text-muted text-sm">
          <strong>iPhone (Safari):</strong> toque em Compartilhar <span aria-hidden>⬆️</span> e depois em
          "Adicionar à Tela de Início".
        </p>
        <p className="text-muted text-sm">
          <strong>Android (Chrome):</strong> toque no menu <span aria-hidden>⋮</span> e depois em
          "Instalar app" / "Adicionar à tela inicial".
        </p>
      </Card>
    </section>
  )
}
