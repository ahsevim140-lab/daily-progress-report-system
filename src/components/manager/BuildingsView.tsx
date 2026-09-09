import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addBuilding, updateBuilding, deleteBuilding } from '../../services/supabaseService';
import { Plus, Building, Trash2, Pencil, Check, X } from 'lucide-react';

interface BuildingsViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const BuildingsView: React.FC<BuildingsViewProps> = ({ backendData, onRefreshData }) => {
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingProject, setNewBuildingProject] = useState('');
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
          <Building className="w-4 h-4 text-[#B89B5E]" />
          المباني
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newBuildingName.trim() || !newBuildingProject) return;
            withSaving(async () => {
              await addBuilding(newBuildingProject, newBuildingName.trim(), backendData.departments);
              setNewBuildingName('');
            }, 'تمت إضافة المبنى بوزن موزّع بالتساوي بين الأقسام — عدّله من تبويب نسب الإنجاز.');
          }}
          className="space-y-2"
        >
          <select
            value={newBuildingProject}
            onChange={(e) => setNewBuildingProject(e.target.value)}
            className="w-full bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          >
            <option value="">اختر المشروع...</option>
            {backendData.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
              placeholder="اسم المبنى..."
              className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
            />
            <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>
        </form>
        <div className="space-y-1.5">
          {backendData.buildings.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
              {editingId === b.id ? (
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
                        await updateBuilding(b.id, editingName.trim());
                        setEditingId(null);
                      }, 'تم تحديث اسم المبنى.')}
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
                  <span className="font-medium text-stone-900">
                    {b.name} <span className="text-stone-500">({backendData.projects.find((p) => p.id === b.project_id)?.name})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingId(b.id); setEditingName(b.name); }} className="text-stone-400 hover:text-[#3B4636]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => withSaving(async () => { await deleteBuilding(b.id); }, 'تم حذف المبنى.')}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {backendData.buildings.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-6">لا توجد مبانٍ بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
};
