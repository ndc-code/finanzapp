-- Tabla de copias de seguridad para FinanzApp.
--
-- Se guarda APARTE de `couples` a propósito: cada copia es una foto completa de
-- todos los datos del espacio, y meterlas en la misma fila de `couples` la
-- agrandaría hasta superar el límite de tamaño de payload de Supabase Realtime
-- — que es justo lo que provocaba el borrado silencioso de gastos que este
-- feature viene a mitigar.
--
-- Correr una sola vez en el SQL Editor del proyecto de Supabase.

create table if not exists public.couple_backups (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  created_at timestamptz not null default now(),
  label      text,
  snapshot   jsonb       not null
);

create index if not exists couple_backups_code_created_idx
  on public.couple_backups (code, created_at desc);

alter table public.couple_backups enable row level security;

-- Mismo modelo de acceso que `couples`: el único control es conocer el código
-- del espacio. Sin esta policy, el cliente `anon` no puede leer ni escribir.
drop policy if exists "anon full access to couple_backups" on public.couple_backups;
create policy "anon full access to couple_backups"
  on public.couple_backups
  for all
  to anon
  using (true)
  with check (true);

-- Realtime NO hace falta para esta tabla: la app la consulta a pedido cuando
-- se abre Ajustes. Dejala fuera de la publicación `supabase_realtime`.
