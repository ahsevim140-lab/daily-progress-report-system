import React, { useState } from 'react';
import { BackendData } from '../../types';
import { addDepartment, deleteDepartment, updateDepartment } from '../../services/supabaseService';
import { Plus, FolderKanban, Trash2, Pencil, Check, X } from 'lucide-react';

export const DepartmentsView: React.FC<{ backendData: BackendData; onRefreshData: () => void }> = ({ backendData, onRefreshData }) => {
  const [newDepartment, setNewDepartment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const notify = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };
  const run = async (fn: () => Promise<void>, success: string) => { setSaving(true); try { await fn(); notify(success); onRefreshData(); } catch (err: any) { notify('Error: ' + (err.message || err)); } finally { setSaving(false); } };
  return <div className="space-y-4">
    {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] border-b border-[#DED2AC] pb-3"><FolderKanban className="w-4 h-4 text-[#B89B5E]" />Departments</div>
      <form onSubmit={(e) => { e.preventDefault(); if (!newDepartment.trim()) return; run(async () => { await addDepartment(newDepartment.trim()); setNewDepartment(''); }, 'Department added.'); }} className="flex gap-2 max-w-xl">
        <input value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="New department name..." className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs" />
        <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl">
        {(backendData.departmentRows || backendData.departments.map((name) => ({ id: name, name }))).map((d) => <div key={d.id} className="flex items-center justify-between p-3 bg-[#F3EDDD] rounded-xl border border-[#DED2AC] text-xs">
          {editingId === d.id ? <><input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1 ml-2" /><button disabled={saving || !editingName.trim()} onClick={() => run(async () => { await updateDepartment(d.id, editingName.trim()); setEditingId(null); }, 'Department updated.')} className="text-emerald-700"><Check className="w-4 h-4" /></button><button onClick={() => setEditingId(null)} className="text-stone-500"><X className="w-4 h-4" /></button></> : <><span className="font-medium">{d.name}</span><span className="flex gap-2"><button onClick={() => { setEditingId(d.id); setEditingName(d.name); }} className="text-stone-400 hover:text-[#3B4636]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => run(async () => { await deleteDepartment(d.id); }, 'Department deleted.')} className="text-stone-400 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></span></>}
        </div>)}
      </div>
      <p className="text-[10px] text-stone-500">If a department is linked to employees or historical reports, the database may prevent deletion to protect your records. Rename it instead.</p>
    </div>
  </div>;
};
