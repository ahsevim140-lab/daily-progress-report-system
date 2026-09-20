// ---------------------------------------------------------------------------
// Offline mock of the tiny slice of the supabase-js client this app uses.
// No network calls at all — everything lives in memory and is mirrored to
// localStorage so data survives a page refresh during a local test session.
//
// This file is only ever imported by src/lib/supabase.ts, and only when
// offline mode is active (see the flag there). It intentionally mimics the
// shape of supabase-js responses ({ data, error }) so nothing else in the
// app (supabaseService.ts, components) needs to change.
//
// In offline mode THIS FILE IS THE DATABASE. The business rules that a real
// backend must enforce (who is reporting, which project/building/task is
// allowed, who may read what) therefore live here, not in the UI. The UI
// hides options; this file decides what is actually permitted.
// ---------------------------------------------------------------------------

import { acceptsProgress, deriveFlag, todayLocalYMD, toLocalYMD } from '../utils';

const STORAGE_KEY = 'dprs_mock_db_v1';
const SESSION_KEY = 'dprs_mock_session_v1';

type Row = Record<string, any>;

interface MockDB {
  departments: Row[];
  employees: Row[];
  projects: Row[];
  project_assignments: Row[];
  buildings: Row[];
  areas: Row[];
  task_categories: Row[];
  project_tasks: Row[];
  task_activities: Row[];
  attendance: Row[];
  report_batches: Row[];
  report_lines: Row[];
  login_audits: Row[];
  users: Row[]; // combines auth + profile + app-user fields
}

function uid() {
  return (crypto as any).randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function usernameFromEmail(email: string) {
  return email.replace(/@dprs\.local$/i, '');
}

function seedDB(): MockDB {
  const now = new Date().toISOString();

  const departments = ['الهيكل الإنشائي', 'الكهروميكانيك', 'التشطيبات'];

  const employees: Row[] = [
    { id: uid(), name: 'أحمد سالم', department: departments[0] },
    { id: uid(), name: 'محمد علي', department: departments[1] },
    { id: uid(), name: 'خالد يوسف', department: departments[2] },
  ];

  const project1 = { id: uid(), name: 'مشروع الأبراج السكنية', status: 'running', created_by: null };
  const projects: Row[] = [project1];
  const project_assignments: Row[] = [
    { id: uid(), project_id: project1.id, employee_id: employees[0]?.id },
    { id: uid(), project_id: project1.id, employee_id: employees[1]?.id },
  ];

  const building1 = { id: uid(), project_id: project1.id, name: 'المبنى A', weight_percent: 50 };
  const building2 = { id: uid(), project_id: project1.id, name: 'المبنى B', weight_percent: 50 };
  const buildings: Row[] = [building1, building2];
  const areas: Row[] = [
    { id: uid(), building_id: building1.id, name: 'الطابق الأرضي' },
    { id: uid(), building_id: building1.id, name: 'الطابق الأول' },
  ];

  const task_categories: Row[] = [
    { id: uid(), main: 'أعمال الحفر', department: departments[0], subs: ['حفر أساسات', 'ردم'] },
    { id: uid(), main: 'أعمال الخرسانة', department: departments[1], subs: ['صب أعمدة', 'صب أسقف'] },
    { id: uid(), main: 'اجتماع', is_general: true, subs: ['اجتماع تنسيقي'] },
  ];

  const project_tasks: Row[] = [];
  for (const b of buildings) {
    const even = Math.round((100 / departments.length) * 100) / 100;
    departments.forEach((department, idx) => {
      project_tasks.push({
        id: uid(),
        project_id: project1.id,
        building_id: b.id,
        department,
        task: '',
        priority: 'normal',
        status: 'not_started',
        weight_percent:
          idx === departments.length - 1 ? Math.round((100 - even * (departments.length - 1)) * 100) / 100 : even,
        completion_percent: 0,
        updated_at: now,
      });
    });
  }

  const users: Row[] = [
    {
      id: uid(),
      username: 'manager',
      password: 'manager123',
      display_name: 'مدير المشروع',
      role: 'manager',
      active: true,
      employee_id: null,
      team_leader_id: null,
      created_at: now,
    },
    {
      id: uid(),
      username: 'leader',
      password: 'leader123',
      display_name: 'قائد الفريق',
      role: 'team_leader',
      active: true,
      employee_id: employees[0].id,
      team_leader_id: null,
      created_at: now,
    },
  ];
  users.push({
    id: uid(),
    username: 'employee',
    password: 'employee123',
    display_name: employees[1].name,
    role: 'employee',
    active: true,
    employee_id: employees[1].id,
    team_leader_id: users[1].id,
    created_at: now,
  });

  return {
    departments: departments.map((name) => ({ id: uid(), name })),
    employees,
    projects,
    project_assignments,
    buildings,
    areas,
    task_categories,
    project_tasks,
    task_activities: [],
    attendance: [],
    report_batches: [],
    report_lines: [],
    login_audits: [],
    users,
  };
}

function loadDB(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw) as MockDB;
      loaded.attendance ||= [];
      loaded.project_assignments ||= [];
      loaded.areas = (loaded.areas || []).map((area) => ({ area_m2: 0, ...area }));
      loaded.task_activities ||= [];
      loaded.report_batches ||= [];
      loaded.report_lines ||= [];
      loaded.login_audits ||= [];
      loaded.projects = (loaded.projects || []).map((p) => ({ status: 'running', ...p }));
      loaded.buildings = (loaded.buildings || []).map((b) => ({ weight_percent: 0, ...b }));
      loaded.project_tasks = (loaded.project_tasks || []).map((t) => ({ task: '', priority: 'normal', status: 'not_started', ...t }));
      return loaded;
    }
  } catch {
    // fall through to reseed
  }
  const fresh = seedDB();
  saveDB(fresh);
  return fresh;
}

