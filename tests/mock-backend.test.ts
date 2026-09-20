// Tests for the offline backend (src/lib/mockSupabase.ts). In offline mode that file is the
// database, so these tests are what protect the business rules: identity, validation,
// atomicity, history, and who can read what.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// --- browser shims (the mock expects localStorage and window) ---
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as any).window = globalThis;
(globalThis as any).location = { reload: () => {} };

const api: any = (await import('../src/lib/mockSupabase.ts')).mockSupabase; // typed any, as in src/lib/supabase.ts
const { todayLocalYMD } = await import('../src/utils.ts');

const login = async (username: string, password: string) => {
  const { error } = await api.auth.signInWithPassword({ email: `${username}@dprs.local`, password });
  assert.equal(error, null);
};
const rows = async (table: string): Promise<any[]> => (await api.from(table)).data;
const line = (department: string, task: string, percentage: number, extra: Record<string, unknown> = {}) =>
  ({ department, task, percentage, activity: 'did some work', hours_worked: null, blocker: null, note: null, ...extra });

let ctx: { project: any; building: any; otherProject: any; employees: any[]; users: Record<string, any> };

beforeEach(async () => {
  (globalThis as any).__resetOfflineData();
  await login('manager', 'manager123');
  const [projects, buildings, employees, users] = [await rows('projects'), await rows('buildings'), await rows('employees'), (await api.functions.invoke('manage-user', { body: { action: 'list' } })).data.users];
  const other = await api.from('projects').insert({ name: 'Other project', status: 'running' }).select().single();
  await api.from('buildings').insert({ project_id: other.data.id, name: 'Other building', weight_percent: 100 });
  ctx = { project: projects[0], building: buildings[0], otherProject: other.data, employees, users: Object.fromEntries(users.map((u: any) => [u.username, u])) };
  await api.auth.signOut();
});

const group = (lines: any[], building = ctx.building, project = ctx.project) => ({ project_id: project.id, building_id: building.id, lines });

test('reporting employee is derived from the session, and the request cannot override it', async () => {
  await login('employee', 'employee123');
  const r = await api.rpc('submit_report', { p_groups: [group([line(ctx.employees[1].department, 'x', 30)])], p_employee_name: 'Someone Else' });
  assert.equal(r.error, null);
  await login('manager', 'manager123');
  const [batch] = await rows('report_batches');
  assert.equal(batch.employee_name, ctx.employees[1].name);
  assert.equal(batch.employee_id, ctx.employees[1].id);
  assert.equal(batch.submitted_by, ctx.users.employee.id);
});

test('only a manager can report on behalf of someone else, and it is recorded', async () => {
  await login('employee', 'employee123');
  const denied = await api.rpc('submit_report', { p_groups: [group([line('d', 't', 10)])], p_on_behalf_of: ctx.employees[0].id });
  assert.match(denied.error.message, /manager/i);

  await login('manager', 'manager123');
  const noLink = await api.rpc('submit_report', { p_groups: [group([line('d', 't', 10)])] });
  assert.match(noLink.error.message, /not linked/i); // manager has no employee record of their own

  const ok = await api.rpc('submit_report', { p_groups: [group([line('d', 't', 10)])], p_on_behalf_of: ctx.employees[2].id });
  assert.equal(ok.error, null);
  const [batch] = await rows('report_batches');
  assert.equal(batch.employee_id, ctx.employees[2].id);
  assert.equal(batch.submitted_by, ctx.users.manager.id);
});

test('a building from another project is rejected, and the whole report is rolled back', async () => {
  await login('employee', 'employee123');
  const foreign = (await rows('buildings')).find((b) => b.project_id === ctx.otherProject.id);
  const before = { b: (await rows('report_batches')).length, a: (await rows('task_activities')).length, t: (await rows('project_tasks')).length };
  const r = await api.rpc('submit_report', { p_groups: [group([line(ctx.employees[1].department, 'good', 20)]), group([line(ctx.employees[1].department, 'bad', 20)], foreign, ctx.project)] });
  assert.match(r.error.message, /does not belong/i);
  await login('manager', 'manager123');
  assert.equal((await rows('report_batches')).length, before.b);
  assert.equal((await rows('task_activities')).length, before.a);
  assert.equal((await rows('project_tasks')).length, before.t);
});

test('closed projects reject progress', async () => {
  await api.auth.signInWithPassword({ email: 'manager@dprs.local', password: 'manager123' });
  for (const status of ['completed', 'stopped', 'not_wanted']) {
    await api.from('projects').update({ status }).eq('id', ctx.project.id);
    await login('employee', 'employee123');
    const r = await api.rpc('submit_report', { p_groups: [group([line('d', 't', 10)])] });
    assert.match(r.error.message, /no longer accepts/i, status);
    await login('manager', 'manager123');
  }
});

test('a task assigned to someone else cannot be reported on', async () => {
  await login('manager', 'manager123');
  const task = (await rows('project_tasks')).find((t) => t.building_id === ctx.building.id && t.department === ctx.employees[1].department);
  await api.from('project_tasks').update({ assigned_employee_id: ctx.employees[2].id }).eq('id', task.id);
  await login('employee', 'employee123'); // linked to employees[1]
  const r = await api.rpc('submit_report', { p_groups: [group([line(ctx.employees[1].department, task.task || 'shop drawings', 40)])] });
  assert.match(r.error.message, /assigned to another/i);
});

