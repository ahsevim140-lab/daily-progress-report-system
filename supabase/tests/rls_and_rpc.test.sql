-- RLS + RPC tests for the online (Postgres) side of the Daily Progress Report System.
--
-- What it does: creates throw-away fixtures (auth users, profiles, employees, a project, ...) and
-- impersonates each role via SET LOCAL ROLE + JWT claims, then asserts the rules the README
-- promises: who may call which RPC, what each role can read/write, and that report submission is
-- all-or-nothing. Everything runs inside one transaction that is rolled back, so nothing persists.
--
-- Run (needs a Supabase-style database: anon/authenticated roles and the auth schema):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_rpc.test.sql
-- or paste the whole file into the Supabase SQL editor.
-- A failing check aborts with `ASSERT` and the check's message; success prints the NOTICE below.
-- Prefer a local `supabase start` database or a branch over production, even though it rolls back.
--
-- Validated against the live "daily report" project on 2026-09-20 (all checks pass).

begin;

create function pg_temp.act(p_uid uuid, p_role text default 'authenticated') returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else json_build_object('sub', p_uid::text, 'role', p_role)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $f$;

create function pg_temp.rep(p uuid, b uuid, dept text, task text, pct numeric, note text default null) returns jsonb language sql as $f$
  select jsonb_build_object('project_id', p, 'building_id', b, 'lines', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('department', dept, 'task', task, 'percentage', pct, 'note', note))));
$f$;

do $test$
declare
  tag text := substr(gen_random_uuid()::text, 1, 8);
  d1 text := 'TD1-' || substr(gen_random_uuid()::text, 1, 8);
  d2 text := 'TD2-' || substr(gen_random_uuid()::text, 1, 8);
  u_mgr uuid := gen_random_uuid(); u_lead uuid := gen_random_uuid(); u_emp1 uuid := gen_random_uuid(); u_emp2 uuid := gen_random_uuid(); u_emp3 uuid := gen_random_uuid();
  e_lead uuid; e_emp1 uuid; e_emp2 uuid; e_emp3 uuid;
  p1 uuid; p_closed uuid; b1 uuid; b_closed uuid; t_assigned uuid;
  g_ok40 jsonb; g_stall jsonb; g_stall_nonote jsonb; g_regress jsonb; g_mgr jsonb; g_badbld jsonb; g_closed jsonb; g_assigned jsonb; g_101 jsonb; g_dept jsonb; g_na jsonb;
  v_err text; v_n int; v_rc int; v_pct numeric; v_status text; v_flag text;
