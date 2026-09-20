import { supabase } from '../lib/supabase';
import {
  AttendanceRecord,
  AttendanceStatus,
  BackendData,
  Building,
  Area,
  TaskActivity,
  Department,
  DraftProjectGroup,
  Employee,
  Profile,
  Project,
  ProjectAssignment,
  ProjectStatus,
  ProjectTask,
  ReportBatch,
  ReportLine,
  Role,
  TaskCategory,
} from '../types';

function usernameEmail(username: string) { return `${username.trim().toLowerCase()}@dprs.local`; }

export async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
  if (error) throw error;
  return data;
}

export interface AppUser { id: string; username: string; display_name: string; role: Role; active: boolean; employee_id: string | null; team_leader_id: string | null; created_at: string; }
export async function manageUsers(action: 'list' | 'create' | 'update' | 'delete', payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('manage-user', { body: { action, ...payload } });
  if (error) throw error; if (data?.error) throw new Error(data.error); return data as { users?: AppUser[]; ok?: boolean };
}
export async function signOut() { await supabase.auth.signOut(); }
// The signed-in account, including the employee record it is linked to.
// Identity comes from the session, not from anything the user types or selects.
// Returns null when signed out or when the account is deactivated.
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: sessionData } = await supabase.auth.getSession(); const user = sessionData.session?.user; if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('id, username, display_name, role, active, employee_id, team_leader_id').eq('id', user.id).single();
  if (error || !data || data.active === false) return null;
  return { id: data.id, username: data.username, display_name: data.display_name, role: data.role as Role, active: true, employee_id: data.employee_id ?? null, team_leader_id: data.team_leader_id ?? null };
}

export async function fetchBackendData(): Promise<BackendData> {
  const [deptRes, empRes, projRes, assignmentRes, buildRes, areaRes, taskRes, ptRes, activityRes, attendanceRes] = await Promise.all([
    supabase.from('departments').select('*').order('name'),
    supabase.from('employees').select('*').order('name'),
    supabase.from('projects').select('*').order('name'),
    supabase.from('project_assignments').select('*'),
    supabase.from('buildings').select('*').order('name'),
    supabase.from('areas').select('*').order('name'),
    supabase.from('task_categories').select('*'),
    supabase.from('project_tasks').select('*'),
    supabase.from('task_activities').select('*').order('activity_date', { ascending: false }),
    supabase.from('attendance').select('*').order('attendance_date', { ascending: false }),
  ]);
  const firstError = [deptRes, empRes, projRes, assignmentRes, buildRes, areaRes, taskRes, ptRes, activityRes, attendanceRes].find((r) => r.error)?.error;
  if (firstError) throw firstError;
  const departments = (deptRes.data || []) as Department[];
  const employees = (empRes.data || []) as Employee[];
  const attendance = (attendanceRes.data || []).map((row: any) => ({
    ...row,
    employee_name: employees.find((e) => e.id === row.employee_id)?.name,
    department: employees.find((e) => e.id === row.employee_id)?.department,
  })) as AttendanceRecord[];
  return {
    departments: departments.map((d) => d.name), departmentRows: departments, employees,
    projects: (projRes.data || []).map((p: any) => ({ status: 'running', ...p })) as Project[],
    projectAssignments: (assignmentRes.data || []) as ProjectAssignment[],
    buildings: (buildRes.data || []).map((b: any) => ({ weight_percent: 0, ...b })) as Building[], areas: (areaRes.data || []) as Area[], taskCategories: (taskRes.data || []) as TaskCategory[],
    projectTasks: (ptRes.data || []).map((t: any) => ({ task: t.task || '', priority: 'normal', status: 'not_started', assigned_employee_name: employees.find((e) => e.id === t.assigned_employee_id)?.name, ...t })) as ProjectTask[],
    activities: (activityRes.data || []) as TaskActivity[], attendance,
  };
}

