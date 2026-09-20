create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  arrival_time text,
  note text,
  updated_at timestamptz not null default now(),
  unique (date, employee_id)
);

alter table public.attendance enable row level security;

create policy "attendance: manager full access"
  on public.attendance for all
  using (public.is_manager())
  with check (public.is_manager());

create table public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;

create policy "settings: read by any authenticated user"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "settings: write by manager"
  on public.app_settings for all
  using (public.is_manager())
  with check (public.is_manager());

insert into public.app_settings (key, value) values ('work_start_time', '08:00');