begin
  -- ===== fixtures (as postgres; everything is rolled back) =====
  insert into public.departments(name) values (d1), (d2);
  insert into public.employees(name, department) values ('T lead '||tag, d1) returning id into e_lead;
  insert into public.employees(name, department) values ('T emp1 '||tag, d1) returning id into e_emp1;
  insert into public.employees(name, department) values ('T emp2 '||tag, d1) returning id into e_emp2;
  insert into public.employees(name, department) values ('T emp3 '||tag, d2) returning id into e_emp3;

  insert into auth.users(id, email) values
    (u_mgr,  't_mgr_'||tag||'@dprs.local'), (u_lead, 't_lead_'||tag||'@dprs.local'),
    (u_emp1, 't_e1_'||tag||'@dprs.local'),  (u_emp2, 't_e2_'||tag||'@dprs.local'), (u_emp3, 't_e3_'||tag||'@dprs.local');

  update public.profiles set role='manager',     username='t_mgr_'||tag,  display_name='T Manager', active=true where id=u_mgr;
  update public.profiles set role='team_leader', username='t_lead_'||tag, display_name='T Lead',    active=true, employee_id=e_lead where id=u_lead;
  update public.profiles set role='employee',    username='t_e1_'||tag,   display_name='T Emp1',    active=true, employee_id=e_emp1, team_leader_id=u_lead, department=d1 where id=u_emp1;
  update public.profiles set role='employee',    username='t_e2_'||tag,   display_name='T Emp2',    active=true, employee_id=e_emp2, department=d1 where id=u_emp2;
  update public.profiles set role='employee',    username='t_e3_'||tag,   display_name='T Emp3',    active=true, employee_id=e_emp3, department=d2 where id=u_emp3;

  insert into public.projects(name, status, created_by) values ('T p1 '||tag, 'running', u_lead) returning id into p1;
  insert into public.projects(name, status, created_by) values ('T closed '||tag, 'completed', u_mgr) returning id into p_closed;
  insert into public.buildings(project_id, name) values (p1, 'B1') returning id into b1;
  insert into public.buildings(project_id, name) values (p_closed, 'BC') returning id into b_closed;
  insert into public.project_tasks(project_id, building_id, department, task, assigned_employee_id) values (p1, b1, d1, 'T-assigned', e_emp2) returning id into t_assigned;
  insert into public.project_assignments(project_id, employee_id) values (p1, e_emp1), (p1, e_emp2);

  g_ok40 := pg_temp.rep(p1, b1, d1, 'T-happy', 40);
  g_stall_nonote := pg_temp.rep(p1, b1, d1, 'T-happy', 40);
  g_stall := pg_temp.rep(p1, b1, d1, 'T-happy', 40, 'no change today');
  g_regress := pg_temp.rep(p1, b1, d1, 'T-happy', 30, 'redo needed');
  g_mgr := pg_temp.rep(p1, b1, d1, 'T-mgr', 10);
  g_badbld := pg_temp.rep(p1, b_closed, d1, 'T-x', 10);
  g_closed := pg_temp.rep(p_closed, b_closed, d1, 'T-y', 10);
  g_assigned := pg_temp.rep(p1, b1, d1, 'T-assigned', 10);
  g_101 := pg_temp.rep(p1, b1, d1, 'T-z', 101);
  g_dept := pg_temp.rep(p1, b1, d1, 'T-dept', 10);
  g_na := pg_temp.rep(p1, b1, d2, 'T-na', 10);

  -- ===== static checks =====
  assert to_regprocedure('public.submit_report_batch(text,uuid,uuid,jsonb)') is null, 'submit_report_batch must be dropped';
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'every public table must have RLS enabled';
  assert not has_function_privilege('anon', 'public.submit_report(jsonb,date,uuid)', 'execute'), 'anon must not execute submit_report';
  assert has_function_privilege('authenticated', 'public.submit_report(jsonb,date,uuid)', 'execute'), 'authenticated must execute submit_report';
  assert not has_function_privilege('anon', 'public.override_task_completion(uuid,numeric,text)', 'execute'), 'anon must not execute override_task_completion';
  assert not has_function_privilege('anon', 'public.recalculate_project_building_weights(uuid)', 'execute'), 'anon must not execute recalculate_project_building_weights';
  assert not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'authenticated must not execute handle_new_user';
  assert has_function_privilege('authenticated', 'public.is_manager()', 'execute'), 'RLS policies evaluate is_manager() as the caller';

  -- ===== anon =====
  reset role; perform pg_temp.act(null, 'anon');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_ok40), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err ilike '%permission denied%', 'anon calling submit_report: ' || coalesce(v_err, 'no error');
  select count(*) into v_n from public.task_activities; assert v_n = 0, 'anon must read no task_activities';
  select count(*) into v_n from public.employees where id in (e_emp1, e_emp2, e_emp3, e_lead); assert v_n = 0, 'anon must read no employees';
  select count(*) into v_n from public.report_batches; assert v_n = 0, 'anon must read no report_batches';

  -- ===== employee: happy path =====
  reset role; perform pg_temp.act(u_emp1);
  select array_length(public.submit_report(jsonb_build_array(g_ok40), current_date, null), 1) into v_n;
  assert v_n = 1, 'employee report must create one batch';
  reset role;
  select count(*) into v_n from public.report_batches where employee_id = e_emp1 and submitted_by = u_emp1 and created_by = u_emp1 and work_date = current_date and project_id = p1;
  assert v_n = 1, 'batch is stamped with the session employee and submitter';
  select count(*) into v_n from public.report_lines rl join public.report_batches rb on rb.id = rl.batch_id where rb.employee_id = e_emp1 and rl.task = 'T-happy' and rl.percentage = 40 and rl.previous_percentage = 0 and rl.flag = 'none';
  assert v_n = 1, 'report line records percentage, previous and flag';
  select count(*) into v_n from public.task_activities where kind = 'report' and employee_id = e_emp1 and new_percent = 40 and previous_percent = 0 and report_line_id is not null;
  assert v_n = 1, 'one task_activities row linked to the report line';
  select completion_percent, status into v_pct, v_status from public.project_tasks where project_id = p1 and building_id = b1 and task = 'T-happy';
  assert v_pct = 40 and v_status = 'in_progress', 'project_tasks holds the current state';

  -- ===== employee: rejected reports =====
  reset role; perform pg_temp.act(u_emp1);
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_ok40), current_date, e_emp2); exception when others then v_err := sqlerrm; end;
  assert v_err like '%Only a manager can submit a report on behalf%', 'employee on behalf: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_stall), current_date - 1, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%only be submitted for today%', 'back-dated: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_closed), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%Project is closed%', 'closed project: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_badbld), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%does not belong to the selected project%', 'building of another project: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_assigned), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%assigned to another employee%', 'task assigned to someone else: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_101), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%between 0 and 100%', 'percentage 101: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_stall_nonote), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%reason is required%', 'unchanged progress without a reason: ' || coalesce(v_err, 'no error');

  -- all-or-nothing: a valid group followed by an invalid one saves nothing
  reset role; select count(*) into v_n from public.report_batches where employee_id = e_emp1; v_rc := v_n;
  perform pg_temp.act(u_emp1);
  v_err := null; begin perform public.submit_report(jsonb_build_array(pg_temp.rep(p1, b1, d1, 'T-atomic', 5), g_badbld), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'multi-group report with a bad group must fail';
  reset role; select count(*) into v_n from public.report_batches where employee_id = e_emp1;
  assert v_n = v_rc, 'failed report must not leave partial batches';
  select count(*) into v_n from public.project_tasks where project_id = p1 and task = 'T-atomic'; assert v_n = 0, 'failed report must not create tasks';

  -- unchanged / reduced with a reason is allowed and flagged
  perform pg_temp.act(u_emp1);
  perform public.submit_report(jsonb_build_array(g_stall), current_date, null);
  perform public.submit_report(jsonb_build_array(g_regress), current_date, null);
  reset role;
  select flag into v_flag from public.report_lines where task = 'T-happy' and percentage = 40 and note = 'no change today'; assert v_flag = 'stalled', 'unchanged progress is flagged stalled';
  select flag into v_flag from public.report_lines where task = 'T-happy' and percentage = 30 and note = 'redo needed'; assert v_flag = 'regressed', 'reduced progress is flagged regressed';

  -- ===== assignment + department guards =====
  reset role; perform pg_temp.act(u_emp3);
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_na), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%not assigned to this project%', 'unassigned employee: ' || coalesce(v_err, 'no error');
  reset role; insert into public.project_assignments(project_id, employee_id) values (p1, e_emp3);
  perform pg_temp.act(u_emp3);
  v_err := null; begin perform public.submit_report(jsonb_build_array(g_dept), current_date, null); exception when others then v_err := sqlerrm; end;
  assert v_err like '%only report tasks from their own department%', 'wrong department: ' || coalesce(v_err, 'no error');

  -- ===== manager: on behalf + override =====
  reset role; perform pg_temp.act(u_mgr);
  perform public.submit_report(jsonb_build_array(g_mgr), current_date, e_emp1);
  reset role;
  select count(*) into v_n from public.report_batches where employee_id = e_emp1 and submitted_by = u_mgr and created_by = u_mgr; assert v_n = 1, 'on-behalf report keeps the manager as submitter and the employee as reporter';

  perform pg_temp.act(u_emp1);
  v_err := null; begin perform public.override_task_completion((select id from public.project_tasks where project_id = p1 and task = 'T-happy'), 80, 'employee tries'); exception when others then v_err := sqlerrm; end;
  assert v_err like '%Manager access required%', 'employee override: ' || coalesce(v_err, 'no error');
  reset role; perform pg_temp.act(u_mgr);
  v_err := null; begin perform public.override_task_completion((select id from public.project_tasks where project_id = p1 and task = 'T-happy'), 80, '   '); exception when others then v_err := sqlerrm; end;
  assert v_err like '%reason is required%', 'override without reason: ' || coalesce(v_err, 'no error');
  perform public.override_task_completion((select id from public.project_tasks where project_id = p1 and task = 'T-happy'), 80, 'site inspection');
  v_err := null; begin perform public.override_task_completion((select id from public.project_tasks where project_id = p1 and task = 'T-happy'), 80, 'same value'); exception when others then v_err := sqlerrm; end;
  assert v_err like '%same as the current one%', 'override to the same value: ' || coalesce(v_err, 'no error');
  reset role;
  select completion_percent into v_pct from public.project_tasks where project_id = p1 and task = 'T-happy'; assert v_pct = 80, 'override updates the task';
  select count(*) into v_n from public.task_activities where kind = 'override' and new_percent = 80 and reason = 'site inspection' and recorded_by = u_mgr; assert v_n = 1, 'override is audited';

  -- ===== read scoping =====
  perform pg_temp.act(u_emp1);
  select count(*) into v_n from public.report_batches where employee_id = e_emp1; assert v_n >= 2, 'employee sees own batches';
  select count(*) into v_n from public.report_batches where employee_id is distinct from e_emp1; assert v_n = 0, 'employee sees nobody elses batches';
  select count(*) into v_n from public.profiles where id in (u_mgr, u_lead, u_emp1, u_emp2, u_emp3); assert v_n = 1, 'employee reads only their own profile';
  select count(*) into v_n from public.attendance; assert v_n = 0, 'attendance is manager-only';
  select count(*) into v_n from public.task_activities where kind = 'override'; assert v_n = 0, 'employee cannot see manager overrides on unassigned tasks';

  reset role; perform pg_temp.act(u_emp2);
  select count(*) into v_n from public.report_batches where employee_id = e_emp1; assert v_n = 0, 'another employee (not the team leader) cannot read emp1 reports';

  reset role; perform pg_temp.act(u_lead);
  select count(*) into v_n from public.report_batches where employee_id = e_emp1; assert v_n >= 2, 'team leader reads own team reports';
  select count(*) into v_n from public.profiles where id in (u_mgr, u_lead, u_emp1, u_emp2, u_emp3); assert v_n = 2, 'team leader reads self + own team only';

  reset role; perform pg_temp.act(u_mgr);
  select count(*) into v_n from public.report_batches where employee_id = e_emp1; assert v_n >= 2, 'manager reads all reports';
  select count(*) into v_n from public.profiles where id in (u_mgr, u_lead, u_emp1, u_emp2, u_emp3); assert v_n = 5, 'manager reads all profiles';
  select count(*) into v_n from public.task_activities where kind = 'override' and recorded_by = u_mgr; assert v_n = 1, 'manager reads task_activities';

  -- ===== write scoping =====
  -- (BEFORE triggers run ahead of the RLS check, so the direct report_batches insert uses an assigned employee)
  reset role; perform pg_temp.act(u_emp1);
  v_err := null; begin insert into public.projects(name) values ('nope'); exception when others then v_err := sqlerrm; end;
  assert v_err ilike '%row-level security%', 'employee inserting a project: ' || coalesce(v_err, 'no error');
  v_err := null; begin insert into public.report_batches(employee_name, employee_id, project_id, building_id) values ('x', e_emp1, p1, b1); exception when others then v_err := sqlerrm; end;
  assert v_err ilike '%row-level security%', 'direct insert into report_batches: ' || coalesce(v_err, 'no error');
  v_err := null; begin insert into public.task_activities(description, new_percent) values ('x', 1); exception when others then v_err := sqlerrm; end;
  assert v_err ilike '%row-level security%', 'direct insert into task_activities: ' || coalesce(v_err, 'no error');
  update public.profiles set role = 'manager' where id = u_emp1; get diagnostics v_rc = row_count; assert v_rc = 0, 'employee cannot change their own role';
  reset role; select role into v_status from public.profiles where id = u_emp1; assert v_status = 'employee', 'role unchanged';

  perform pg_temp.act(u_lead);
  update public.projects set name = name || ' x' where id = p_closed; get diagnostics v_rc = row_count; assert v_rc = 0, 'team leader cannot edit a project they did not create';
  update public.projects set name = name || ' x' where id = p1; get diagnostics v_rc = row_count; assert v_rc = 1, 'team leader can edit their own project';

  -- ===== login audit =====
  reset role; perform pg_temp.act(u_emp1);
  insert into public.login_audits(user_id, username, display_name, role) values (u_emp1, 't_e1_'||tag, 'T Emp1', 'employee');
  v_err := null; begin insert into public.login_audits(user_id, username, display_name, role) values (u_emp2, 'spoof', 'spoof', 'employee'); exception when others then v_err := sqlerrm; end;
  assert v_err ilike '%row-level security%', 'audit rows for another user: ' || coalesce(v_err, 'no error');
  reset role; perform pg_temp.act(u_emp2);
  select count(*) into v_n from public.login_audits where user_id = u_emp1; assert v_n = 0, 'employee cannot read another user''s login audit';
  reset role; perform pg_temp.act(u_mgr);
  select count(*) into v_n from public.login_audits where user_id = u_emp1; assert v_n = 1, 'manager reads login audits';

  reset role;
  raise notice 'ALL RLS/RPC TESTS PASSED';
end
$test$;

rollback;