function saveDB(db: MockDB) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors in mock mode
  }
}

function recalculateBuildingWeights(projectId: string) {
  const projectBuildings = db.buildings.filter((building) => building.project_id === projectId);
  const totalArea = projectBuildings.reduce((sum, building) => sum + db.areas.filter((area) => area.building_id === building.id).reduce((areaSum, area) => areaSum + Number(area.area_m2 || 0), 0), 0);
  projectBuildings.forEach((building) => {
    const area = db.areas.filter((item) => item.building_id === building.id).reduce((sum, item) => sum + Number(item.area_m2 || 0), 0);
    building.weight_percent = totalArea > 0 ? Math.round((area / totalArea) * 10000) / 100 : 0;
  });
}

let db = loadDB();

function loadSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: { userId: string } | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

let session = loadSession();

// The authenticated caller, resolved from the session only (the equivalent of auth.uid()).
function currentUser(): Row | null {
  if (!session) return null;
  const user = db.users.find((u) => u.id === session!.userId);
  return user && user.active !== false ? user : null;
}

// Thrown inside an rpc to abort it; the whole call is rolled back.
class RpcError extends Error {}

function statusForPercent(pct: number, current?: string) {
  return pct >= 100 ? 'completed' : pct > 0 ? 'in_progress' : current || 'not_started';
}

// Resolve which employee a stored report batch belongs to (older batches only stored the name).
function batchEmployeeId(batch: Row): string | null {
  return batch.employee_id ?? db.employees.find((e) => e.name === batch.employee_name)?.id ?? null;
}

// Read scope for report batches — what a row-level-security policy would express:
// manager: everything; team leader: own team + own projects + own reports; employee: own reports.
function canReadBatch(user: Row, batch: Row): boolean {
  if (user.role === 'manager') return true;
  const employeeId = batchEmployeeId(batch);
  if (employeeId && employeeId === user.employee_id) return true;
  if (user.role === 'team_leader') {
    const inTeam = db.users.some((u) => u.employee_id === employeeId && u.team_leader_id === user.id);
    const ownProject = db.projects.some((p) => p.id === batch.project_id && p.created_by === user.id);
    return inTeam || ownProject;
  }
  return false;
}

