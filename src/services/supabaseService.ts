import { supabase } from '../lib/supabase';
import {
  BackendData,
  Building,
  DraftReportLine,
  Employee,
  Project,
  ProjectTask,
  ReportBatch,
  ReportLine,
  Role,
  TaskCategory,
} from '../types';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function usernameEmail(username: string) {
  return `${username.trim().toLowerCase()}@dprs.local`;
}

export async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  active: boolean;
  employee_id: string | null;
  team_leader_id: string | null;
  created_at: string;
}

export async function manageUsers(action: 'list' | 'create' | 'update' | 'delete', payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { users?: AppUser[]; ok?: boolean };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentRole(): Promise<Role | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('role, active').eq('id', user.id).single();
  if (error || !data || data.active === false) return null;
  return data.role as Role;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Setup / config data (departments, employees, projects, buildings, tasks)
// ---------------------------------------------------------------------------
export async function fetchBackendData(): Promise<BackendData> {
  const [deptRes, empRes, projRes, buildRes, taskRes, ptRes] = await Promise.all([
    supabase.from('departments').select('*').order('name'),
    supabase.from('employees').select('*').order('name'),
    supabase.from('projects').select('*').order('name'),
    supabase.from('buildings').select('*').order('name'),
    supabase.from('task_categories').select('*'),
    supabase.from('project_tasks').select('*'),
  ]);

  const firstError = [deptRes, empRes, projRes, buildRes, taskRes, ptRes].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  return {
    departments: (deptRes.data || []).map((d: any) => d.name),
    employees: (empRes.data || []) as Employee[],
    projects: (projRes.data || []) as Project[],
    buildings: (buildRes.data || []) as Building[],
    taskCategories: (taskRes.data || []) as TaskCategory[],
    projectTasks: (ptRes.data || []) as ProjectTask[],
  };
}

export async function addDepartment(name: string) {
  const { error } = await supabase.from('departments').insert({ name });
  if (error) throw error;
}

export async function deleteDepartment(id: string) {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw error;
}

export async function addEmployee(name: string, department: string) {
  const { error } = await supabase.from('employees').insert({ name, department });
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

export async function addProject(name: string) {
  const { error } = await supabase.from('projects').insert({ name });
  if (error) throw error;
}

export async function updateProject(id: string, name: string) {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// Adds a building and seeds an even default weight split across departments
// so the manager can immediately see (and edit) the progress breakdown.
export async function addBuilding(projectId: string, name: string, departments: string[]) {
  const { data, error } = await supabase
    .from('buildings')
    .insert({ project_id: projectId, name })
    .select()
    .single();
  if (error) throw error;

  if (departments.length > 0) {
    const evenWeight = Math.round((100 / departments.length) * 100) / 100;
    const rows = departments.map((department, idx) => ({
      project_id: projectId,
      building_id: data.id,
      department,
      // give the remainder to the last row so weights sum to exactly 100
      weight_percent: idx === departments.length - 1
        ? Math.round((100 - evenWeight * (departments.length - 1)) * 100) / 100
        : evenWeight,
      completion_percent: 0,
    }));
    const { error: ptError } = await supabase.from('project_tasks').insert(rows);
    if (ptError) throw ptError;
  }

  return data as Building;
}

export async function updateBuilding(id: string, name: string) {
  const { error } = await supabase.from('buildings').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteBuilding(id: string) {
  const { error } = await supabase.from('buildings').delete().eq('id', id);
  if (error) throw error;
}

export async function addTaskSub(main: string, sub: string, existing: TaskCategory[]) {
  const match = existing.find((c) => c.main === main);
  if (match) {
    if (match.subs.includes(sub)) return;
    const { error } = await supabase
      .from('task_categories')
      .update({ subs: [...match.subs, sub] })
      .eq('id', match.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('task_categories').insert({ main, subs: [sub] });
    if (error) throw error;
  }
}

export async function deleteTaskSub(category: TaskCategory, sub: string) {
  const newSubs = category.subs.filter((s) => s !== sub);
  if (newSubs.length === 0) {
    const { error } = await supabase.from('task_categories').delete().eq('id', category.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('task_categories').update({ subs: newSubs }).eq('id', category.id);
    if (error) throw error;
  }
}

// Manager-set weight override for one project+building+department row.
// Does NOT touch completion_percent (that only moves via submitted reports
// or the explicit override function below).
export async function setProjectTaskWeight(id: string, weightPercent: number) {
  const { error } = await supabase.from('project_tasks').update({ weight_percent: weightPercent }).eq('id', id);
  if (error) throw error;
}

// Manager manual override of a department's tracked completion for a
// building, independent of the report log (e.g. correcting a bad entry).
export async function overrideProjectTaskCompletion(id: string, completionPercent: number) {
  const { error } = await supabase
    .from('project_tasks')
    .update({ completion_percent: completionPercent, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function submitReportBatch(
  employeeName: string,
  projectId: string,
  buildingId: string,
  lines: DraftReportLine[]
) {
  const payload = lines.map((l) => ({
    department: l.department,
    task: l.task,
    percentage: Number(l.percentage),
    note: l.note.trim() || null,
  }));

  const { data, error } = await supabase.rpc('submit_report_batch', {
    p_employee_name: employeeName,
    p_project_id: projectId,
    p_building_id: buildingId,
    p_lines: payload,
  });

  if (error) throw error;
  return data as string; // new batch id
}

export async function fetchReportBatches(): Promise<ReportBatch[]> {
  const { data, error } = await supabase
    .from('report_batches')
    .select(
      `id, employee_name, project_id, building_id, created_at,
       projects ( name ), buildings ( name ),
       report_lines ( id, batch_id, department, task, percentage, previous_percentage, flag, note )`
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    employee_name: row.employee_name,
    project_id: row.project_id,
    building_id: row.building_id,
    created_at: row.created_at,
    project_name: row.projects?.name,
    building_name: row.buildings?.name,
    lines: (row.report_lines || []) as ReportLine[],
  }));
}
