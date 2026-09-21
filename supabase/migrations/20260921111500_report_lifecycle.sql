-- Report workflow lifecycle and review audit fields.
alter table public.report_batches
  add column if not exists status text not null default 'submitted' check (status in ('submitted', 'returned', 'approved', 'locked')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists report_batches_status_idx on public.report_batches(status);
create index if not exists report_batches_reviewed_at_idx on public.report_batches(reviewed_at desc);

create or replace function public.review_report_batch(
  p_batch_id uuid,
  p_status text,
  p_note text default null
) returns public.report_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.profiles%rowtype;
  v_batch public.report_batches%rowtype;
  v_project public.projects%rowtype;
  v_employee_profile public.profiles%rowtype;
begin
  select * into v_caller from public.profiles where id = auth.uid() and active = true;
  if not found or v_caller.role not in ('manager', 'team_leader') then
    raise exception 'Only managers and team leaders can review reports.';
  end if;
  if p_status not in ('returned', 'approved', 'locked') then
    raise exception 'Invalid review status.';
  end if;
  if p_status = 'returned' and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required when returning a report.';
  end if;
  if p_status = 'locked' and v_caller.role <> 'manager' then
    raise exception 'Only a manager can lock a report.';
  end if;

  select * into v_batch from public.report_batches where id = p_batch_id for update;
  if not found then raise exception 'Report not found.'; end if;
  if v_batch.status = 'locked' then raise exception 'Locked reports cannot be changed.'; end if;

  if v_caller.role = 'team_leader' then
    select * into v_employee_profile from public.profiles where employee_id = v_batch.employee_id;
    select * into v_project from public.projects where id = v_batch.project_id;
    if not ((v_employee_profile.team_leader_id = auth.uid()) or (v_project.created_by = auth.uid())) then
      raise exception 'You can only review reports in your team or owned projects.';
    end if;
  end if;

  update public.report_batches
    set status = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_batch_id
  returning * into v_batch;
  return v_batch;
end;
$$;

revoke all on function public.review_report_batch(uuid, text, text) from public;
grant execute on function public.review_report_batch(uuid, text, text) to authenticated;
