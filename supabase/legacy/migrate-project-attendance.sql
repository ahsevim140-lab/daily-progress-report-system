-- Improvements migration: project status, task-level project selection, departments, attendance
alter table public.projects add column if not exists status text not null default 'running' check (status in ('running','stopped','not_wanted','completed'));
alter table public.departments add column if not exists active boolean not null default true;
alter table public.project_tasks add column if not exists task text not null default '';
alter table public.project_tasks add column if not exists category text;

-- Keep existing department-level rows valid while allowing multiple selected tasks.
drop index if exists public.project_tasks_project_id_building_id_department_key;
alter table public.project_tasks drop constraint if exists project_tasks_project_id_building_id_department_key;
alter table public.project_tasks add constraint project_tasks_project_building_department_task_key unique (project_id, building_id, department, task);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null,
  entrance_time time,
  status text not null default 'present' check (status in ('present','late','day_off','hours_off','absent')),
  hours_off numeric not null default 0 check (hours_off >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

alter table public.attendance enable row level security;
create policy "attendance: manager read" on public.attendance for select using (public.is_manager());
create policy "attendance: manager write" on public.attendance for all using (public.is_manager()) with check (public.is_manager());

-- Existing submit function still works; it now matches a selected task where present.
create or replace function public.submit_report_batch(
  p_employee_name text, p_project_id uuid, p_building_id uuid, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch_id uuid; v_line jsonb; v_current numeric; v_flag text; v_dept text; v_task text; v_pct numeric; v_note text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into report_batches (employee_name, project_id, building_id, created_by) values (p_employee_name, p_project_id, p_building_id, auth.uid()) returning id into v_batch_id;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_dept := v_line->>'department'; v_task := v_line->>'task'; v_pct := (v_line->>'percentage')::numeric; v_note := nullif(v_line->>'note', '');
    select completion_percent into v_current from project_tasks where project_id = p_project_id and building_id = p_building_id and department = v_dept and (task = v_task or task = '') order by case when task = v_task then 0 else 1 end limit 1 for update;
    if not found then insert into project_tasks (project_id, building_id, department, task, weight_percent, completion_percent) values (p_project_id,p_building_id,v_dept,v_task,0,0); v_current := 0; end if;
    if v_pct > v_current then v_flag := 'none'; elsif v_pct = v_current then v_flag := 'stalled'; else v_flag := 'regressed'; end if;
    if v_flag != 'none' and v_note is null then raise exception 'A note is required when progress is stalled or regressed'; end if;
    insert into report_lines (batch_id, department, task, percentage, previous_percentage, flag, note) values (v_batch_id,v_dept,v_task,v_pct,v_current,v_flag,v_note);
    update project_tasks set completion_percent = v_pct, updated_at = now() where project_id = p_project_id and building_id = p_building_id and department = v_dept and (task = v_task or task = '');
  end loop; return v_batch_id;
end; $$;
grant execute on function public.submit_report_batch(text, uuid, uuid, jsonb) to authenticated;
