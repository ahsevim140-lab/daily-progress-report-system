-- Project-level assignment: employees see and report only on assigned projects.
create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index if not exists project_assignments_employee_idx on public.project_assignments(employee_id);
create index if not exists project_assignments_project_idx on public.project_assignments(project_id);

alter table public.project_assignments enable row level security;
drop policy if exists "project assignments: manager manage" on public.project_assignments;
drop policy if exists "project assignments: employee reads own" on public.project_assignments;
create policy "project assignments: manager manage" on public.project_assignments for all using (is_manager()) with check (is_manager());
create policy "project assignments: employee reads own" on public.project_assignments for select using (employee_id = (select employee_id from public.profiles where id = auth.uid()));

create or replace function public.set_project_assignment_actor()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.assigned_by is null then new.assigned_by := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists project_assignments_actor on public.project_assignments;
create trigger project_assignments_actor before insert on public.project_assignments for each row execute function public.set_project_assignment_actor();

create or replace function public.enforce_project_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'manager') then return new; end if;
  if not exists (select 1 from public.project_assignments where project_id = new.project_id and employee_id = new.employee_id) then
    raise exception 'Employee is not assigned to this project.';
  end if;
  return new;
end;
$$;
drop trigger if exists report_batches_project_assignment on public.report_batches;
create trigger report_batches_project_assignment before insert on public.report_batches for each row execute function public.enforce_project_assignment();

create or replace function public.enforce_report_line_department()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_employee_department text;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'manager') then return new; end if;
  select e.department into v_employee_department
  from public.report_batches rb join public.employees e on e.id = rb.employee_id
  where rb.id = new.batch_id;
  if v_employee_department is null or v_employee_department <> new.department then
    raise exception 'Employees may only report tasks from their own department.';
  end if;
  return new;
end;
$$;
drop trigger if exists report_lines_department on public.report_lines;
create trigger report_lines_department before insert on public.report_lines for each row execute function public.enforce_report_line_department();
