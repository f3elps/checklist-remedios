# Cuidi — Deploy na Vercel

PWA estático (Vite). Free tier (Hobby). Deploy automático a cada push na `main`.

## 1. Importar o repositório
1. Vercel → **Add New… → Project** → importe `checklist-remedios`.
2. **Framework Preset:** Vite (detectado automaticamente).
   - Build Command: `npm run build`
   - Output Directory: `dist`

## 2. Variáveis de ambiente (Project → Settings → Environment Variables)
Use os mesmos valores do `.env.local`:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://jlfflxcsvncnwcfzgizw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a publishable key do projeto |
| `VITE_VAPID_PUBLIC_KEY` | a chave pública VAPID (ver `supabase/functions/SETUP.md`) |

Defina para **Production** (e Preview, se quiser testar PRs). Redeploy após salvar.

## 3. Supabase Auth → URL do site
Em Authentication → URL Configuration do projeto Supabase:
- **Site URL:** a URL da Vercel (ex.: `https://cuidi.vercel.app`).
- **Redirect URLs:** adicione `https://cuidi.vercel.app/redefinir-senha` (link do e-mail de
  recuperação de senha) e `https://cuidi.vercel.app/**`.

## 4. SPA fallback
Já tratado pelo `vercel.json` (rewrites → `index.html`). Sem isso, dar refresh em `/remedios`
retornaria 404.

## 5. Conferir
- App abre na URL da Vercel, login funciona.
- Instalar na tela inicial (iOS/Android) — ver instruções em Ajustes.
- Notificações: depende do Plano 6 estar configurado no Supabase (`supabase/functions/SETUP.md`)
  **e** da `VITE_VAPID_PUBLIC_KEY` estar setada aqui na Vercel.
