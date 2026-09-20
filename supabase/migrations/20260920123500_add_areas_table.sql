-- The frontend reads areas for building organization and setup screens.
-- This table was missing from the existing online project.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (building_id, name)
);

alter table public.areas enable row level security;

drop policy if exists "areas: read by any authenticated user" on public.areas;
create policy "areas: read by any authenticated user"
  on public.areas for select
  using (auth.role() = 'authenticated');

drop policy if exists "areas: write by manager" on public.areas;
create policy "areas: write by manager"
  on public.areas for all
  using (is_manager())
  with check (is_manager());

create index if not exists areas_building_id_idx on public.areas(building_id);
