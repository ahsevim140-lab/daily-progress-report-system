-- 1. Configurable department visibility per main task category.
--    Empty array = visible to everyone. Non-empty = only those departments.
alter table public.task_categories add column visible_departments text[] not null default '{}';

-- Seed: categories named exactly like one of the 4 departments keep their
-- current (department-only) visibility; everything else stays visible to all.
update public.task_categories
set visible_departments = array[main]
where main in ('معماري', 'مدني', 'كهرباء', 'ميكانيك');

-- 2. Department field directly on the user profile (independent of, but
--    prefillable from, a linked employee record).
alter table public.profiles add column department text;

-- 3. Explicit manager-assigned employee -> project visibility.
create table public.employee_project_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employee_id, project_id)
);

alter table public.employee_project_assignments enable row level security;

create policy "assignments: read by any authenticated user"
  on public.employee_project_assignments for select
  using (auth.role() = 'authenticated');

create policy "assignments: write by manager"
  on public.employee_project_assignments for all
  using (public.is_manager())
  with check (public.is_manager());

-- Let an assigned employee read the report batches/lines for their
-- assigned projects (previously only managers/team-leads could read reports).
create policy "reports: read by assigned employee"
  on public.report_batches for select
  using (
    exists (
      select 1 from public.profiles p
      join public.employee_project_assignments epa on epa.employee_id = p.employee_id
      where p.id = auth.uid() and epa.project_id = report_batches.project_id
    )
  );

create policy "reports: read by assigned employee"
  on public.report_lines for select
  using (
    exists (
      select 1 from public.report_batches rb
      join public.profiles p on true
      join public.employee_project_assignments epa on epa.employee_id = p.employee_id
      where rb.id = report_lines.batch_id
        and p.id = auth.uid()
        and epa.project_id = rb.project_id
    )
  );