// Reset helper exposed on window so it's easy to get back to a clean slate
// while testing, without digging through devtools.
(window as any).__resetOfflineData = () => {
  db = seedDB();
  saveDB(db);
  session = null;
  saveSession(null);
  location.reload();
};

// ---------------------------------------------------------------------------
// Query builder: supports exactly the chains supabaseService.ts uses.
// ---------------------------------------------------------------------------
class MockQueryBuilder {
  private table: keyof MockDB;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private eqFilters: { col: string; val: any }[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private wantsSingle = false;
  private wantsSelectAfterWrite = false;

  constructor(table: keyof MockDB) {
    this.table = table;
  }

  select(_cols?: string) {
    if (this.op === 'insert' || this.op === 'update') {
      this.wantsSelectAfterWrite = true;
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }

  eq(col: string, val: any) {
    this.eqFilters.push({ col, val });
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private matches(row: Row) {
    return this.eqFilters.every((f) => row[f.col] === f.val);
  }

  private execute(): { data: any; error: any } {
    // profiles reads are served from the users table
    const sourceTable: keyof MockDB = (this.table as string) === 'profiles' ? 'users' : this.table;

    if (this.op === 'select') {
      // Special-cased join for the reports list screen.
      // Lines carry no percentages of their own: previous/new/flag come from the linked
      // task activity, so there is exactly one record of what happened.
      if (this.table === 'report_batches') {
        const user = currentUser();
        let rows = db.report_batches
          .filter((batch) => user && canReadBatch(user, batch))
          .map((batch) => ({
            id: batch.id,
            employee_id: batchEmployeeId(batch),
            employee_name: batch.employee_name,
            submitted_by: batch.submitted_by ?? null,
            project_id: batch.project_id,
            building_id: batch.building_id,
            work_date: batch.work_date ?? toLocalYMD(batch.created_at),
            created_at: batch.created_at,
            projects: db.projects.find((p) => p.id === batch.project_id) ? { name: db.projects.find((p) => p.id === batch.project_id)!.name } : null,
            buildings: db.buildings.find((b) => b.id === batch.building_id) ? { name: db.buildings.find((b) => b.id === batch.building_id)!.name } : null,
            report_lines: db.report_lines
              .filter((l) => l.batch_id === batch.id)
              .map((l) => {
                const activity = db.task_activities.find((a) => a.report_line_id === l.id);
                // Fallback: lines saved by an older build stored their own percentages.
                const previous = activity ? activity.previous_percent : l.previous_percentage ?? 0;
                const current = activity ? activity.new_percent : l.percentage ?? 0;
                return { id: l.id, batch_id: l.batch_id, department: l.department, task: l.task, project_task_id: l.project_task_id ?? null, note: l.note ?? null, previous_percentage: previous, percentage: current, flag: activity ? deriveFlag(previous, current) : l.flag ?? 'none' };
              }),
          }));
        if (this.orderBy) {
          rows = rows.sort((a: any, b: any) => {
            const av = a[this.orderBy!.col];
            const bv = b[this.orderBy!.col];
            return this.orderBy!.ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
          });
        }
        return { data: rows, error: null };
      }

      let rows = (db[sourceTable] as Row[]).filter((r) => this.matches(r));
      if ((this.table as string) === 'profiles') {
        const user = currentUser();
        rows = rows
          .filter((r) => !!user && (user.role === 'manager' || r.id === user.id))
          .map(({ password, ...rest }) => rest);
      }
      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => (ascending ? (a[col] > b[col] ? 1 : -1) : a[col] < b[col] ? 1 : -1));
      }
      if (this.wantsSingle) {
        const row = rows[0] ?? null;
        return { data: row, error: row ? null : { message: 'No rows found' } };
      }
      return { data: rows, error: null };
    }

    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((item) => ({
        id: uid(),
        ...item,
      }));
      if (this.table === 'projects') items.forEach((item) => { item.created_by ??= currentUser()?.id ?? null; });
      (db[sourceTable] as Row[]).push(...items);
      if (this.table === 'areas') items.forEach((item) => { const building = db.buildings.find((row) => row.id === item.building_id); if (building) recalculateBuildingWeights(building.project_id); });
      saveDB(db);
      if (this.wantsSelectAfterWrite) {
        return { data: this.wantsSingle ? items[0] : items, error: null };
      }
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      const rows = (db[sourceTable] as Row[]).filter((r) => this.matches(r));
      rows.forEach((r) => Object.assign(r, this.payload));
      if (this.table === 'areas') rows.forEach((item) => { const building = db.buildings.find((row) => row.id === item.building_id); if (building) recalculateBuildingWeights(building.project_id); });
      saveDB(db);
      return { data: this.wantsSelectAfterWrite ? (this.wantsSingle ? rows[0] ?? null : rows) : null, error: null };
    }

    if (this.op === 'delete') {
      const removed = (db[sourceTable] as Row[]).filter((r) => this.matches(r));
      const kept = (db[sourceTable] as Row[]).filter((r) => !this.matches(r));
      const removedCount = (db[sourceTable] as Row[]).length - kept.length;
      (db as any)[sourceTable] = kept;
      if (this.table === 'areas') removed.forEach((item) => { const building = db.buildings.find((row) => row.id === item.building_id); if (building) recalculateBuildingWeights(building.project_id); });
      // keep report_lines in sync if a batch is ever deleted (not currently exposed in UI, but safe)
      saveDB(db);
      return { data: null, error: removedCount >= 0 ? null : { message: 'Nothing deleted' } };
    }

    return { data: null, error: { message: 'Unsupported mock operation' } };
  }

