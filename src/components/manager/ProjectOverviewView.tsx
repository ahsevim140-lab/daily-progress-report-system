import React, { useMemo, useState } from 'react';
import { BackendData, Project, ProjectTask } from '../../types';
import {
  AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardCheck, Clock3, Filter, Printer, Search, ShieldAlert, TrendingUp, UserCheck, UserRound, Users, X,
} from 'lucide-react';
import { todayLocalYMD } from '../../utils';

function weighted(rows: { weight_percent: number; completion_percent: number }[]) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + Number(row.weight_percent || 0), 0);
  if (!total) return rows.reduce((sum, row) => sum + Number(row.completion_percent || 0), 0) / rows.length;
  return rows.reduce((sum, row) => sum + Number(row.weight_percent || 0) * Number(row.completion_percent || 0), 0) / total;
}
function ageInDays(value?: string) {
  if (!value) return 999;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}
function formatDate(value?: string) {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function projectProgress(project: Project, tasks: ProjectTask[], buildings: BackendData['buildings'], areas: BackendData['areas']) {
  const buildingValues = buildings.filter((building) => building.project_id === project.id).map((building) => {
    const rows = tasks.filter((task) => task.building_id === building.id);
    const area = areas.filter((item) => item.building_id === building.id).reduce((sum, item) => sum + Number(item.area_m2 || 0), 0);
    return { building, rows, area, progress: weighted(rows) };
  });
  const totalArea = buildingValues.reduce((sum, item) => sum + item.area, 0);
  const progress = totalArea
    ? buildingValues.reduce((sum, item) => sum + item.progress * item.area, 0) / totalArea
    : weighted(tasks);
  return { buildingValues, totalArea, progress };
}

const Bar: React.FC<{ value: number; tone?: 'green' | 'gold' | 'red' }> = ({ value, tone = 'green' }) => {
  const colors = { green: 'bg-[#3B4636]', gold: 'bg-[#B89B5E]', red: 'bg-[#9C4A3C]' };
  return <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full ${colors[tone]} rounded-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
};

interface ProjectSummary {
  project: Project;
  tasks: ProjectTask[];
  buildings: ReturnType<typeof projectProgress>['buildingValues'];
  totalArea: number;
  progress: number;
  overdue: ProjectTask[];
  blocked: ProjectTask[];
  stale: ProjectTask[];
  upcoming: ProjectTask[];
  staff: Set<string>;
  completed: number;
  health: 'On track' | 'Attention' | 'Delayed' | 'Completed';
}

export const ProjectOverviewView: React.FC<{ backendData: BackendData }> = ({ backendData }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState(7);
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const today = todayLocalYMD();

  const summaries = useMemo<ProjectSummary[]>(() => backendData.projects.map((project) => {
    const tasks = backendData.projectTasks.filter((task) => task.project_id === project.id);
    const calculated = projectProgress(project, tasks, backendData.buildings, backendData.areas);
    const active = tasks.filter((task) => !['completed', 'cancelled'].includes(task.status));
    const overdue = active.filter((task) => task.planned_finish && task.planned_finish < today);
    const blocked = active.filter((task) => task.status === 'blocked');
    const stale = active.filter((task) => ageInDays(task.updated_at) > 3);
    const upcoming = active.filter((task) => task.planned_finish && task.planned_finish >= today && task.planned_finish <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const health = project.status === 'completed' ? 'Completed' : overdue.length > 0 ? 'Delayed' : blocked.length > 0 || stale.length > 0 ? 'Attention' : 'On track';
    return { project, tasks, buildings: calculated.buildingValues, totalArea: calculated.totalArea, progress: calculated.progress, overdue, blocked, stale, upcoming, staff: new Set(tasks.map((task) => task.assigned_employee_id).filter(Boolean) as string[]), completed, health };
  }), [backendData.projects, backendData.projectTasks, backendData.buildings, backendData.areas, today]);

  const visibleSummaries = useMemo(() => summaries.filter((summary) => {
    const projectMatches = selectedProjectId === 'all' || summary.project.id === selectedProjectId;
    const statusMatches = statusFilter === 'all' || summary.health === statusFilter;
    const employeeMatches = employeeFilter === 'all' || summary.tasks.some((task) => task.assigned_employee_id === employeeFilter);
    const searchMatches = !search.trim() || summary.project.name.toLowerCase().includes(search.toLowerCase()) || summary.tasks.some((task) => `${task.department} ${task.task}`.toLowerCase().includes(search.toLowerCase()));
    return projectMatches && statusMatches && employeeMatches && searchMatches;
  }), [summaries, selectedProjectId, statusFilter, employeeFilter, search]);

  const visibleTasks = visibleSummaries.flatMap((summary) => summary.tasks.map((task) => ({ task, project: summary.project })));
  const attentionItems = visibleSummaries.flatMap((summary) => [
    ...summary.blocked.map((task) => ({ task, project: summary.project, kind: 'Blocked' })),
    ...summary.overdue.map((task) => ({ task, project: summary.project, kind: 'Overdue' })),
    ...summary.stale.map((task) => ({ task, project: summary.project, kind: 'No update 3+ days' })),
  ]).filter((item, index, all) => all.findIndex((candidate) => candidate.task.id === item.task.id && candidate.kind === item.kind) === index).slice(0, 12);
  const activity = useMemo(() => backendData.activities.filter((item) => visibleSummaries.some((summary) => summary.tasks.some((task) => task.id === item.project_task_id))).sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || '') || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12), [backendData.activities, visibleSummaries]);

  const totals = useMemo(() => ({
    projects: visibleSummaries.length,
    tasks: visibleTasks.length,
    completed: visibleSummaries.reduce((sum, summary) => sum + summary.completed, 0),
    blocked: visibleSummaries.reduce((sum, summary) => sum + summary.blocked.length, 0),
    overdue: visibleSummaries.reduce((sum, summary) => sum + summary.overdue.length, 0),
    staff: new Set(visibleSummaries.flatMap((summary) => [...summary.staff])).size,
  }), [visibleSummaries, visibleTasks.length]);

  const reporting = useMemo(() => {
    const activeProjectIds = new Set(visibleSummaries.filter((summary) => !['completed', 'stopped', 'not_wanted'].includes(summary.project.status)).map((summary) => summary.project.id));
    const expectedEmployees = backendData.employees.filter((employee) => backendData.projectAssignments.some((assignment) => assignment.employee_id === employee.id && activeProjectIds.has(assignment.project_id)) && (employeeFilter === 'all' || employee.id === employeeFilter));
    const submittedToday = new Set(backendData.reportBatches.filter((batch) => batch.work_date === today && (batch.employee_id ? expectedEmployees.some((employee) => employee.id === batch.employee_id) : true)).map((batch) => batch.employee_id || batch.employee_name));
    const start = new Date(); start.setDate(start.getDate() - (periodDays - 1));
    const startYmd = start.toISOString().slice(0, 10);
    const recentBatches = backendData.reportBatches.filter((batch) => batch.work_date >= startYmd && batch.work_date <= today && (batch.employee_id ? expectedEmployees.some((employee) => employee.id === batch.employee_id) : true));
    const expectedRecent = expectedEmployees.length * periodDays;
    const submittedRecent = new Set(recentBatches.map((batch) => `${batch.employee_id || batch.employee_name}:${batch.work_date}`)).size;
    return { expectedEmployees, submittedToday, missingToday: expectedEmployees.filter((employee) => !submittedToday.has(employee.id) && !submittedToday.has(employee.name)), expectedRecent, submittedRecent, recentBatches };
  }, [backendData.employees, backendData.projectAssignments, backendData.reportBatches, visibleSummaries, employeeFilter, periodDays, today]);

  const trend = useMemo(() => {
    const points = Array.from({ length: periodDays }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (periodDays - 1 - index));
      const ymd = date.toISOString().slice(0, 10);
      const dayActivities = backendData.activities.filter((item) => item.activity_date === ymd && visibleTasks.some(({ task }) => task.id === item.project_task_id));
      return { date: ymd, activities: dayActivities.length, reports: reporting.recentBatches.filter((batch) => batch.work_date === ymd).length, progress: dayActivities.reduce((sum, item) => sum + Math.max(0, Number(item.new_percent) - Number(item.previous_percent)), 0) };
    });
    return points;
  }, [backendData.activities, visibleTasks, reporting.recentBatches, periodDays]);

  const workload = useMemo(() => backendData.employees.filter((employee) => employeeFilter === 'all' || employee.id === employeeFilter).map((employee) => {
    const tasks = visibleTasks.filter(({ task }) => task.assigned_employee_id === employee.id).map(({ task }) => task);
    const employeeActivities = backendData.activities.filter((item) => item.employee_id === employee.id && item.activity_date >= trend[0]?.date);
    return { employee, active: tasks.filter((task) => !['completed', 'cancelled'].includes(task.status)).length, completed: tasks.filter((task) => task.status === 'completed').length, overdue: tasks.filter((task) => task.planned_finish && task.planned_finish < today && !['completed', 'cancelled'].includes(task.status)).length, hours: employeeActivities.reduce((sum, item) => sum + Number(item.hours_worked || 0), 0) };
  }).filter((row) => row.active || row.completed || row.hours).sort((a, b) => b.active - a.active || b.hours - a.hours).slice(0, 12), [backendData.employees, backendData.activities, employeeFilter, visibleTasks, trend, today]);

  return <div className="space-y-5 print-report">
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 no-print">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-[#3B4636] font-bold"><BarChart3 className="w-5 h-5 text-[#B89B5E]" />Project Control Center</div><p className="text-xs text-stone-500 mt-1">Current health, risks, deadlines, and traceable activity in one management view.</p></div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#3B4636] text-white rounded-lg px-3 py-2 text-xs font-semibold"><Printer className="w-3.5 h-3.5" />Print executive summary</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-4">
        <label className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or tasks" className="w-full bg-white border border-[#DED2AC] rounded-lg pl-8 pr-2 py-2 text-xs" /></label>
        <label className="flex items-center gap-2 text-xs"><Filter className="w-3.5 h-3.5 text-[#B89B5E]" /><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All projects</option>{backendData.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All health states</option><option value="On track">On track</option><option value="Attention">Attention</option><option value="Delayed">Delayed</option><option value="Completed">Completed</option></select>
        <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All employees</option>{backendData.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>
        <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className="bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select>
        <div className="text-[10px] text-stone-500 flex items-center justify-end">As of {formatDate(today)}</div>
      </div>
    </div>

    <div className="hidden print:block mb-5"><h1 className="text-2xl font-bold">Executive Project Status Report</h1><p className="text-xs text-stone-500">Generated {new Date().toLocaleString()} · Filters: {selectedProjectId === 'all' ? 'All projects' : backendData.projects.find((project) => project.id === selectedProjectId)?.name || selectedProjectId}</p></div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      {[
        ['Projects', totals.projects, 'bg-[#F3EDDD]', BarChart3], ['Tasks', totals.tasks, 'bg-white', CheckCircle2], ['Completed', totals.completed, 'bg-emerald-50', CheckCircle2], ['Blocked', totals.blocked, 'bg-orange-50', ShieldAlert], ['Overdue', totals.overdue, 'bg-red-50', AlertTriangle], ['Assigned staff', totals.staff, 'bg-blue-50', Users],
      ].map(([label, value, tone, Icon]) => <div key={String(label)} className={`${tone} border border-[#DED2AC] rounded-xl p-3`}><div className="flex items-center gap-1 text-[10px] text-stone-600"><Icon className="w-3.5 h-3.5 text-[#B89B5E]" />{label}</div><strong className="text-2xl text-[#3B4636]">{String(value)}</strong></div>)}
    </div>

    <section className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3"><div><h2 className="font-serif font-bold text-lg text-[#3B4636]">Reporting control</h2><p className="text-xs text-stone-500">Submission coverage for active project assignments.</p></div><ClipboardCheck className="w-5 h-5 text-[#B89B5E]" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><div className="p-3 rounded-xl bg-blue-50 border border-blue-200"><div className="text-[10px] text-blue-700">Expected today</div><strong className="text-xl text-blue-800">{reporting.expectedEmployees.length}</strong></div><div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200"><div className="text-[10px] text-emerald-700">Submitted today</div><strong className="text-xl text-emerald-800">{reporting.submittedToday.size}</strong></div><div className="p-3 rounded-xl bg-red-50 border border-red-200"><div className="text-[10px] text-red-700">Missing today</div><strong className="text-xl text-red-800">{reporting.missingToday.length}</strong></div><div className="p-3 rounded-xl bg-[#F3EDDD] border border-[#DED2AC]"><div className="text-[10px] text-stone-600">Period coverage</div><strong className="text-xl text-[#3B4636]">{reporting.expectedRecent ? Math.round((reporting.submittedRecent / reporting.expectedRecent) * 100) : 0}%</strong><span className="block text-[10px] text-stone-500">{reporting.submittedRecent} / {reporting.expectedRecent} entries</span></div></div>
      {reporting.missingToday.length > 0 && <div className="mt-3 border-t border-[#DED2AC] pt-3"><div className="text-xs font-bold text-[#9C4A3C] mb-2">Missing today</div><div className="flex flex-wrap gap-2">{reporting.missingToday.slice(0, 12).map((employee) => <span key={employee.id} className="inline-flex items-center gap-1 bg-white border border-red-200 rounded-full px-2.5 py-1 text-[10px] text-red-800"><UserCheck className="w-3 h-3" />{employee.name}</span>)}</div></div>}
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex items-center justify-between mb-3"><div><h2 className="font-serif font-bold text-lg text-[#3B4636]">Progress trend</h2><p className="text-xs text-stone-500">Daily activity and positive progress change.</p></div><TrendingUp className="w-5 h-5 text-[#B89B5E]" /></div><div className="flex items-end gap-1 h-28 border-b border-[#DED2AC]">{trend.map((point) => { const height = Math.min(100, point.progress * 8 + point.activities * 8); return <div key={point.date} className="flex-1 flex flex-col items-center justify-end gap-1 group"><div className="w-full max-w-8 bg-[#B89B5E] rounded-t" style={{ height: `${Math.max(4, height)}%` }} title={`${formatDate(point.date)}: ${point.progress.toFixed(1)}% progress, ${point.activities} activities`} /><span className="text-[8px] text-stone-500">{point.date.slice(5)}</span></div>; })}</div><div className="mt-3 flex justify-between text-[10px] text-stone-500"><span>{trend.reduce((sum, point) => sum + point.activities, 0)} activities</span><span>{trend.reduce((sum, point) => sum + point.progress, 0).toFixed(1)} percentage points gained</span></div></div>
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex items-center justify-between mb-3"><div><h2 className="font-serif font-bold text-lg text-[#3B4636]">Team workload</h2><p className="text-xs text-stone-500">Assigned work and recorded effort; not an employee ranking.</p></div><Users className="w-5 h-5 text-[#B89B5E]" /></div>{workload.length ? <div className="space-y-2">{workload.map((row) => <div key={row.employee.id} className="bg-white border border-[#DED2AC] rounded-lg p-2"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-[#3B4636]">{row.employee.name}</span><span className="text-stone-500">{row.hours.toFixed(1)}h</span></div><div className="grid grid-cols-3 gap-2 mt-1 text-[10px] text-stone-500"><span>Active: <strong className="text-[#3B4636]">{row.active}</strong></span><span>Done: <strong className="text-emerald-700">{row.completed}</strong></span><span>Overdue: <strong className="text-red-700">{row.overdue}</strong></span></div></div>)}</div> : <p className="text-xs text-stone-500">No workload data matches the selected filters.</p>}</div>
    </section>

    <section className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3"><div><h2 className="font-serif font-bold text-lg text-[#3B4636]">Needs attention</h2><p className="text-xs text-stone-500">Every item below links to the task and its latest history.</p></div><span className="text-xs font-bold text-[#9C4A3C]">{attentionItems.length} items</span></div>
      {attentionItems.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{attentionItems.map(({ task, project, kind }) => <button key={`${task.id}-${kind}`} type="button" onClick={() => setSelectedTask(task)} className="text-left bg-white border border-[#DED2AC] rounded-xl p-3 hover:border-[#B89B5E] transition-colors"><div className="flex items-start justify-between gap-2"><div><div className="text-xs font-bold text-[#3B4636]">{task.task || 'Unassigned task'}</div><div className="text-[10px] text-stone-500">{project.name} · {task.department} · {task.assigned_employee_name || 'Unassigned'}</div></div><span className={`text-[10px] font-bold ${kind === 'Blocked' ? 'text-orange-700' : kind === 'Overdue' ? 'text-red-700' : 'text-amber-700'}`}>{kind}</span></div><div className="mt-2"><Bar value={Number(task.completion_percent)} tone={kind === 'Overdue' ? 'red' : 'gold'} /></div><div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{task.completion_percent}% complete</span><span>{task.planned_finish ? `Due ${formatDate(task.planned_finish)}` : `Updated ${ageInDays(task.updated_at)}d ago`}</span></div></button>)}</div> : <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />No attention items detected for the selected filters.</div>}
    </section>

    <section className="space-y-3">
      {visibleSummaries.map((summary) => {
        const isOpen = expanded[summary.project.id] !== false;
        return <article key={summary.project.id} className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl overflow-hidden">
          <button type="button" onClick={() => setExpanded((current) => ({ ...current, [summary.project.id]: !isOpen }))} className="w-full text-left p-5 hover:bg-[#F3EDDD]/60 no-print"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3">{isOpen ? <ChevronUp className="w-4 h-4 text-[#B89B5E]" /> : <ChevronDown className="w-4 h-4 text-[#B89B5E]" />}<div><h2 className="font-serif font-bold text-lg text-[#3B4636]">{summary.project.name}</h2><span className="text-[10px] text-stone-500">{statusLabel(summary.project.status)} · {summary.buildings.length} buildings · {summary.totalArea.toFixed(1)} m²</span></div></div><div className="w-56"><div className="flex justify-between text-[10px] text-stone-500 mb-1"><span>Overall progress</span><strong className="text-base text-[#3B4636]">{summary.progress.toFixed(1)}%</strong></div><Bar value={summary.progress} /></div><span className={`text-xs font-bold ${summary.health === 'Delayed' ? 'text-red-700' : summary.health === 'Attention' ? 'text-amber-700' : summary.health === 'Completed' ? 'text-emerald-700' : 'text-[#3B4636]'}`}>{summary.health}</span></div></button>
          <div className="p-5 pt-0 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><div className="p-3 rounded-xl bg-white border border-[#DED2AC]"><div className="text-[10px] text-stone-500">Overall progress</div><strong>{summary.progress.toFixed(1)}%</strong></div><div className="p-3 rounded-xl bg-white border border-[#DED2AC]"><div className="text-[10px] text-stone-500">Task completion</div><strong>{summary.completed} / {summary.tasks.length}</strong></div><div className="p-3 rounded-xl bg-red-50 border border-red-200"><div className="text-[10px] text-red-700">Overdue</div><strong className="text-red-800">{summary.overdue.length}</strong></div><div className="p-3 rounded-xl bg-orange-50 border border-orange-200"><div className="text-[10px] text-orange-700">Blocked</div><strong className="text-orange-800">{summary.blocked.length}</strong></div><div className="p-3 rounded-xl bg-blue-50 border border-blue-200"><div className="text-[10px] text-blue-700">Assigned staff</div><strong className="text-blue-800">{summary.staff.size}</strong></div></div>
            {isOpen && <div className="space-y-3"><div className="text-xs font-bold text-[#3B4636]">Buildings and tasks</div>{summary.buildings.map(({ building, rows, area, progress }) => <div key={building.id} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-4"><div className="flex justify-between text-xs font-bold text-[#3B4636] mb-2"><span>{building.name} <span className="font-normal text-stone-500">· {area.toFixed(1)} m²</span></span><span>{progress.toFixed(1)}%</span></div><Bar value={progress} />{rows.length ? <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">{rows.map((task) => <button key={task.id} type="button" onClick={() => setSelectedTask(task)} className="text-left bg-white border border-[#DED2AC] rounded-lg p-2 hover:border-[#B89B5E]"><div className="flex justify-between gap-2 text-[11px]"><span>{task.department}{task.task ? ` — ${task.task}` : ''}</span><strong>{task.completion_percent}%</strong></div><div className="text-[10px] text-stone-500 mt-1">{statusLabel(task.status)} · {task.assigned_employee_name || 'Unassigned'}{task.planned_finish ? ` · due ${formatDate(task.planned_finish)}` : ''}</div><div className="mt-2"><Bar value={Number(task.completion_percent)} /></div></button>)}</div> : <div className="text-xs text-stone-500 mt-3">No tasks assigned yet.</div>}</div>)}</div>}
          </div>
        </article>;
      })}
      {!visibleSummaries.length && <div className="text-center text-xs text-stone-500 py-10">No projects match the selected filters.</div>}
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex items-center gap-2 mb-3"><Clock3 className="w-4 h-4 text-[#B89B5E]" /><h2 className="font-serif font-bold text-lg text-[#3B4636]">Recent activity</h2></div>{activity.length ? <div className="space-y-2">{activity.map((item) => { const task = backendData.projectTasks.find((candidate) => candidate.id === item.project_task_id); const project = backendData.projects.find((candidate) => candidate.id === task?.project_id); return <button key={item.id} type="button" onClick={() => task && setSelectedTask(task)} className="w-full text-left bg-white border border-[#DED2AC] rounded-lg p-3 hover:border-[#B89B5E]"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-[#3B4636]">{task?.task || 'Task activity'}</span><span className="text-[10px] text-stone-500">{formatDate(item.activity_date)}</span></div><div className="text-[10px] text-stone-500 mt-1">{project?.name || 'Project'} · {item.employee_name || 'System'} · {item.previous_percent}% → {item.new_percent}%{item.blocker ? ' · Blocked' : ''}</div><div className="text-[10px] text-stone-600 mt-1">{item.description || item.note || 'Progress recorded'}</div></button>; })}</div> : <p className="text-xs text-stone-500">No task activity is available for the selected projects.</p>}</div>
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-[#B89B5E]" /><h2 className="font-serif font-bold text-lg text-[#3B4636]">Deadlines this week</h2></div>{visibleSummaries.flatMap((summary) => summary.upcoming.map((task) => ({ task, project: summary.project }))).slice(0, 10).map(({ task, project }) => <button key={task.id} type="button" onClick={() => setSelectedTask(task)} className="w-full text-left flex items-center justify-between gap-2 bg-white border border-[#DED2AC] rounded-lg p-3 mb-2 hover:border-[#B89B5E]"><span><span className="block text-xs font-semibold text-[#3B4636]">{task.task || 'Unassigned task'}</span><span className="text-[10px] text-stone-500">{project.name} · {task.assigned_employee_name || 'Unassigned'}</span></span><span className="text-[10px] font-bold text-[#9C4A3C]">{formatDate(task.planned_finish)}</span></button>)}{!visibleSummaries.some((summary) => summary.upcoming.length) && <p className="text-xs text-stone-500">No upcoming task deadlines in the next seven days.</p>}</div>
    </section>

    {selectedTask && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 no-print" onClick={() => setSelectedTask(null)}><div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl shadow-xl max-w-lg w-full p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-stone-500">Task drill-down</div><h2 className="font-serif font-bold text-xl text-[#3B4636]">{selectedTask.task || 'Unassigned task'}</h2></div><button type="button" onClick={() => setSelectedTask(null)} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button></div><div className="grid grid-cols-2 gap-2 mt-4 text-xs"><div className="bg-white border border-[#DED2AC] rounded-lg p-3"><span className="block text-[10px] text-stone-500">Status</span><strong>{statusLabel(selectedTask.status)}</strong></div><div className="bg-white border border-[#DED2AC] rounded-lg p-3"><span className="block text-[10px] text-stone-500">Progress</span><strong>{selectedTask.completion_percent}%</strong></div><div className="bg-white border border-[#DED2AC] rounded-lg p-3"><span className="block text-[10px] text-stone-500">Employee</span><strong>{selectedTask.assigned_employee_name || 'Unassigned'}</strong></div><div className="bg-white border border-[#DED2AC] rounded-lg p-3"><span className="block text-[10px] text-stone-500">Due</span><strong>{formatDate(selectedTask.planned_finish)}</strong></div></div><div className="mt-4"><div className="flex items-center gap-2 text-xs font-bold text-[#3B4636]"><UserRound className="w-3.5 h-3.5 text-[#B89B5E]" />Activity history</div><div className="mt-2 space-y-2">{backendData.activities.filter((item) => item.project_task_id === selectedTask.id).sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || '')).slice(0, 8).map((item) => <div key={item.id} className="bg-white border border-[#DED2AC] rounded-lg p-2 text-[10px]"><div className="flex justify-between"><strong>{formatDate(item.activity_date)}</strong><span>{item.previous_percent}% → {item.new_percent}%</span></div><div className="text-stone-500 mt-1">{item.description || item.note || 'Progress recorded'}{item.blocker ? ` · Blocker: ${item.blocker}` : ''}</div></div>)}{!backendData.activities.some((item) => item.project_task_id === selectedTask.id) && <div className="text-xs text-stone-500">No activity history recorded yet.</div>}</div></div></div></div>}
  </div>;
};
