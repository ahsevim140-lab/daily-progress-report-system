-- Actionable blocker records derived from daily work, with ownership and resolution history.
create table if not exists public.task_blockers (
  id uuid primary key default gen_random_uuid(),
  project_task_id uuid not null references public.project_tasks(id) on delete cascade,
  report_line_id uuid references public.report_lines(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  owner_employee_id uuid references public.employees(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists task_blockers_status_idx on public.task_blockers(status);
create index if not exists task_blockers_task_idx on public.task_blockers(project_task_id);
create index if not exists task_blockers_owner_idx on public.task_blockers(owner_employee_id);

alter table public.task_blockers enable row level security;
drop policy if exists task_blockers_read on public.task_blockers;
drop policy if exists task_blockers_manager_insert on public.task_blockers;
create policy task_blockers_read on public.task_blockers for select to authenticated using (is_manager() or owner_employee_id = (select employee_id from public.profiles where id = auth.uid()) or (is_team_leader() and exists (select 1 from public.profiles p where p.employee_id = task_blockers.owner_employee_id and p.team_leader_id = auth.uid())));
create policy task_blockers_manager_insert on public.task_blockers for insert to authenticated with check (is_manager() or (is_team_leader() and exists (select 1 from public.project_tasks pt join public.projects pr on pr.id = pt.project_id where pt.id = task_blockers.project_task_id and pr.created_by = auth.uid())));

create or replace function public.update_task_blocker(p_blocker_id uuid, p_status text, p_owner_employee_id uuid default null, p_note text default null)
returns public.task_blockers language plpgsql security definer set search_path = public as $$
declare v_caller public.profiles%rowtype; v_blocker public.task_blockers%rowtype; v_task public.project_tasks%rowtype; v_project public.projects%rowtype;
begin
  select * into v_caller from public.profiles where id = auth.uid() and active = true;
  if not found or v_caller.role not in ('manager','team_leader') then raise exception 'Only managers and team leaders can update blockers.'; end if;
  if p_status not in ('open','in_progress','resolved','dismissed') then raise exception 'Invalid blocker status.'; end if;
  if p_status in ('resolved','dismissed') and nullif(trim(coalesce(p_note,'')), '') is null then raise exception 'A resolution note is required.'; end if;
  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if not found then raise exception 'Blocker not found.'; end if;
  select * into v_task from public.project_tasks where id = v_blocker.project_task_id;
  select * into v_project from public.projects where id = v_task.project_id;
  if v_caller.role = 'team_leader' and v_project.created_by <> auth.uid() then raise exception 'You can only update blockers in projects you own.'; end if;
  update public.task_blockers set status = p_status, owner_employee_id = coalesce(p_owner_employee_id, owner_employee_id), resolution_note = nullif(trim(coalesce(p_note,'')), ''), resolved_by = case when p_status in ('resolved','dismissed') then auth.uid() else null end, resolved_at = case when p_status in ('resolved','dismissed') then now() else null end, updated_at = now() where id = p_blocker_id returning * into v_blocker;
  return v_blocker;
end; $$;
revoke all on function public.update_task_blocker(uuid,text,uuid,text) from public;
grant execute on function public.update_task_blocker(uuid,text,uuid,text) to authenticated;
