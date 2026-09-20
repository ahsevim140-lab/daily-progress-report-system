import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addProject, updateProject, deleteProject } from '../../services/supabaseService';
import { Plus, Briefcase, Trash2, Pencil, Check, X } from 'lucide-react';

interface ProjectsViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ backendData, onRefreshData }) => {
  const [newProject, setNewProject] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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
          <Briefcase className="w-4 h-4 text-[#B89B5E]" />
          المشاريع
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newProject.trim()) return;
            withSaving(async () => {
              await addProject(newProject.trim());
              setNewProject('');
            }, 'تمت إضافة المشروع.');
          }}
          className="flex gap-2"
        >
          <input
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="اسم مشروع جديد..."
            className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </form>
        <div className="space-y-1.5">
          {backendData.projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
              {editingId === p.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1 text-xs ml-2"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button
                      disabled={saving || !editingName.trim()}
                      onClick={() => withSaving(async () => {
                        await updateProject(p.id, { name: editingName.trim() });
                        setEditingId(null);
                      }, 'تم تحديث اسم المشروع.')}
                      className="text-emerald-600 hover:text-emerald-800"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-stone-400 hover:text-stone-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium text-stone-900">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingId(p.id); setEditingName(p.name); }} className="text-stone-400 hover:text-[#3B4636]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => withSaving(async () => { await deleteProject(p.id); }, 'تم حذف المشروع.')}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {backendData.projects.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-6">لا توجد مشاريع بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
};
