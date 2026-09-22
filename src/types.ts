export type Role = 'employee' | 'manager' | 'team_leader';
export type ProjectStatus = 'draft' | 'ready' | 'running' | 'stopped' | 'not_wanted' | 'completed';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'under_review' | 'revision_required' | 'completed' | 'cancelled' | 'on_hold';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
// Projects in these statuses no longer accept daily progress. Shared by the report form
// (hides them) and the backend (rejects them) so the two cannot drift apart.
export const PROGRESS_CLOSED_STATUSES: ProjectStatus[] = ['completed', 'stopped', 'not_wanted'];
export type AttendanceStatus = 'present' | 'late' | 'day_off' | 'hours_off' | 'absent';
export interface Department { id: string; name: string; active?: boolean; }
export interface Employee { id: string; department: string; name: string; username?: string | null; }
export interface TaskCategory { id: string; main: string; subs: string[]; department?: string | null; departments?: string[]; is_general?: boolean; }
export interface Project { id: string; name: string; status: ProjectStatus; description?: string | null; start_date?: string | null; target_date?: string | null; created_by?: string | null; created_at?: string; }
export interface ProjectAssignment { id: string; project_id: string; employee_id: string; assigned_by?: string | null; assigned_at?: string; }
export interface Building { id: string; project_id: string; name: string; weight_percent: number; }
export interface Area { id: string; building_id: string; name: string; area_m2?: number; }
export interface ProjectTask {
  id: string; project_id: string; building_id: string; department: string; task: string; category?: string | null;
  assigned_employee_id?: string | null; assigned_employee_name?: string | null; assigned_team?: string | null;
  priority: TaskPriority; status: TaskStatus; planned_start?: string | null; planned_finish?: string | null;
  actual_start?: string | null; actual_finish?: string | null; weight_percent: number; completion_percent: number; updated_at?: string;
}
// task_activities is the single authoritative history of a task's progress.
// kind 'report' = produced by a submitted report line (report_line_id links back to it);
// kind 'override' = a manager correction, always carrying a reason and who made it.
export type ActivityKind = 'report' | 'override';
export interface TaskActivity { id: string; project_task_id: string | null; employee_id?: string | null; employee_name?: string | null; activity_date: string; description: string; previous_percent: number; new_percent: number; hours_worked?: number | null; blocker?: string | null; note?: string | null; created_at?: string; kind?: ActivityKind; report_line_id?: string | null; recorded_by?: string | null; reason?: string | null; }
export type BlockerStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export interface TaskBlocker { id: string; project_task_id: string; report_line_id?: string | null; title: string; description?: string | null; status: BlockerStatus; owner_employee_id?: string | null; reported_by?: string | null; resolved_by?: string | null; resolution_note?: string | null; created_at: string; updated_at: string; resolved_at?: string | null; }
// The signed-in account. employee_id ties the login to an employee record; it is never chosen by the user.
export interface Profile { id: string; username?: string; display_name: string; role: Role; active: boolean; employee_id: string | null; team_leader_id: string | null; }
export interface AttendanceRecord { id: string; employee_id: string; employee_name?: string; department?: string; attendance_date: string; entrance_time: string | null; status: AttendanceStatus; hours_off: number; note: string | null; created_at?: string; updated_at?: string; }
export interface LoginAudit { id: string; user_id: string; username: string; display_name: string; role: Role; employee_id?: string | null; logged_in_at: string; }
export interface BackendData { projects: Project[]; employees: Employee[]; projectAssignments: ProjectAssignment[]; taskCategories: TaskCategory[]; departments: string[]; departmentRows?: Department[]; buildings: Building[]; areas: Area[]; projectTasks: ProjectTask[]; activities: TaskActivity[]; blockers: TaskBlocker[]; reportBatches: ReportBatch[]; reportSnapshots: ReportSnapshot[]; attendance: AttendanceRecord[]; loginAudits: LoginAudit[]; }
export type ReportFlag = 'none' | 'stalled' | 'regressed';
// A report is 1+ projects, each with 1+ buildings, each with 1+ task lines.
export interface DraftTaskLine { id: string; category: string; task: string; percentage: string; activity: string; hoursWorked: string; blocker: string; note: string; }
export interface DraftBuildingGroup { id: string; buildingId: string; lines: DraftTaskLine[]; }
export interface DraftProjectGroup { id: string; projectId: string; department: string; buildings: DraftBuildingGroup[]; }
// percentage / previous_percentage / flag are read from the linked task activity, not stored on the line.
export interface ReportLine { id: string; batch_id: string; department: string; task: string; project_task_id?: string | null; percentage: number; previous_percentage: number; flag: ReportFlag; note: string | null; }
// work_date = the day the work was done; created_at = when the report was submitted (they can differ).
// employee_id is the reporting employee; submitted_by is the account that pressed submit (differs when a manager reports on someone's behalf).
export type ReportStatus = 'submitted' | 'returned' | 'approved' | 'locked';
export interface ReportBatch { id: string; employee_id?: string | null; employee_name: string; submitted_by?: string | null; project_id: string; building_id: string; work_date: string; created_at: string; status: ReportStatus; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; project_name?: string; building_name?: string; lines: ReportLine[]; }
export type ReportSnapshotType = 'executive_summary' | 'detailed_project' | 'monthly' | 'employee_activity' | 'project_completion';
export interface ReportSnapshot { id: string; report_type: ReportSnapshotType; title: string; period_start: string; period_end: string; filters: Record<string, unknown>; summary: Record<string, unknown>; details: unknown[]; generated_by: string; generated_at: string; }
