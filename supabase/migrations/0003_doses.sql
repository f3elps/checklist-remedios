-- Doses agendadas/registradas (fonte da adesão e do gráfico)
create table public.doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','tomado','pulado','perdido')),
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  unique (medication_id, scheduled_at)
);

create index doses_user_scheduled_idx on public.doses (user_id, scheduled_at);

alter table public.doses enable row level security;

create policy "doses_select_own" on public.doses
  for select using (auth.uid() = user_id);
create policy "doses_insert_own" on public.doses
  for insert with check (auth.uid() = user_id);
create policy "doses_update_own" on public.doses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doses_delete_own" on public.doses
  for delete using (auth.uid() = user_id);
