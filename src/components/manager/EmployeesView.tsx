import React, { useEffect, useState } from 'react';
import { BackendData } from '../../types';
import {
  addEmployee,
  deleteEmployee,
  fetchAssignments,
  assignEmployeeToProject,
  unassignEmployeeFromProject,
  AssignmentRow,
} from '../../services/supabaseService';
import { Plus, UserCheck, Trash2, Briefcase } from 'lucide-react';

interface EmployeesViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ backendData, onRefreshData }) => {
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [pickProject, setPickProject] = useState<Record<string, string>>({});

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

  const loadAssignments = async () => {
    try {
      setAssignments(await fetchAssignments());
    } catch (err: any) {
      notify('خطأ في تحميل التكليفات: ' + (err.message || err));
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const withSaving = async (fn: () => Promise<void>, successMsg: string) => {
    setSaving(true);
    try {
      await fn();
      notify(successMsg);
      onRefreshData();
    } catch (err: any) {
      notify('خطأ: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = (employeeId: string) => {
    const projectId = pickProject[employeeId];
    if (!projectId) return;
    setSaving(true);
    assignEmployeeToProject(employeeId, projectId)
      .then(async () => {
        notify('تم تكليف الموظف بالمشروع.');
        await loadAssignments();
        setPickProject((p) => ({ ...p, [employeeId]: '' }));
      })
      .catch((err) => notify('خطأ: ' + (err.message || err)))
      .finally(() => setSaving(false));
  };

  const handleUnassign = (assignmentId: string) => {
    setSaving(true);
    unassignEmployeeFromProject(assignmentId)
      .then(async () => {
        notify('تم إلغاء التكليف.');
        await loadAssignments();
      })
      .catch((err) => notify('خطأ: ' + (err.message || err)))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3 max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
          <UserCheck className="w-4 h-4 text-[#B89B5E]" />
          الموظفون
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newEmpName.trim() || !newEmpDept) return;
            withSaving(async () => {
              await addEmployee(newEmpName.trim(), newEmpDept);
              setNewEmpName('');
            }, 'تمت إضافة الموظف.');
          }}
          className="space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              placeholder="اسم الموظف..."
              className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
            />
            <select
              value={newEmpDept}
              onChange={(e) => setNewEmpDept(e.target.value)}
              className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
            >
              <option value="">اختر القسم...</option>
              {backendData.departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving} className="w-full py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة موظف
          </button>
        </form>
        <div className="space-y-2">
          {backendData.employees.map((emp) => {
            const empAssignments = assignments.filter((a) => a.employee_id === emp.id);
            const assignedProjectIds = new Set(empAssignments.map((a) => a.project_id));
            const availableProjects = backendData.projects.filter((p) => !assignedProjectIds.has(p.id));
            return (
              <div key={emp.id} className="p-2.5 bg-[#F3EDDD] rounded-lg border border-[#DED2AC] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span><strong>{emp.name}</strong> <span className="text-stone-500">— {emp.department}</span></span>
                  <button
                    onClick={() => withSaving(async () => { await deleteEmployee(emp.id); }, 'تم حذف الموظف.')}
                    className="text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Briefcase className="w-3 h-3 text-[#B89B5E]" />
                  {empAssignments.length === 0 && <span className="text-stone-400">لا توجد مشاريع مسندة</span>}
                  {empAssignments.map((a) => {
                    const proj = backendData.projects.find((p) => p.id === a.project_id);
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1">
                        {proj?.name || '—'}
                        <button onClick={() => handleUnassign(a.id)} disabled={saving} className="text-stone-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {availableProjects.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <select
                        value={pickProject[emp.id] || ''}
                        onChange={(e) => setPickProject((p) => ({ ...p, [emp.id]: e.target.value }))}
                        className="border border-[#DED2AC] rounded-lg px-1.5 py-1 text-[11px] bg-white"
                      >
                        <option value="">+ تكليف بمشروع...</option>
                        {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => handleAssign(emp.id)}
                        disabled={saving || !pickProject[emp.id]}
                        className="px-2 py-1 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-[11px] disabled:opacity-40"
                      >
                        تكليف
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {backendData.employees.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-6">لا يوجد موظفون بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
};