  // Makes the builder awaitable, like the real supabase-js PostgrestFilterBuilder.
  then(onFulfilled: any, onRejected?: any) {
    try {
      const result = this.execute();
      return Promise.resolve(result).then(onFulfilled, onRejected);
    } catch (err) {
      return Promise.resolve({ data: null, error: { message: (err as Error).message } }).then(onFulfilled, onRejected);
    }
  }
}

function findUserByUsername(username: string) {
  return db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

// ---------------------------------------------------------------------------
// RPC: submit_report
//   params: p_groups, p_work_date (optional, defaults to today), p_on_behalf_of (manager only)
// The reporting employee is NEVER taken from the request: it is the employee linked to the
// signed-in account, unless a manager explicitly reports on someone's behalf.
// ---------------------------------------------------------------------------
type ReportLineInput = { department: string; task: string; percentage: number; note?: string | null };
type ReportGroupInput = { project_id: string; building_id: string; lines: ReportLineInput[] };

function rpcSubmitReport(params: Record<string, any>): string[] {
  const caller = currentUser();
  if (!caller) throw new RpcError('Not signed in.');

  let employee: Row | undefined;
  if (params.p_on_behalf_of) {
    if (caller.role !== 'manager') throw new RpcError('Only a manager can submit a report on behalf of another employee.');
    employee = db.employees.find((e) => e.id === params.p_on_behalf_of);
    if (!employee) throw new RpcError('Employee not found.');
  } else {
    employee = caller.employee_id ? db.employees.find((e) => e.id === caller.employee_id) : undefined;
    if (!employee) throw new RpcError('Your account is not linked to an employee record. Ask a manager to link it.');
  }

  const workDate: string = params.p_work_date || todayLocalYMD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || Number.isNaN(new Date(workDate).getTime())) throw new RpcError('Invalid work date.');
  if (workDate !== todayLocalYMD()) throw new RpcError('Reports can only be submitted for today.');

  const groups = params.p_groups as ReportGroupInput[] | undefined;
  if (!Array.isArray(groups) || groups.length === 0) throw new RpcError('Report must include at least one project/building group');

  const now = new Date().toISOString();
  const batchIds: string[] = [];

  for (const group of groups) {
    const project = db.projects.find((p) => p.id === group.project_id);
    if (!project) throw new RpcError('Project not found.');
    if (!acceptsProgress(project.status)) throw new RpcError(`Project "${project.name}" is ${project.status} and no longer accepts progress reports.`);
    if (caller.role !== 'manager' && !db.project_assignments.some((a) => a.project_id === project.id && a.employee_id === employee!.id)) throw new RpcError(`You are not assigned to project "${project.name}".`);
    const building = db.buildings.find((b) => b.id === group.building_id);
    if (!building || building.project_id !== project.id) throw new RpcError('The selected building does not belong to the selected project.');
    if (!Array.isArray(group.lines) || group.lines.length === 0) throw new RpcError('Each project/building group requires at least one task');

    const batchId = uid();
    db.report_batches.push({ id: batchId, employee_id: employee.id, employee_name: employee.name, submitted_by: caller.id, project_id: project.id, building_id: building.id, work_date: workDate, created_at: now });
    batchIds.push(batchId);

    for (const line of group.lines) {
      if (!line.department || !line.task) throw new RpcError('Each task line needs a department and a task.');
      if (caller.role !== 'manager' && line.department !== employee.department) throw new RpcError('Employees may only report tasks from their own department.');
      const percentage = Number(line.percentage);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new RpcError('Percentage must be a number between 0 and 100.');
      const note = (line.note ?? '').trim() || null;

      // Prefer the exact task row; fall back to the department-level placeholder row (task '').
      const inBuilding = (t: Row) => t.project_id === project.id && t.building_id === building.id && t.department === line.department;
      let task = db.project_tasks.find((t) => inBuilding(t) && t.task === line.task) ?? db.project_tasks.find((t) => inBuilding(t) && !t.task);

      if (task?.assigned_employee_id && task.assigned_employee_id !== employee.id) throw new RpcError(`"${task.task || task.department}" is assigned to another employee.`);
      if (task?.status === 'cancelled') throw new RpcError(`"${task.task || task.department}" is cancelled and cannot receive progress.`);

      const previous = task ? task.completion_percent ?? 0 : 0;
      if (deriveFlag(previous, percentage) !== 'none' && !note) throw new RpcError('A reason is required when progress is unchanged or reduced.');

      if (!task) {
        task = { id: uid(), project_id: project.id, building_id: building.id, department: line.department, task: line.task, weight_percent: 0, completion_percent: 0, priority: 'normal', status: 'not_started', updated_at: now };
        db.project_tasks.push(task);
      }

      const lineId = uid();
      // The line records what was reported; the activity below is the single history record of the change.
      db.report_lines.push({ id: lineId, batch_id: batchId, department: line.department, task: line.task, project_task_id: task.id, note });
      db.task_activities.push({
        id: uid(), kind: 'report', report_line_id: lineId, project_task_id: task.id,
        employee_id: employee.id, employee_name: employee.name, recorded_by: caller.id,
        activity_date: workDate, description: note || 'Daily progress update', previous_percent: previous, new_percent: percentage,
        hours_worked: null, blocker: null, note, created_at: now,
      });
      task.completion_percent = percentage;
      task.status = statusForPercent(percentage, task.status);
      task.updated_at = now;
    }
  }
  return batchIds;
}

