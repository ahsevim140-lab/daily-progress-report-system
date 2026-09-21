import React, { useMemo, useState } from 'react';
import { BackendData, ReportSnapshot, ReportSnapshotType } from '../../types';
import { createReportSnapshot } from '../../services/supabaseService';
import { CalendarRange, FileDown, History, Loader2, Printer, Save, Search } from 'lucide-react';
import { todayLocalYMD } from '../../utils';

const REPORT_TYPES: { value: ReportSnapshotType; label: string; description: string }[] = [
  { value: 'executive_summary', label: 'Executive summary', description: 'Management status, progress, risks, and key numbers.' },
  { value: 'detailed_project', label: 'Detailed project report', description: 'Project, building, task, employee, and current status.' },
  { value: 'monthly', label: 'Monthly report', description: 'Activity and reporting coverage for a selected period.' },
  { value: 'employee_activity', label: 'Employee activity report', description: 'Work activity, tasks, and hours by employee.' },
  { value: 'project_completion', label: 'Project completion report', description: 'Completion state, remaining tasks, and unresolved risks.' },
];

function dateBefore(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function weighted(tasks: BackendData['projectTasks']) { if (!tasks.length) return 0; return tasks.reduce((sum, task) => sum + Number(task.completion_percent || 0), 0) / tasks.length; }

export const ReportBuilderView: React.FC<{ backendData: BackendData; onRefreshData: () => void }> = ({ backendData, onRefreshData }) => {
  const [reportType, setReportType] = useState<ReportSnapshotType>('executive_summary');
  const [periodStart, setPeriodStart] = useState(dateBefore(30));
  const [periodEnd, setPeriodEnd] = useState(todayLocalYMD());
  const [projectId, setProjectId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState<ReportSnapshot | null>(null);
  const [localSnapshots, setLocalSnapshots] = useState<ReportSnapshot[]>([]);

  const selectedType = REPORT_TYPES.find((item) => item.value === reportType) || REPORT_TYPES[0];
  const filteredProjects = useMemo(() => backendData.projects.filter((project) => projectId === 'all' || project.id === projectId), [backendData.projects, projectId]);
  const filteredTasks = useMemo(() => backendData.projectTasks.filter((task) => (projectId === 'all' || task.project_id === projectId) && (employeeId === 'all' || task.assigned_employee_id === employeeId) && (!search.trim() || `${task.task} ${task.department}`.toLowerCase().includes(search.toLowerCase()))), [backendData.projectTasks, projectId, employeeId, search]);
  const filteredBatches = useMemo(() => backendData.reportBatches.filter((batch) => batch.work_date >= periodStart && batch.work_date <= periodEnd && (projectId === 'all' || batch.project_id === projectId) && (employeeId === 'all' || batch.employee_id === employeeId)), [backendData.reportBatches, periodStart, periodEnd, projectId, employeeId]);
  const reportSummary = useMemo(() => ({
    projects: filteredProjects.length,
    tasks: filteredTasks.length,
    completedTasks: filteredTasks.filter((task) => task.status === 'completed').length,
    blockedTasks: filteredTasks.filter((task) => task.status === 'blocked').length,
    overdueTasks: filteredTasks.filter((task) => task.planned_finish && task.planned_finish < periodEnd && !['completed', 'cancelled'].includes(task.status)).length,
    averageProgress: Number(weighted(filteredTasks).toFixed(1)),
    reportCount: filteredBatches.length,
    employees: new Set(filteredTasks.map((task) => task.assigned_employee_id).filter(Boolean)).size,
  }), [filteredProjects.length, filteredTasks, filteredBatches.length, periodEnd]);
  const reportDetails = useMemo(() => filteredTasks.map((task) => ({ id: task.id, project: backendData.projects.find((project) => project.id === task.project_id)?.name || '', building: backendData.buildings.find((building) => building.id === task.building_id)?.name || '', task: task.task, department: task.department, employee: task.assigned_employee_name || 'Unassigned', status: task.status, progress: task.completion_percent, due: task.planned_finish || null })), [filteredTasks, backendData.projects, backendData.buildings]);
  const allSnapshots = [...localSnapshots, ...backendData.reportSnapshots].filter((snapshot, index, all) => all.findIndex((item) => item.id === snapshot.id) === index).sort((a, b) => b.generated_at.localeCompare(a.generated_at));

  const generate = async () => {
    if (periodEnd < periodStart) { setMessage('The report end date must be on or after the start date.'); return; }
    setGenerating(true); setMessage('');
    try {
      const snapshot = await createReportSnapshot({ report_type: reportType, title: `${selectedType.label} — ${formatDate(periodStart)} to ${formatDate(periodEnd)}`, period_start: periodStart, period_end: periodEnd, filters: { project_id: projectId, employee_id: employeeId, search }, summary: reportSummary, details: reportDetails });
      setGenerated(snapshot); setLocalSnapshots((current) => [snapshot, ...current]); setMessage('Snapshot saved. It is immutable and can be printed or retrieved later.'); onRefreshData();
    } catch (error: any) { setMessage(`Could not save snapshot: ${error.message || error}`); }
    finally { setGenerating(false); }
  };

  const preview = generated || allSnapshots[0];
  return <div className="space-y-5 print-report">
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 no-print"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#3B4636] font-bold"><FileDown className="w-5 h-5 text-[#B89B5E]" />Report Builder</div><p className="text-xs text-stone-500 mt-1">Generate a reproducible report, save its data snapshot, and print it for meetings.</p></div><button type="button" onClick={() => window.print()} disabled={!preview} className="inline-flex items-center gap-2 bg-[#3B4636] text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"><Printer className="w-3.5 h-3.5" />Print report</button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5"><label className="text-xs text-stone-600">Report type<select value={reportType} onChange={(event) => setReportType(event.target.value as ReportSnapshotType)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs">{REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="block text-[10px] text-stone-500 mt-1">{selectedType.description}</span></label><label className="text-xs text-stone-600">Start date<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs" /></label><label className="text-xs text-stone-600">End date<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs" /></label><label className="text-xs text-stone-600">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All projects</option>{backendData.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="text-xs text-stone-600">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All employees</option>{backendData.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label className="text-xs text-stone-600">Task search<div className="relative mt-1"><Search className="absolute left-2 top-2 w-3.5 h-3.5 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task or department" className="w-full bg-white border border-[#DED2AC] rounded-lg pl-7 pr-2 py-2 text-xs" /></div></label></div>
      <button type="button" onClick={generate} disabled={generating} className="mt-4 inline-flex items-center gap-2 bg-[#B89B5E] text-[#2C2A22] rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">{generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Generate and save snapshot</button>{message && <div className="mt-3 text-xs text-stone-700 bg-white border border-[#DED2AC] rounded-lg p-2">{message}</div>}
    </div>

    {preview ? <section className="bg-white border border-[#DED2AC] rounded-2xl p-6 print:border-0 print:p-0"><div className="flex justify-between gap-4 border-b border-[#DED2AC] pb-4"><div><h1 className="font-serif font-bold text-2xl text-[#3B4636]">{preview.title}</h1><p className="text-xs text-stone-500 mt-1">Generated {new Date(preview.generated_at).toLocaleString()} · Immutable snapshot</p></div><CalendarRange className="w-7 h-7 text-[#B89B5E] no-print" /></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 my-5">{Object.entries(preview.summary).map(([key, value]) => <div key={key} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3"><span className="block text-[10px] text-stone-500">{key.replace(/([A-Z])/g, ' $1')}</span><strong className="text-xl text-[#3B4636]">{String(value)}</strong></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#DED2AC] text-stone-500"><th className="p-2">Project</th><th className="p-2">Building</th><th className="p-2">Task</th><th className="p-2">Employee</th><th className="p-2">Status</th><th className="p-2">Progress</th><th className="p-2">Due</th></tr></thead><tbody>{(preview.details as any[]).slice(0, 200).map((row) => <tr key={row.id} className="border-b border-[#DED2AC]/60"><td className="p-2">{row.project}</td><td className="p-2">{row.building}</td><td className="p-2 font-medium">{row.task}</td><td className="p-2">{row.employee}</td><td className="p-2">{String(row.status).replaceAll('_', ' ')}</td><td className="p-2">{row.progress}%</td><td className="p-2">{row.due || '—'}</td></tr>)}</tbody></table></div></section> : <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-10 text-center text-xs text-stone-500">Choose filters and generate a report to create the first immutable snapshot.</div>}

    <section className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 no-print"><div className="flex items-center gap-2 mb-3"><History className="w-4 h-4 text-[#B89B5E]" /><h2 className="font-serif font-bold text-lg text-[#3B4636]">Saved snapshots</h2></div>{allSnapshots.length ? <div className="space-y-2">{allSnapshots.slice(0, 10).map((snapshot) => <button type="button" key={snapshot.id} onClick={() => setGenerated(snapshot)} className="w-full text-left bg-white border border-[#DED2AC] rounded-lg p-3 hover:border-[#B89B5E]"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-[#3B4636]">{snapshot.title}</span><span className="text-stone-500">{new Date(snapshot.generated_at).toLocaleString()}</span></div><div className="text-[10px] text-stone-500 mt-1">{snapshot.details.length} detail rows · {snapshot.report_type}</div></button>)}</div> : <p className="text-xs text-stone-500">No saved snapshots yet.</p>}</section>
  </div>;
};
