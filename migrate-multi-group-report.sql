-- Multi-group daily report submission.
-- A single report can now cover several projects, each with several buildings,
-- each with several tasks. One report_batches row is still created per
-- (project, building) pair (matching the existing table's meaning), but every
-- batch + line + task_activity in the whole report is written in one
-- plpgsql call, so the report is atomic: if any group/line fails validation,
-- nothing from the submission is saved.
--
-- Areas are intentionally not part of this — report_lines.area_id is left
-- untouched (still nullable) but this function never sets it.
--
-- This supersedes submit_report_batch() for the report form. The old
-- function is left in place (harmless, unused by the app) in case anything
-- else still calls it.

create or replace function public.submit_report(
  p_employee_name text,
  p_groups jsonb
  -- [
  --   { "project_id": "...", "building_id": "...",
  --     "lines": [{ "department":"...", "task":"...", "percentage":40,
  --                 "activity":"...", "hours_worked":3.5,
  --                 "blocker":"...", "note":"..." }, ...] },
  --   ...
  -- ]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_ids uuid[] := '{}';
  v_batch_id uuid;
  v_group jsonb;
  v_line jsonb;
  v_project_id uuid;
  v_building_id uuid;
  v_task_id uuid;
  v_current numeric;
  v_flag text;
  v_dept text;
  v_task text;
  v_pct numeric;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_groups is null or jsonb_array_length(p_groups) = 0 then
    raise exception 'Report must include at least one project/building group';
  end if;

  for v_group in select * from jsonb_array_elements(p_groups)
  loop
    v_project_id := (v_group->>'project_id')::uuid;
    v_building_id := (v_group->>'building_id')::uuid;

    if v_project_id is null or v_building_id is null then
      raise exception 'Each group requires a project and a building';
    end if;
    if v_group->'lines' is null or jsonb_array_length(v_group->'lines') = 0 then
      raise exception 'Each project/building group requires at least one task';
    end if;

    insert into report_batches (employee_name, project_id, building_id, created_by)
    values (p_employee_name, v_project_id, v_building_id, auth.uid())
    returning id into v_batch_id;
    v_batch_ids := v_batch_ids || v_batch_id;

    for v_line in select * from jsonb_array_elements(v_group->'lines')
    loop
      v_dept := v_line->>'department';
      v_task := v_line->>'task';
      v_pct := (v_line->>'percentage')::numeric;
      v_note := nullif(v_line->>'note', '');

      select id, completion_percent into v_task_id, v_current
        from project_tasks
        where project_id = v_project_id and building_id = v_building_id
          and department = v_dept and (task = v_task or task = '')
        order by case when task = v_task then 0 else 1 end
        limit 1
        for update;

      if not found then
        insert into project_tasks (project_id, building_id, department, task, weight_percent, completion_percent, status)
        values (v_project_id, v_building_id, v_dept, v_task, 0, 0, 'not_started')
        returning id into v_task_id;
        v_current := 0;
      end if;

      if v_pct > v_current then
        v_flag := 'none';
      elsif v_pct = v_current then
        v_flag := 'stalled';
      else
        v_flag := 'regressed';
      end if;

      if v_flag != 'none' and v_note is null then
        raise exception 'A note is required when progress is stalled or regressed for %/%', v_dept, v_task;
      end if;

      insert into report_lines (batch_id, department, task, percentage, previous_percentage, flag, note, activity, hours_worked, blocker)
      values (v_batch_id, v_dept, v_task, v_pct, v_current, v_flag, v_note, v_line->>'activity', (v_line->>'hours_worked')::numeric, nullif(v_line->>'blocker', ''));

      insert into task_activities (project_task_id, activity_date, description, previous_percent, new_percent, hours_worked, blocker, note)
      values (v_task_id, current_date, coalesce(v_line->>'activity', 'Daily progress update'), v_current, v_pct, (v_line->>'hours_worked')::numeric, nullif(v_line->>'blocker', ''), v_note);

      update project_tasks
        set completion_percent = v_pct,
            status = case when v_pct = 100 then 'completed' when v_pct > 0 then 'in_progress' else status end,
            actual_start = case when v_pct > 0 and actual_start is null then current_date else actual_start end,
            actual_finish = case when v_pct = 100 then current_date else actual_finish end,
            updated_at = now()
        where id = v_task_id;
    end loop;
  end loop;

  return v_batch_ids;
end;
$$;

grant execute on function public.submit_report(text, jsonb) to authenticated;
