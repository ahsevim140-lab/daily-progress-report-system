-- ============================================================================
-- Team leader role: middle tier between employee and manager.
-- ============================================================================

-- 1. Allow 'team_leader' as a role, and add team assignment column.
--    An employee's profile.team_leader_id points at the team-leader's own
--    profile id. Only managers can set this (via the manage-user Edge
--    Function, which is the only write path to profiles).
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('employee', 'manager', 'team_leader'));

alter table public.profiles add column team_leader_id uuid references public.profiles(id) on delete set null;

create or replace function public.is_team_leader()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'team_leader'
  );
$$;

-- team leaders can see the profiles of employees assigned to them (to show
-- team member names in their dashboard)
create policy "profiles: team leader can read own team"
  on public.profiles for select
  using (public.is_team_leader() and team_leader_id = auth.uid());

-- 2. Projects: track who created it, so team leaders can manage their own.
alter table public.projects add column created_by uuid references auth.users(id) default auth.uid();

-- 3. Replace write policies on projects / buildings / project_tasks so a
--    team leader can manage (create/edit/delete) their own projects and
--    everything under them, in addition to manager's full access.
drop policy "setup: write by manager" on public.projects;
create policy "setup: write by manager or owning team leader"
  on public.projects for all
  using (public.is_manager() or (public.is_team_leader() and created_by = auth.uid()))
  with check (public.is_manager() or (public.is_team_leader() and created_by = auth.uid()));

drop policy "setup: write by manager" on public.buildings;
create policy "setup: write by manager or owning team leader"
  on public.buildings for all
  using (
    public.is_manager()
    or (public.is_team_leader() and exists (
      select 1 from public.projects p where p.id = buildings.project_id and p.created_by = auth.uid()
    ))
  )
  with check (
    public.is_manager()
    or (public.is_team_leader() and exists (
      select 1 from public.projects p where p.id = buildings.project_id and p.created_by = auth.uid()
    ))
  );

drop policy "setup: write by manager" on public.project_tasks;
create policy "setup: write by manager or owning team leader"
  on public.project_tasks for all
  using (
    public.is_manager()
    or (public.is_team_leader() and exists (
      select 1 from public.projects p where p.id = project_tasks.project_id and p.created_by = auth.uid()
    ))
  )
  with check (
    public.is_manager()
    or (public.is_team_leader() and exists (
      select 1 from public.projects p where p.id = project_tasks.project_id and p.created_by = auth.uid()
    ))
  );

-- 4. Reports: team leaders can read batches (and their lines) that belong
--    either to their own team members, or to projects they created.
create policy "reports: read by team leader (own team or own projects)"
  on public.report_batches for select
  using (
    public.is_team_leader() and (
      exists (select 1 from public.profiles p where p.id = report_batches.created_by and p.team_leader_id = auth.uid())
      or exists (select 1 from public.projects pr where pr.id = report_batches.project_id and pr.created_by = auth.uid())
    )
  );

create policy "reports: read by team leader (own team or own projects)"
  on public.report_lines for select
  using (
    public.is_team_leader() and exists (
      select 1 from public.report_batches rb
      where rb.id = report_lines.batch_id
        and (
          exists (select 1 from public.profiles p where p.id = rb.created_by and p.team_leader_id = auth.uid())
          or exists (select 1 from public.projects pr where pr.id = rb.project_id and pr.created_by = auth.uid())
        )
    )
  );
