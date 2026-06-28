// Edge Function (Deno) — NÃO roda no Vitest (usa Deno.env, npm:web-push e o client service-role).
// Toda a lógica pura (fuso/seleção/estoque) está em ../_shared/schedule.ts (testada no Vitest).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  materializeWindow,
  selectDue,
  selectMissed,
  isLowStock,
  zonedTimeToUtc,
  localDateISO,
  type MedRow,
  type DoseRow,
} from '../_shared/schedule.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:cuidi@exemplo.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Cuidi <onboarding@resend.dev>'
// Segredo compartilhado com o cron (defesa em profundidade além do verify_jwt do config.toml).
// Quando setado, só quem envia o header x-cron-secret correto pode disparar a corrida global.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const WINDOW_HOURS = 48
const DUE_TOLERANCE_MIN = 120 // marca "perdido" e para de avisar 2h após a hora

interface ProfileRow {
  id: string
  timezone: string
  email_enabled: boolean
  push_enabled: boolean
}
interface PushSubRow {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, text }),
  })
  if (!res.ok) {
    console.error('Resend falhou:', res.status, await res.text())
    return false
  }
  return true
}

async function pushTo(subs: PushSubRow[], payload: unknown): Promise<number> {
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }
  return sent
}

Deno.serve(async (req) => {
  // Só o cron (que envia o x-cron-secret) pode disparar a corrida global com service-role.
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  const now = new Date()
  const summary = { materialized: 0, pushed: 0, emailed: 0, missed: 0, lowStock: 0 }

  const { data: medsData } = await admin.from('medications').select('*').eq('active', true)
  const { data: profsData } = await admin.from('profiles').select('id, timezone, email_enabled, push_enabled')
  const meds = (medsData ?? []) as MedRow[]
  const profById = new Map((profsData ?? []).map((p: ProfileRow) => [p.id, p]))
  const medById = new Map(meds.map((m) => [m.id, m]))

  // 1) Materializa doses 0–48h por remédio, no fuso do dono.
  for (const m of meds) {
    const tz = profById.get(m.user_id)?.timezone ?? 'America/Sao_Paulo'
    const planned = materializeWindow([m], now, WINDOW_HOURS, tz)
    if (planned.length) {
      const { error } = await admin
        .from('doses')
        .upsert(planned.map((p) => ({ ...p, status: 'pendente' })), {
          onConflict: 'medication_id,scheduled_at',
          ignoreDuplicates: true,
        })
      if (!error) summary.materialized += planned.length
    }
  }

  // 2) Doses "na hora" (pendentes, dentro da tolerância) → avisa.
  const fromISO = new Date(now.getTime() - DUE_TOLERANCE_MIN * 60_000).toISOString()
  const toISO = new Date(now.getTime() + 60_000).toISOString()
  const { data: windowDoses } = await admin
    .from('doses')
    .select('*')
    .eq('status', 'pendente')
    .gte('scheduled_at', fromISO)
    .lte('scheduled_at', toISO)

  for (const dose of selectDue((windowDoses ?? []) as DoseRow[], now, DUE_TOLERANCE_MIN)) {
    try {
      const med = medById.get(dose.medication_id)
      const prof = profById.get(dose.user_id)
      if (!med || !prof) continue

      // dedupe: já avisamos esta dose?
      const { data: already } = await admin
        .from('notification_log')
        .select('id')
        .eq('dose_id', dose.id)
        .eq('type', 'lembrete_dose')
        .limit(1)
      if (already && already.length) continue

      const title = 'Hora do remédio 💊'
      const body = `${med.name} — ${med.dose_amount} ${med.unit}`

      let channel: 'push' | 'email' | null = null
      if (prof.push_enabled) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('endpoint, keys')
          .eq('user_id', dose.user_id)
        const n = await pushTo((subs ?? []) as PushSubRow[], {
          title,
          body,
          url: '/',
          tag: `dose-${dose.id}`,
        })
        summary.pushed += n
        if (n > 0) channel = 'push'
      }
      if (prof.email_enabled) {
        const { data: u } = await admin.auth.admin.getUserById(dose.user_id)
        const email = u.user?.email
        if (email && (await sendEmail(email, title, `${body}\n\nAbra o Cuidi para registrar.`))) {
          summary.emailed++
          if (!channel) channel = 'email'
        }
      }
      if (channel) {
        // Upsert idempotente: o índice único (dose_id, type) impede log/aviso duplicado
        // mesmo se dois ticks concorrentes passarem pelo dedupe SELECT acima.
        await admin.from('notification_log').upsert(
          {
            user_id: dose.user_id,
            medication_id: med.id,
            dose_id: dose.id,
            type: 'lembrete_dose',
            channel,
          },
          { onConflict: 'dose_id,type', ignoreDuplicates: true },
        )
      }
    } catch (err) {
      // Uma dose com erro (e-mail inválido, getUserById transitório) não derruba o tick inteiro.
      console.error('tick: erro ao avisar dose', dose.id, err)
    }
  }

  // 3) Marca perdidas (pendentes além da tolerância).
  const cutoffISO = new Date(now.getTime() - DUE_TOLERANCE_MIN * 60_000).toISOString()
  const { data: stale } = await admin
    .from('doses')
    .select('*')
    .eq('status', 'pendente')
    .lte('scheduled_at', cutoffISO)
  for (const d of selectMissed((stale ?? []) as DoseRow[], now, DUE_TOLERANCE_MIN)) {
    const { error } = await admin.from('doses').update({ status: 'perdido' }).eq('id', d.id)
    if (!error) summary.missed++
  }

  // 4) Estoque baixo, 1×/dia no fuso do dono (dedupe pelo notification_log do dia local).
  for (const m of meds) {
    if (!isLowStock(m)) continue
    const prof = profById.get(m.user_id)
    if (!prof) continue
    try {
      const dayStart = zonedTimeToUtc(localDateISO(now, prof.timezone), '00:00', prof.timezone)
      const { data: sent } = await admin
        .from('notification_log')
        .select('id')
        .eq('medication_id', m.id)
        .eq('type', 'estoque_baixo')
        .gte('sent_at', dayStart.toISOString())
        .limit(1)
      if (sent && sent.length) continue

      const title = 'Estoque acabando 📦'
      const body = `${m.name} está quase no fim. Reponha o estoque.`
      let channel: 'push' | 'email' | null = null
      if (prof.push_enabled) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('endpoint, keys')
          .eq('user_id', m.user_id)
        const n = await pushTo((subs ?? []) as PushSubRow[], { title, body, url: '/remedios' })
        if (n > 0) channel = 'push'
      }
      if (prof.email_enabled) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id)
        if (u.user?.email && (await sendEmail(u.user.email, title, body))) {
          if (!channel) channel = 'email'
        }
      }
      if (channel) {
        await admin.from('notification_log').insert({
          user_id: m.user_id,
          medication_id: m.id,
          type: 'estoque_baixo',
          channel,
        })
        summary.lowStock++
      }
    } catch (err) {
      console.error('tick: erro ao avisar estoque baixo', m.id, err)
    }
  }

  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } })
})
