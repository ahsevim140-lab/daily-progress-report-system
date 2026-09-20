-- Project Setup v2: lifecycle, weighted buildings, organizational areas, and multiple tasks per department
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists target_date date;
alter table public.projects add column if not exists status text not null default 'draft';
alter table public.projects add constraint projects_status_check check (status in ('draft','ready','running','stopped','not_wanted','completed'));
alter table public.buildings add column if not exists weight_percent numeric not null default 0 check (weight_percent >= 0 and weight_percent <= 100);

alter table public.project_tasks add column if not exists task text not null default '';
alter table public.project_tasks add column if not exists category text;
drop index if exists public.project_tasks_project_id_building_id_department_key;
alter table public.project_tasks drop constraint if exists project_tasks_project_id_building_id_department_key;
alter table public.project_tasks add constraint project_tasks_multi_task_key unique (project_id, building_id, department, task);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  unique (building_id, name)
);
alter table public.areas enable row level security;
create policy "areas: read by authenticated" on public.areas for select using (auth.role() = 'authenticated');
create policy "areas: manager write" on public.areas for all using (public.is_manager()) with check (public.is_manager());

alter table public.report_lines add column if not exists area_id uuid references public.areas(id) on delete set null;

-- A project may be published only when setup validation is complete. The UI enforces this rule;
-- managers may change status manually when needed.