export async function addDepartment(name: string) { const { error } = await supabase.from('departments').insert({ name, active: true }); if (error) throw error; }
export async function updateDepartment(id: string, name: string) { const { error } = await supabase.from('departments').update({ name }).eq('id', id); if (error) throw error; }
export async function deleteDepartment(id: string) { const { error } = await supabase.from('departments').delete().eq('id', id); if (error) throw error; }
export async function addEmployee(name: string, department: string) { const { error } = await supabase.from('employees').insert({ name, department }); if (error) throw error; }
export async function deleteEmployee(id: string) { const { error } = await supabase.from('employees').delete().eq('id', id); if (error) throw error; }
export async function addProject(name: string, status: ProjectStatus = 'running') { const { error } = await supabase.from('projects').insert({ name, status }); if (error) throw error; }
export async function updateProject(id: string, changes: { name?: string; status?: ProjectStatus; description?: string; start_date?: string | null; target_date?: string | null }) { const { error } = await supabase.from('projects').update(changes).eq('id', id); if (error) throw error; }
export async function deleteProject(id: string) { const { error } = await supabase.from('projects').delete().eq('id', id); if (error) throw error; }
export async function assignEmployeeToProject(projectId: string, employeeId: string) { const { error } = await supabase.from('project_assignments').insert({ project_id: projectId, employee_id: employeeId }); if (error) throw error; }
export async function removeEmployeeFromProject(projectId: string, employeeId: string) { const { error } = await supabase.from('project_assignments').delete().eq('project_id', projectId).eq('employee_id', employeeId); if (error) throw error; }
export async function addBuilding(projectId: string, name: string, _departments: string[] = []) {
  const { data, error } = await supabase.from('buildings').insert({ project_id: projectId, name, weight_percent: 0 }).select().single(); if (error) throw error;
  return data as Building;
}
export async function updateBuilding(id: string, name: string) { const { error } = await supabase.from('buildings').update({ name }).eq('id', id); if (error) throw error; }
export async function updateBuildingWeight(id: string, weightPercent: number) { const { error } = await supabase.from('buildings').update({ weight_percent: weightPercent }).eq('id', id); if (error) throw error; }
export async function deleteBuilding(id: string) { const { error } = await supabase.from('buildings').delete().eq('id', id); if (error) throw error; }
export async function addArea(buildingId: string, name: string) { const { error } = await supabase.from('areas').insert({ building_id: buildingId, name }); if (error) throw error; }
export async function updateArea(id: string, name: string) { const { error } = await supabase.from('areas').update({ name }).eq('id', id); if (error) throw error; }
export async function deleteArea(id: string) { const { error } = await supabase.from('areas').delete().eq('id', id); if (error) throw error; }
export async function addTaskSub(main: string, sub: string, existing: TaskCategory[]) { const match = existing.find((c) => c.main === main); const result = match ? supabase.from('task_categories').update({ subs: [...(match.subs.includes(sub) ? match.subs : [...match.subs, sub])] }).eq('id', match.id) : supabase.from('task_categories').insert({ main, subs: [sub] }); const { error } = await result; if (error) throw error; }
export async function deleteTaskSub(category: TaskCategory, sub: string) { const newSubs = category.subs.filter((s) => s !== sub); const { error } = newSubs.length ? await supabase.from('task_categories').update({ subs: newSubs }).eq('id', category.id) : await supabase.from('task_categories').delete().eq('id', category.id); if (error) throw error; }
export async function setTaskCategoryDepartment(id: string, department: string | null) { const { error } = await supabase.from('task_categories').update({ department: department || null }).eq('id', id); if (error) throw error; }
export async function setProjectTaskWeight(id: string, weightPercent: number) { const { error } = await supabase.from('project_tasks').update({ weight_percent: weightPercent }).eq('id', id); if (error) throw error; }
export async function setProjectTaskSelection(id: string, changes: { department: string; task: string; category?: string | null; weight_percent: number }) { const { error } = await supabase.from('project_tasks').update(changes).eq('id', id); if (error) throw error; }
export async function updateProjectTaskDetails(id: string, changes: Partial<ProjectTask>) { const { error } = await supabase.from('project_tasks').update(changes).eq('id', id); if (error) throw error; }
export async function addProjectTask(row: Omit<ProjectTask, 'id'>) { const { error } = await supabase.from('project_tasks').insert(row); if (error) throw error; }
export async function deleteProjectTask(id: string) { const { error } = await supabase.from('project_tasks').delete().eq('id', id); if (error) throw error; }
// Manager correction of a task's progress. Recorded in the task's history with a mandatory reason.
export async function overrideTaskCompletion(id: string, completionPercent: number, reason: string) { const { error } = await supabase.rpc('override_task_completion', { p_task_id: id, p_percent: completionPercent, p_reason: reason }); if (error) throw error; }

export async function upsertAttendance(record: Omit<AttendanceRecord, 'id' | 'created_at' | 'updated_at'>) {
  const { data: existing } = await supabase.from('attendance').select('id').eq('employee_id', record.employee_id).eq('attendance_date', record.attendance_date).single();
  const payload = { ...record, updated_at: new Date().toISOString() };
  const result = existing?.id ? await supabase.from('attendance').update(payload).eq('id', existing.id) : await supabase.from('attendance').insert(payload);
  if (result.error) throw result.error;
}

// One report = several project groups, each with several buildings, each with several task lines.
// Submitted as a single atomic call so a mid-submit failure can't leave a partial report saved.
// Who is reporting is decided by the backend from the signed-in account; the only override is
// onBehalfOfEmployeeId, which the backend accepts from managers only.
export async function submitReport(projectGroups: DraftProjectGroup[], options: { workDate: string; department: string; onBehalfOfEmployeeId?: string | null }) {
  const groups = projectGroups.flatMap((pg) =>
    pg.buildings.map((bg) => ({
      project_id: pg.projectId,
      building_id: bg.buildingId,
      lines: bg.lines.map((l) => ({
        department: options.department,
        task: l.task,
        percentage: Number(l.percentage),
        note: l.note.trim() || null,
      })),
    }))
  );
  const { data, error } = await supabase.rpc('submit_report', { p_groups: groups, p_work_date: options.workDate, p_on_behalf_of: options.onBehalfOfEmployeeId || null });
  if (error) throw error;
  return data as string[];
}
export async function fetchReportBatches(): Promise<ReportBatch[]> {
  const { data, error } = await supabase.from('report_batches').select(`id, employee_id, employee_name, submitted_by, project_id, building_id, work_date, created_at, projects ( name ), buildings ( name ), report_lines ( id, batch_id, department, task, project_task_id, percentage, previous_percentage, flag, note )`).order('created_at', { ascending: false }); if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, employee_id: row.employee_id ?? null, employee_name: row.employee_name, submitted_by: row.submitted_by ?? null, project_id: row.project_id, building_id: row.building_id, work_date: row.work_date, created_at: row.created_at, project_name: row.projects?.name, building_name: row.buildings?.name, lines: (row.report_lines || []) as ReportLine[] }));
}
