import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addTaskSub, deleteTaskSub, setTaskCategoryDepartment } from '../../services/supabaseService';
import { Plus, ListTodo, Trash2 } from 'lucide-react';

interface TaskCategoriesViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const TaskCategoriesView: React.FC<TaskCategoriesViewProps> = ({ backendData, onRefreshData }) => {
  const [newTaskMain, setNewTaskMain] = useState('');
  const [newTaskSub, setNewTaskSub] = useState('');
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
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
          <ListTodo className="w-4 h-4 text-[#B89B5E]" />
          تصنيفات المهام
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTaskMain.trim() || !newTaskSub.trim()) return;
            withSaving(async () => {
              await addTaskSub(newTaskMain.trim(), newTaskSub.trim(), backendData.taskCategories);
              setNewTaskSub('');
            }, 'تمت إضافة المهمة.');
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        >
          <input
            value={newTaskMain}
            onChange={(e) => setNewTaskMain(e.target.value)}
            placeholder="التصنيف الرئيسي..."
            className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <input
            value={newTaskSub}
            onChange={(e) => setNewTaskSub(e.target.value)}
            placeholder="المهمة الفرعية..."
            className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <button type="submit" disabled={saving} className="py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </form>
        <div className="space-y-3">
          {backendData.taskCategories.map((cat) => (
            <div key={cat.id} className="bg-[#F3EDDD] border border-[#DED2AC] p-4 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#3B4636]">{cat.main}</div>
                <label className="text-[11px] text-stone-600">Visible for department
                  <select value={cat.department || ''} onChange={(e) => withSaving(() => setTaskCategoryDepartment(cat.id, e.target.value || null), 'Category department updated.')} className="mr-2 bg-white border border-[#DED2AC] rounded px-2 py-1 text-xs">
                    <option value="">Unassigned</option>
                    {backendData.departments.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cat.subs.map((sub) => (
                  <span key={sub} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#DED2AC] rounded-lg text-xs">
                    {sub}
                    <button
                      onClick={() => withSaving(async () => { await deleteTaskSub(cat, sub); }, 'تم الحذف.')}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
