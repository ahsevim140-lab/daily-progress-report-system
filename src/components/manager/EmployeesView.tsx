import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addEmployee, deleteEmployee } from '../../services/supabaseService';
import { Plus, UserCheck, Trash2 } from 'lucide-react';

interface EmployeesViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ backendData, onRefreshData }) => {
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

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
        <div className="space-y-1.5">
          {backendData.employees.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
              <span><strong>{emp.name}</strong> <span className="text-stone-500">— {emp.department}</span>{emp.username && <span className="text-[#3B4636]"> · Login: @{emp.username}</span>}</span>
              <button
                onClick={() => withSaving(async () => { await deleteEmployee(emp.id); }, 'تم حذف الموظف.')}
                className="text-stone-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {backendData.employees.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-6">لا يوجد موظفون بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
};
