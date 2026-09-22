import React, { useEffect, useMemo, useState } from 'react';
import { BackendData, ReportBatch } from '../../types';
import { fetchReportBatches } from '../../services/supabaseService';
import { todayLocalYMD } from '../../utils';
import { Download, FileSpreadsheet, RefreshCw, Search, Users } from 'lucide-react';

interface ReportsViewProps { backendData: BackendData; }

function escapeHtml(value: unknown) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export const ReportsView: React.FC<ReportsViewProps> = ({ backendData }) => {
  const [batches, setBatches] = useState<ReportBatch[]>(backendData.reportBatches);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayLocalYMD());
  const [projectId, setProjectId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setBatches(await fetchReportBatches()); } catch (err: any) { setError(err.message || 'Unable to load report submissions.'); } finally { setLoading(false); }
  };
  useEffect(() => { setBatches(backendData.reportBatches); }, [backendData.reportBatches]);

  const activeEmployees = useMemo(() => {
    const eligibleProjectIds = new Set(backendData.projects.filter((project) => projectId === 'all' ? !['completed', 'stopped', 'not_wanted'].includes(project.status) : project.id === projectId).map((project) => project.id));
    const employeeIds = new Set(backendData.projectAssignments.filter((assignment) => eligibleProjectIds.has(assignment.project_id)).map((assignment) => assignment.employee_id));
    return backendData.employees.filter((employee) => employeeIds.has(employee.id));
  }, [backendData.employees, backendData.projectAssignments, backendData.projects, projectId]);

  const submittedIds = useMemo(() => new Set(batches.filter((batch) => batch.work_date === selectedDate && (projectId === 'all' || batch.project_id === projectId)).map((batch) => batch.employee_id || batch.employee_name)), [batches, selectedDate, projectId]);
  const missing = useMemo(() => activeEmployees.filter((employee) => !submittedIds.has(employee.id) && !submittedIds.has(employee.name)).filter((employee) => !searchTerm.trim() || `${employee.name} ${employee.department}`.toLowerCase().includes(searchTerm.toLowerCase())), [activeEmployees, submittedIds, searchTerm]);

  const downloadExcel = () => {
    const rows = missing.map((employee, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(employee.name)}</td><td>${escapeHtml(employee.department)}</td><td>${escapeHtml(selectedDate)}</td><td>Not submitted</td></tr>`).join('');
    const html = `<html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial}th,td{border:1px solid #999;padding:8px}th{background:#3B4636;color:#fff}</style></head><body><h2>Daily Report Missing Submissions</h2><p>Date: ${escapeHtml(selectedDate)}</p><p>Project: ${escapeHtml(projectId === 'all' ? 'All active projects' : backendData.projects.find((project) => project.id === projectId)?.name)}</p><table><thead><tr><th>No.</th><th>Employee</th><th>Department</th><th>Selected date</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5">All assigned employees submitted a report.</td></tr>'}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `missing_daily_reports_${selectedDate}.xls`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-5"><section className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#3B4636] font-bold"><FileSpreadsheet className="w-5 h-5 text-[#B89B5E]" />Daily report submission check</div><p className="text-xs text-stone-500 mt-1">This tab shows only employees who did not submit a report for the selected date. Submitted, approved, and locked reports are intentionally hidden.</p></div><button type="button" onClick={downloadExcel} className="inline-flex items-center gap-2 bg-[#3B4636] text-white rounded-lg px-3 py-2 text-xs font-semibold"><Download className="w-3.5 h-3.5" />Download Excel report</button></div><div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-5"><label className="text-xs text-stone-600">Selected date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs" /></label><label className="text-xs text-stone-600">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full bg-white border border-[#DED2AC] rounded-lg px-2 py-2 text-xs"><option value="all">All active projects</option>{backendData.projects.filter((project) => !['completed', 'stopped', 'not_wanted'].includes(project.status)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="text-xs text-stone-600">Search employee<div className="relative mt-1"><Search className="absolute left-2 top-2 w-3.5 h-3.5 text-stone-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name or department" className="w-full bg-white border border-[#DED2AC] rounded-lg pl-7 pr-2 py-2 text-xs" /></div></label><div className="flex items-end"><button type="button" onClick={load} className="inline-flex items-center gap-2 bg-white border border-[#DED2AC] text-[#3B4636] rounded-lg px-3 py-2 text-xs font-semibold"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh submissions</button></div></div>{error && <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">{error}</div>}</section><section className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-serif font-bold text-lg text-[#3B4636]">Employees who did not submit</h2><p className="text-xs text-stone-500">{selectedDate} · {projectId === 'all' ? 'All active projects' : backendData.projects.find((project) => project.id === projectId)?.name}</p></div><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2"><Users className="w-4 h-4 text-red-700" /><strong className="text-xl text-red-800">{missing.length}</strong></div></div>{missing.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#DED2AC] text-stone-500"><th className="p-2">No.</th><th className="p-2">Employee</th><th className="p-2">Department</th><th className="p-2">Date</th><th className="p-2">Status</th></tr></thead><tbody>{missing.map((employee, index) => <tr key={employee.id} className="border-b border-[#DED2AC]/60"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold text-[#3B4636]">{employee.name}</td><td className="p-2">{employee.department}</td><td className="p-2">{selectedDate}</td><td className="p-2 text-red-700 font-semibold">Not submitted</td></tr>)}</tbody></table></div> : <div className="text-center py-10 text-sm text-emerald-700">All assigned employees submitted a report for this date.</div>}</section></div>;
};
