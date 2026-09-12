export type Role = 'employee' | 'manager' | 'team_leader';

export interface Employee {
  id: string;
  department: string;
  name: string;
}

export interface TaskCategory {
  id: string;
  main: string;
  subs: string[];
}

export interface Project {
  id: string;
  name: string;
  created_by?: string | null;
}

export interface AttendanceRecord {
  id?: string;
  date: string;
  employee_id: string;
  arrival_time: string | null;
  note: string | null;
}

export interface Building {
  id: string;
  project_id: string;
  name: string;
}

// One row per project + building + department: the weighted progress model
export interface ProjectTask {
  id: string;
  project_id: string;
  building_id: string;
  department: string;
  weight_percent: number;
  completion_percent: number;
}

export interface BackendData {
  projects: Project[];
  employees: Employee[];
  taskCategories: TaskCategory[];
  departments: string[];
  buildings: Building[];
  projectTasks: ProjectTask[];
}

export type ReportFlag = 'none' | 'stalled' | 'regressed';

// One task line inside a report batch, as filled in the form (pre-submit)
export interface DraftReportLine {
  id: string; // local-only key for React lists
  department: string;
  task: string;
  percentage: string; // kept as string while editing, parsed on submit
  note: string;
}

// One task line as stored/returned by the database (post-submit)
export interface ReportLine {
  id: string;
  batch_id: string;
  department: string;
  task: string;
  percentage: number;
  previous_percentage: number;
  flag: ReportFlag;
  note: string | null;
}

export interface ReportBatch {
  id: string;
  employee_name: string;
  project_id: string;
  building_id: string;
  created_at: string;
  project_name?: string;
  building_name?: string;
  lines: ReportLine[];
}
