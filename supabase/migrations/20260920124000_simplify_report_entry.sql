-- Report entry now captures project, building, department, main task,
-- subtask, percentage, and optional notes only.
create or replace function public.submit_report(
  p_groups jsonb,
  p_work_date date default current_date,
  p_on_behalf_of uuid default null
) returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.profiles%rowtype;
  v_employee public.employees%rowtype;
  v_batch_id uuid;
  v_batch_ids uuid[] := '{}';
  v_group jsonb;
  v_line jsonb;
  v_project_id uuid;
  v_building_id uuid;
  v_report_line_id uuid;
  v_current numeric;
  v_flag text;
  v_dept text;
  v_task text;
  v_pct numeric;
  v_note text;
  v_project public.projects%rowtype;
  v_building public.buildings%rowtype;
  v_task_row public.project_tasks%rowtype;
begin
  select * into v_caller from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Not authenticated'; end if;
  if p_work_date is null or p_work_date <> current_date then raise exception 'Reports can only be submitted for today.'; end if;
  if p_groups is null or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then raise exception 'Report must include at least one project/building group'; end if;

  if p_on_behalf_of is not null then
    if v_caller.role <> 'manager' then raise exception 'Only a manager can submit a report on behalf of another employee.'; end if;
    select * into v_employee from public.employees where id = p_on_behalf_of;
  else
    select * into v_employee from public.employees where id = v_caller.employee_id;
  end if;
  if not found then raise exception 'Your account is not linked to an employee record.'; end if;

  for v_group in select value from jsonb_array_elements(p_groups)
  loop
    v_project_id := nullif(v_group->>'project_id','')::uuid;
    v_building_id := nullif(v_group->>'building_id','')::uuid;
    select * into v_project from public.projects where id = v_project_id;
    if not found then raise exception 'Project not found.'; end if;
    if v_project.status in ('completed','stopped','not_wanted') then raise exception 'Project is closed and no longer accepts progress reports.'; end if;
    select * into v_building from public.buildings where id = v_building_id and project_id = v_project_id;
    if not found then raise exception 'The selected building does not belong to the selected project.'; end if;
    if v_group->'lines' is null or jsonb_typeof(v_group->'lines') <> 'array' or jsonb_array_length(v_group->'lines') = 0 then raise exception 'Each group requires at least one task'; end if;

    insert into public.report_batches(employee_id, employee_name, submitted_by, project_id, building_id, work_date, created_by)
    values (v_employee.id, v_employee.name, auth.uid(), v_project_id, v_building_id, current_date, auth.uid())
    returning id into v_batch_id;
    v_batch_ids := v_batch_ids || v_batch_id;

    for v_line in select value from jsonb_array_elements(v_group->'lines')
    loop
      v_dept := nullif(trim(v_line->>'department'));
      v_task := nullif(trim(v_line->>'task'));
      v_pct := nullif(v_line->>'percentage','')::numeric;
      v_note := nullif(trim(v_line->>'note'),'');
      if v_dept is null or v_task is null then raise exception 'Each task line needs a department and a task.'; end if;
      if v_pct is null or v_pct < 0 or v_pct > 100 then raise exception 'Percentage must be a number between 0 and 100.'; end if;

      select * into v_task_row from public.project_tasks
      where project_id = v_project_id and building_id = v_building_id and department = v_dept and (task = v_task or task = '')
      order by case when task = v_task then 0 else 1 end, id limit 1 for update;
      if not found then
        insert into public.project_tasks(project_id, building_id, department, task, weight_percent, completion_percent, priority, status)
        values (v_project_id, v_building_id, v_dept, v_task, 0, 0, 'normal', 'not_started') returning * into v_task_row;
      end if;
      if v_task_row.assigned_employee_id is not null and v_task_row.assigned_employee_id <> v_employee.id then raise exception 'This task is assigned to another employee.'; end if;
      if v_task_row.status = 'cancelled' then raise exception 'This task is cancelled and cannot receive progress.'; end if;
      v_current := coalesce(v_task_row.completion_percent, 0);
      if v_pct <= v_current and v_note is null then raise exception 'A reason is required when progress is unchanged or reduced.'; end if;
      v_flag := case when v_pct > v_current then 'none' when v_pct = v_current then 'stalled' else 'regressed' end;

      insert into public.report_lines(batch_id, department, task, project_task_id, percentage, previous_percentage, flag, note)
      values (v_batch_id, v_dept, v_task, v_task_row.id, v_pct, v_current, v_flag, v_note)
      returning id into v_report_line_id;
      insert into public.task_activities(project_task_id, employee_id, employee_name, activity_date, description, previous_percent, new_percent, note, kind, report_line_id, recorded_by)
      values (v_task_row.id, v_employee.id, v_employee.name, current_date, coalesce(v_note, 'Daily progress update'), v_current, v_pct, v_note, 'report', v_report_line_id, auth.uid());
      update public.project_tasks set completion_percent = v_pct, status = case when v_pct = 100 then 'completed' when v_pct > 0 then 'in_progress' else status end, actual_start = case when v_pct > 0 and actual_start is null then current_date else actual_start end, actual_finish = case when v_pct = 100 then current_date else actual_finish end, updated_at = now() where id = v_task_row.id;
    end loop;
  end loop;
  return v_batch_ids;
end;
$$;

grant execute on function public.submit_report(jsonb,date,uuid) to authenticated;
