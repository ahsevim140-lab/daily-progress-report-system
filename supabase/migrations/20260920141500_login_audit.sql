create table if not exists public.login_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  role text not null check (role in ('employee', 'team_leader', 'manager')),
  employee_id uuid references public.employees(id) on delete set null,
  logged_in_at timestamptz not null default now()
);
create index if not exists login_audits_logged_in_at_idx on public.login_audits(logged_in_at desc);
create index if not exists login_audits_user_id_idx on public.login_audits(user_id);
alter table public.login_audits enable row level security;
drop policy if exists login_audits_insert_self on public.login_audits;
drop policy if exists login_audits_select_self_or_manager on public.login_audits;
create policy login_audits_insert_self on public.login_audits for insert to authenticated with check (user_id = auth.uid());
create policy login_audits_select_self_or_manager on public.login_audits for select to authenticated using (user_id = auth.uid() or is_manager());
