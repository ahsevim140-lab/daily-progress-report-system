import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addDepartment } from '../../services/supabaseService';
import { Plus, FolderKanban } from 'lucide-react';

interface DepartmentsViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ backendData, onRefreshData }) => {
  const [newDepartment, setNewDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3 max-w-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
          <FolderKanban className="w-4 h-4 text-[#B89B5E]" />
          الأقسام
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newDepartment.trim()) return;
            setSaving(true);
            try {
              await addDepartment(newDepartment.trim());
              setNewDepartment('');
              notify('تمت إضافة القسم.');
              onRefreshData();
            } catch (err: any) {
              notify('خطأ: ' + (err.message || err));
            } finally {
              setSaving(false);
            }
          }}
          className="flex gap-2"
        >
          <input
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="اسم قسم جديد..."
            className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {backendData.departments.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs">
              {d}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-stone-500">لحذف قسم، احذفه من قاعدة البيانات مباشرة إن لزم (لتفادي حذف بيانات مرتبطة به بالخطأ).</p>
      </div>
    </div>
  );
};