// ---------------------------------------------------------------------------
// RPC: override_task_completion (manager only)
// A manager correcting progress is an event in the task's history, with a mandatory reason.
// ---------------------------------------------------------------------------
function rpcOverrideTaskCompletion(params: Record<string, any>): null {
  const caller = currentUser();
  if (!caller || caller.role !== 'manager') throw new RpcError('Manager access required.');
  const reason = String(params.p_reason ?? '').trim();
  if (!reason) throw new RpcError('A reason is required to override progress.');
  const percentage = Number(params.p_percent);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new RpcError('Percentage must be a number between 0 and 100.');
  const task = db.project_tasks.find((t) => t.id === params.p_task_id);
  if (!task) throw new RpcError('Task not found.');
  const previous = task.completion_percent ?? 0;
  if (previous === percentage) throw new RpcError('The new percentage is the same as the current one.');

  const now = new Date().toISOString();
  db.task_activities.push({
    id: uid(), kind: 'override', report_line_id: null, project_task_id: task.id,
    employee_id: null, employee_name: caller.display_name, recorded_by: caller.id,
    activity_date: todayLocalYMD(), description: `Manager override: ${reason}`, reason,
    previous_percent: previous, new_percent: percentage, created_at: now,
  });
  task.completion_percent = percentage;
  task.status = statusForPercent(percentage, task.status);
  task.updated_at = now;
  return null;
}

