-- Immutable management report snapshots.
-- A snapshot stores the exact summary/detail payload used when a report was generated.
create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('executive_summary', 'detailed_project', 'monthly', 'employee_activity', 'project_completion')),
  title text not null,
  period_start date not null,
  period_end date not null,
  filters jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  details jsonb not null default '[]'::jsonb,
  generated_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  generated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists report_snapshots_generated_at_idx on public.report_snapshots(generated_at desc);
create index if not exists report_snapshots_period_idx on public.report_snapshots(period_start, period_end);
create index if not exists report_snapshots_type_idx on public.report_snapshots(report_type);

alter table public.report_snapshots enable row level security;
drop policy if exists report_snapshots_manager_read on public.report_snapshots;
drop policy if exists report_snapshots_manager_insert on public.report_snapshots;
create policy report_snapshots_manager_read on public.report_snapshots for select to authenticated using (is_manager());
create policy report_snapshots_manager_insert on public.report_snapshots for insert to authenticated with check (is_manager() and generated_by = auth.uid());
-- Deliberately no update/delete policies: snapshots are immutable audit records.
