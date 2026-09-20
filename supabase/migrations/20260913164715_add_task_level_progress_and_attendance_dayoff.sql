-- ============================================================================
-- 1. Task-level progress tracking (in addition to department-level).
-- ============================================================================
alter table public.project_tasks add column task text;

-- The old constraint enforced one row per (project,building,department).
-- Replace it with two partial unique indexes: at most one "blanket" row per
-- department (task is null, the existing behavior), and one row per
-- specific task under that department when task is set.
alter table public.project_tasks drop constraint project_tasks_project_id_building_id_department_key;

create unique index project_tasks_blanket_unique
  on public.project_tasks (project_id, building_id, department)
  where task is null;

create unique index project_tasks_task_unique
  on public.project_tasks (project_id, building_id, department, task)
  where task is not null;

-- Replay logic: match a report line to its specific task-level row first;
-- fall back to the department's blanket row if no specific row exists yet
-- (this keeps every building that hasn't been broken down into tasks
-- working exactly as before).
create or replace function public.submit_report_batch(
  p_employee_name text,
  p_project_id uuid,
  p_building_id uuid,
  p_lines jsonb -- [{ "department": "...", "task": "...", "percentage": 40, "note": "..." }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_line jsonb;
  v_current numeric;
  v_flag text;
  v_dept text;
  v_task_name text;
  v_task_row_id uuid;
  v_pct numeric;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into report_batches (employee_name, project_id, building_id, created_by)
  values (p_employee_name, p_project_id, p_building_id, auth.uid())
  returning id into v_batch_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_dept := v_line->>'department';
    v_task_name := v_line->>'task';
    v_pct := (v_line->>'percentage')::numeric;
    v_note := nullif(v_line->>'note', '');

    -- 1. a project_tasks row tracking this exact task specifically
    select id, completion_percent into v_task_row_id, v_current
      from project_tasks
      where project_id = p_project_id and building_id = p_building_id
        and department = v_dept and task = v_task_name
      for update;

    -- 2. otherwise the department's shared blanket row (task is null)
    if not found then
      select id, completion_percent into v_task_row_id, v_current
        from project_tasks
        where project_id = p_project_id and building_id = p_building_id
          and department = v_dept and task is null
        for update;
    end if;

    -- 3. otherwise create the blanket row on demand, as before
    if not found then
      insert into project_tasks (project_id, building_id, department, task, weight_percent, completion_percent)
      values (p_project_id, p_building_id, v_dept, null, 0, 0)
      returning id into v_task_row_id;
      v_current := 0;
    end if;

    if v_pct > v_current then
      v_flag := 'none';
    elsif v_pct = v_current then
      v_flag := 'stalled';
    else
      v_flag := 'regressed';
    end if;

    if v_flag != 'none' and (v_note is null) then
      raise exception 'A note is required when % is stalled or regressed for department %', v_pct, v_dept;
    end if;

    insert into report_lines (batch_id, department, task, percentage, previous_percentage, flag, note)
    values (v_batch_id, v_dept, v_task_name, v_pct, v_current, v_flag, v_note);

    update project_tasks
      set completion_percent = v_pct, updated_at = now()
      where id = v_task_row_id;
  end loop;

  return v_batch_id;
end;
$$;

-- ============================================================================
-- 2. Attendance: explicit day-off flag + manual hours-off, separate from the
--    automatic lateness calculation.
-- ============================================================================
alter table public.attendance add column is_day_off boolean not null default false;
alter table public.attendance add column hours_off numeric;