export const mockSupabase = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const username = usernameFromEmail(email);
      const user = findUserByUsername(username);
      if (!user || user.password !== password || user.active === false) {
        return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } };
      }
      session = { userId: user.id };
      saveSession(session);
      db.login_audits.push({ id: uid(), user_id: user.id, username: user.username, display_name: user.display_name, role: user.role, employee_id: user.employee_id || null, logged_in_at: new Date().toISOString() });
      saveDB(db);
      return { data: { session: { user: { id: user.id } }, user: { id: user.id } }, error: null };
    },
    async signOut() {
      session = null;
      saveSession(null);
      return { error: null };
    },
    async getSession() {
      return { data: { session: session ? { user: { id: session.userId } } : null } };
    },
  },

  from(table: string) {
    return new MockQueryBuilder(table as keyof MockDB);
  },

  async rpc(fnName: string, params: Record<string, any>) {
    const handlers: Record<string, (p: Record<string, any>) => any> = {
      submit_report: rpcSubmitReport,
      override_task_completion: rpcOverrideTaskCompletion,
    };
    const handler = handlers[fnName];
    if (!handler) return { data: null, error: { message: `Unknown mock rpc: ${fnName}` } };

    // Every rpc is all-or-nothing: on any failure the database is restored to how it was.
    const snapshot = structuredClone(db);
    try {
      const data = handler(params);
      saveDB(db);
      return { data, error: null };
    } catch (err) {
      db = snapshot;
      if (err instanceof RpcError) return { data: null, error: { message: err.message } };
      throw err;
    }
  },

  functions: {
    async invoke(fnName: string, { body }: { body: Record<string, any> }) {
      if (fnName !== 'manage-user') {
        return { data: null, error: { message: `Unknown mock function: ${fnName}` } };
      }
      // Same gate as supabase/functions/manage-user: managers only.
      const caller = currentUser();
      if (!caller || caller.role !== 'manager') {
        return { data: { error: 'Manager access required.' }, error: null };
      }
      const { action } = body;

      if (action === 'list') {
        const users = db.users.map(({ password, ...rest }) => rest);
        return { data: { users }, error: null };
      }

      if (action === 'create') {
        const { username, password, display_name, role, employee_id, team_leader_id } = body;
        if (findUserByUsername(username)) {
          return { data: { error: 'اسم المستخدم مستخدم بالفعل.' }, error: null };
        }
        db.users.push({
          id: uid(),
          username: String(username).toLowerCase(),
          password,
          display_name,
          role,
          active: true,
          employee_id: employee_id || null,
          team_leader_id: team_leader_id || null,
          created_at: new Date().toISOString(),
        });
        saveDB(db);
        return { data: { ok: true }, error: null };
      }

      if (action === 'update') {
        const { id, password, ...changes } = body;
        const user = db.users.find((u) => u.id === id);
        if (!user) return { data: { error: 'المستخدم غير موجود.' }, error: null };
        Object.assign(user, changes);
        if (password) user.password = password;
        saveDB(db);
        return { data: { ok: true }, error: null };
      }

      if (action === 'delete') {
        const { id } = body;
        if (!id || id === caller.id) return { data: { error: 'You cannot delete your own account.' }, error: null };
        db.users = db.users.filter((u) => u.id !== id);
        saveDB(db);
        return { data: { ok: true }, error: null };
      }

      return { data: { error: `Unknown action: ${action}` }, error: null };
    },
  },
};
