-- Task management v3: assignments, lifecycle, scheduling, and activity history
alter table public.project_tasks add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null;
alter table public.project_tasks add column if not exists assigned_team text;
alter table public.project_tasks add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent'));
alter table public.project_tasks add column if not exists status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','under_review','revision_required','completed','cancelled','on_hold'));
alter table public.project_tasks add column if not exists planned_start date;
alter table public.project_tasks add column if not exists planned_finish date;
alter table public.project_tasks add column if not exists actual_start date;
alter table public.project_tasks add column if not exists actual_finish date;

create table if not exists public.task_activities (
  id uuid primary key default gen_random_uuid(),
  project_task_id uuid references public.project_tasks(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  activity_date date not null default current_date,
  description text not null,
  previous_percent numeric not null default 0 check (previous_percent >= 0 and previous_percent <= 100),
  new_percent numeric not null check (new_percent >= 0 and new_percent <= 100),
  hours_worked numeric check (hours_worked is null or hours_worked >= 0),
  blocker text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.task_activities enable row level security;
create policy "task activities: manager read" on public.task_activities for select using (public.is_manager());
create policy "task activities: authenticated insert" on public.task_activities for insert with check (auth.uid() is not null);

alter table public.report_lines add column if not exists activity text;
alter table public.report_lines add column if not exists hours_worked numeric;
alter table public.report_lines add column if not exists blocker text;

-- New submissions create an immutable activity record in addition to the report line and task summary update.
create or replace function public.submit_report_batch(
  p_employee_name text, p_project_id uuid, p_building_id uuid, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch_id uuid; v_line jsonb; v_task_id uuid; v_current numeric; v_flag text; v_dept text; v_task text; v_pct numeric; v_note text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into report_batches (employee_name, project_id, building_id, created_by) values (p_employee_name,p_project_id,p_building_id,auth.uid()) returning id into v_batch_id;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_dept := v_line->>'department'; v_task := v_line->>'task'; v_pct := (v_line->>'percentage')::numeric; v_note := nullif(v_line->>'note','');
    select id, completion_percent into v_task_id, v_current from project_tasks where project_id=p_project_id and building_id=p_building_id and department=v_dept and (task=v_task or task='') order by case when task=v_task then 0 else 1 end limit 1 for update;
    if not found then insert into project_tasks(project_id,building_id,department,task,weight_percent,completion_percent,status) values(p_project_id,p_building_id,v_dept,v_task,0,0,'not_started') returning id into v_task_id; v_current := 0; end if;
    if v_pct > v_current then v_flag := 'none'; elsif v_pct = v_current then v_flag := 'stalled'; else v_flag := 'regressed'; end if;
    if v_flag <> 'none' and v_note is null then raise exception 'A note is required when progress is stalled or regressed'; end if;
    insert into report_lines(batch_id,department,task,percentage,previous_percentage,flag,note,area_id,activity,hours_worked,blocker) values(v_batch_id,v_dept,v_task,v_pct,v_current,v_flag,v_note,nullif(v_line->>'area_id','')::uuid,v_line->>'activity',(v_line->>'hours_worked')::numeric,nullif(v_line->>'blocker',''));
    insert into task_activities(project_task_id,activity_date,description,previous_percent,new_percent,hours_worked,blocker,note) values(v_task_id,current_date,coalesce(v_line->>'activity','Daily progress update'),v_current,v_pct,(v_line->>'hours_worked')::numeric,nullif(v_line->>'blocker',''),v_note);
    update project_tasks set completion_percent=v_pct,status=case when v_pct=100 then 'completed' when v_pct>0 then 'in_progress' else status end,actual_start=case when v_pct>0 and actual_start is null then current_date else actual_start end,actual_finish=case when v_pct=100 then current_date else actual_finish end,updated_at=now() where id=v_task_id;
  end loop; return v_batch_id;
end; $$;
grant execute on function public.submit_report_batch(text,uuid,uuid,jsonb) to authenticated;