test('input validation: percentage, note on no progress, and work date', async () => {
  await login('employee', 'employee123');
  const submit = (l: any, extra: any = {}) => api.rpc('submit_report', { p_groups: [group([l])], ...extra });
  assert.match((await submit(line(ctx.employees[1].department, 't', 140))).error.message, /between 0 and 100/);
  assert.match((await submit(line(ctx.employees[1].department, 't', Number.NaN))).error.message, /between 0 and 100/);
  assert.match((await submit(line(ctx.employees[1].department, 't', 0))).error.message, /reason is required/i); // new task, 0 -> 0
  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  assert.match((await submit(line(ctx.employees[1].department, 't', 10), { p_work_date: tomorrow })).error.message, /today/i);
  const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  assert.match((await submit(line(ctx.employees[1].department, 't', 10), { p_work_date: yesterday })).error.message, /today/i);
  assert.match((await submit(line(ctx.employees[1].department, 't', 10), { p_work_date: 'yesterday' })).error.message, /Invalid work date/);
});

test('activity is the single history record: linked to its line, dated by work date, flags derived', async () => {
  await login('employee', 'employee123');
  const dept = ctx.employees[1].department;
  const workDate = todayLocalYMD();
  assert.equal((await api.rpc('submit_report', { p_groups: [group([line(dept, 'A', 60)])], p_work_date: workDate })).error, null);
  assert.equal((await api.rpc('submit_report', { p_groups: [group([line(dept, 'A', 40, { note: 'rework needed' })])] })).error, null);

  await login('manager', 'manager123');
  const lines = await rows('report_lines');
  assert.equal(lines.length, 2);
  for (const l of lines) assert.equal('percentage' in l, false, 'report_lines must not carry their own copy of progress');

  const acts = (await rows('task_activities')).filter((a) => a.kind === 'report');
  assert.equal(acts.length, 2);
  assert.ok(acts.every((a) => lines.some((l) => l.id === a.report_line_id) && a.project_task_id));
  const first = acts.find((a) => a.new_percent === 60)!;
  assert.equal(first.activity_date, workDate);
  assert.equal(first.previous_percent, 0);

  const batches = await rows('report_batches');
  const shown = batches.flatMap((b) => b.report_lines);
  assert.deepEqual(shown.map((l) => [l.previous_percentage, l.percentage, l.flag]).sort(), [[0, 60, 'none'], [60, 40, 'regressed']].sort());
  assert.ok(batches.some((b) => b.work_date === workDate));
  assert.ok(batches.some((b) => b.work_date === todayLocalYMD()));
});

test('reports are readable by manager (all), team leader (own team + own), employee (own only)', async () => {
  await login('employee', 'employee123');
  await api.rpc('submit_report', { p_groups: [group([line(ctx.employees[1].department, 't1', 10)])] });
  await login('leader', 'leader123');
  await api.rpc('submit_report', { p_groups: [group([line(ctx.employees[0].department, 't2', 10)])] });
  await login('manager', 'manager123');
  await api.rpc('submit_report', { p_groups: [group([line('d', 't3', 10)])], p_on_behalf_of: ctx.employees[2].id });

  const namesFor = async (u: string, p: string) => { await login(u, p); return (await rows('report_batches')).map((b) => b.employee_name).sort(); };
  const [e0, e1, e2] = ctx.employees.map((e) => e.name);
  assert.deepEqual(await namesFor('manager', 'manager123'), [e0, e1, e2].sort());
  assert.deepEqual(await namesFor('leader', 'leader123'), [e0, e1].sort()); // own + team member, not the unrelated employee
  assert.deepEqual(await namesFor('employee', 'employee123'), [e1]);
});

test('identity data: employee reads only their own profile (no password); manager-only endpoint stays manager-only', async () => {
  await login('employee', 'employee123');
  const profiles = await rows('profiles');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].employee_id, ctx.employees[1].id);
  assert.equal('password' in profiles[0], false);
  const list = await api.functions.invoke('manage-user', { body: { action: 'list' } });
  assert.match(list.data.error, /Manager access required/);
  await login('manager', 'manager123');
  assert.ok((await rows('profiles')).length >= 3);
});

test('projects are stamped with their creator', async () => {
  await login('leader', 'leader123');
  const { data } = await api.from('projects').insert({ name: 'Leader project', status: 'draft' }).select().single();
  assert.equal(data.created_by, ctx.users.leader.id);
});

test('manager override is audited in the task history and needs a reason', async () => {
  const task = (await (async () => { await login('manager', 'manager123'); return rows('project_tasks'); })())[0];
  assert.match((await api.rpc('override_task_completion', { p_task_id: task.id, p_percent: 50, p_reason: '  ' })).error.message, /reason/i);
  assert.equal((await api.rpc('override_task_completion', { p_task_id: task.id, p_percent: 50, p_reason: 'Verified on site' })).error, null);
  const act = (await rows('task_activities')).find((a) => a.kind === 'override')!;
  assert.deepEqual([act.previous_percent, act.new_percent, act.reason, act.recorded_by], [0, 50, 'Verified on site', ctx.users.manager.id]);
  assert.equal((await rows('project_tasks')).find((t) => t.id === task.id).completion_percent, 50);

  await login('employee', 'employee123');
  assert.match((await api.rpc('override_task_completion', { p_task_id: task.id, p_percent: 90, p_reason: 'x' })).error.message, /Manager access/);
});
