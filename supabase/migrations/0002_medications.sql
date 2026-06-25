-- Medicamentos do usuário (ilimitados)
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null,                         -- comprimido | ml | gota | aplicacao | ...
  dose_amount numeric not null check (dose_amount > 0),
  schedule_type text not null check (schedule_type in ('vezes_por_dia','de_x_em_x_horas','horarios_fixos')),
  schedule_config jsonb not null default '{}'::jsonb,
  stock_quantity numeric not null default 0 check (stock_quantity >= 0),
  start_date date not null default current_date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index medications_user_active_idx on public.medications (user_id, active);

alter table public.medications enable row level security;

create policy "medications_select_own" on public.medications
  for select using (auth.uid() = user_id);
create policy "medications_insert_own" on public.medications
  for insert with check (auth.uid() = user_id);
create policy "medications_update_own" on public.medications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "medications_delete_own" on public.medications
  for delete using (auth.uid() = user_id);
