# Cuidi — Setup das Notificações (Plano 6)

Guia para colocar push + e-mail no ar. Tudo no **free tier**. Faça uma vez.
Projeto Supabase do Cuidi: ref `jlfflxcsvncnwcfzgizw`.

## 0. Pré-requisitos
- Supabase CLI (`supabase`) logado: `supabase login`
- Conta no [Resend](https://resend.com) (free) para e-mail

## 1. Aplicar as migrations
No SQL Editor do projeto (ou `supabase db push`), aplique **na ordem** as que ainda faltam:
`0001_profiles.sql`, `0002_medications.sql`, `0003_doses.sql`, `0004_notifications.sql`.

## 2. Gerar as chaves VAPID (Web Push)
```bash
npx web-push generate-vapid-keys
```
Guarde a **Public Key** e a **Private Key**.

- No app (cliente): coloque a pública no `.env.local`:
  ```
  VITE_VAPID_PUBLIC_KEY=<public-key>
  ```
  (e na Vercel, como variável de ambiente do projeto — Plano 7).

## 3. Configurar os secrets da Edge Function
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public-key> \
  VAPID_PRIVATE_KEY=<private-key> \
  VAPID_SUBJECT=mailto:voce@seu-email.com \
  RESEND_API_KEY=<resend-api-key> \
  RESEND_FROM="Cuidi <onboarding@resend.dev>" \
  CRON_SECRET=<gere-um-valor-aleatorio-longo>
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções (injetados pela plataforma) — não precisa setar.

> **`CRON_SECRET`** é um segredo compartilhado só entre o cron e a função: gere um valor aleatório
> longo (ex.: `openssl rand -hex 32`) e use **o mesmo valor** no `<CRON_SECRET>` do `cron.example.sql`.
> A função só executa a corrida global se receber o header `x-cron-secret` igual a esse valor — isso
> impede que qualquer usuário logado dispare o `tick`. O `verify_jwt = true` (fixado em
> `supabase/config.toml`) garante ainda que a chamada traga um JWT válido.

> Resend free envia de `onboarding@resend.dev` sem domínio próprio. Para usar um remetente seu, verifique um domínio no Resend e troque o `RESEND_FROM`.

## 4. Deploy da função
```bash
supabase functions deploy tick
```

## 5. Agendar o cron (pg_cron + pg_net)
No SQL Editor, rode `supabase/cron.example.sql` trocando `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`
(Project Settings → API). Habilite as extensões `pg_cron` e `pg_net` em Database → Extensions se ainda não estiverem.

## 6. Testar
- **Função na unha:** `supabase functions invoke tick` → deve responder um JSON de resumo
  (`materialized`, `pushed`, `emailed`, `missed`, `lowStock`).
- **Push:** instale o app no iPhone (Safari → Compartilhar → Adicionar à Tela de Início),
  abra, vá em Ajustes → ligue "Lembretes por push" e aceite a permissão. Crie um remédio com
  horário daqui a alguns minutos e espere o cron (ou invoque a função).
- **E-mail:** confira a caixa de entrada (e spam) no horário da dose.
- **Logs:** `supabase functions logs tick`.

## Notas
- iOS só entrega Web Push para PWA **instalado** (iOS 16.4+). E-mail é o fallback garantido.
- Idempotência: índice único `(medication_id, scheduled_at)` + `notification_log` evitam duplicatas.
- Tolerância: a função para de avisar e marca `perdido` 2h após a hora da dose (`DUE_TOLERANCE_MIN`).
- Custo: Supabase free + Resend free (100/dia) + Web Push (sem custo).
