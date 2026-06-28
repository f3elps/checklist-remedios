-- Web Push: assinaturas do navegador por usuário (1 linha por endpoint/dispositivo)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,                         -- { p256dh, auth }
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Log de notificações enviadas (dedupe de lembretes e de estoque baixo)
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete cascade,
  dose_id uuid references public.doses(id) on delete cascade,
  type text not null check (type in ('lembrete_dose','estoque_baixo')),
  channel text not null check (channel in ('push','email')),
  sent_at timestamptz not null default now()
);

-- Único por (dose_id, type): garante idempotência dos lembretes no nível do banco
-- (dois ticks concorrentes não conseguem logar/avisar a mesma dose duas vezes).
-- dose_id NULL (avisos de estoque baixo) não conflita — NULLs são distintos no índice único.
create unique index notification_log_dose_type_uniq on public.notification_log (dose_id, type);
create index notification_log_med_type_sent_idx on public.notification_log (medication_id, type, sent_at);

alter table public.notification_log enable row level security;

-- O dono pode ler o próprio log; a escrita é feita pela Edge Function (service-role, bypassa RLS).
create policy "notification_log_select_own" on public.notification_log
  for select using (auth.uid() = user_id);
