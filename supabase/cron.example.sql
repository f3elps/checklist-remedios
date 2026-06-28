-- Agendamento da Edge Function `tick` (rode no SQL Editor do projeto).
-- Troque <PROJECT_REF>, <SERVICE_ROLE_KEY> e <CRON_SECRET> pelos valores reais (ver SETUP.md).
-- <CRON_SECRET> deve ser o MESMO valor setado no secret CRON_SECRET da função.
-- NÃO commite este arquivo preenchido — a service-role key e o cron secret são secretos.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Re)agenda a cada 15 minutos.
select cron.unschedule('cuidi-tick') where exists (select 1 from cron.job where jobname = 'cuidi-tick');

select cron.schedule(
  'cuidi-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/tick',
    headers:= jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
