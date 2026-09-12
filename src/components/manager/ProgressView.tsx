import React, { useMemo, useState } from 'react';
import { BackendData } from '../../types';
import { setProjectTaskWeight, overrideProjectTaskCompletion, addProjectTaskMeasure, deleteProjectTaskMeasure } from '../../services/supabaseService';
import { AlertTriangle, Save, Plus, Trash2, Search, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ProgressViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
  readOnly?: boolean;
}

function weightedCompletion(rows: { weight_percent: number; completion_percent: number }[]): number {
  const totalWeight = rows.reduce((s, r) => s + r.weight_percent, 0);
  if (totalWeight === 0) return 0;
  const sum = rows.reduce((s, r) => s + r.weight_percent * r.completion_percent, 0);
  return Math.round((sum / totalWeight) * 10) / 10;
}

const ProgressBar: React.FC<{ value: number; tone?: 'ok' | 'warn' }> = ({ value, tone = 'ok' }) => (
  <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${tone === 'warn' ? 'bg-amber-500' : 'bg-[#3B4636]'}`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

export const ProgressView: React.FC<ProgressViewProps> = ({ backendData, onRefreshData, readOnly = false }) => {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newMeasure, setNewMeasure] = useState<Record<string, { name: string; weight: string }>>({});
  const [busyBuildingId, setBusyBuildingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const projectsWithBuildings = backendData.projects.filter(
    (p) => backendData.buildings.filter((b) => b.project_id === p.id).length > 0
  );

  const chartData = useMemo(() => {
    return projectsWithBuildings.map((project) => {
      const buildings = backendData.buildings.filter((b) => b.project_id === project.id);
      const allProjectTasks = backendData.projectTasks.filter((t) => t.project_id === project.id);
      const buildingCompletions = buildings.map((b) =>
        weightedCompletion(allProjectTasks.filter((t) => t.building_id === b.id))
      );
      const pct = buildingCompletions.length
        ? Math.round((buildingCompletions.reduce((s, v) => s + v, 0) / buildingCompletions.length) * 10) / 10
        : 0;
      return { name: project.name.length > 18 ? project.name.slice(0, 18) + '…' : project.name, fullName: project.name, pct };
    });
  }, [projectsWithBuildings, backendData.buildings, backendData.projectTasks]);

  const filteredProjects = search.trim()
    ? projectsWithBuildings.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : projectsWithBuildings;

  const handleAddMeasure = async (projectId: string, buildingId: string) => {
    const draft = newMeasure[buildingId];
    const name = draft?.name?.trim();
    const weight = Number(draft?.weight);
    if (!name || Number.isNaN(weight) || weight < 0 || weight > 100) return;
    setBusyBuildingId(buildingId);
    try {
      await addProjectTaskMeasure(projectId, buildingId, name, weight);
      setNewMeasure((m) => ({ ...m, [buildingId]: { name: '', weight: '' } }));
      onRefreshData();
    } finally {
      setBusyBuildingId(null);
    }
  };

  const handleDeleteMeasure = async (buildingId: string, id: string) => {
    setBusyBuildingId(buildingId);
    try {
      await deleteProjectTaskMeasure(id);
      onRefreshData();
    } finally {
      setBusyBuildingId(null);
    }
  };

  const handleWeightSave = async (id: string, value: string) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num > 100) return;
    setSavingId(id);
    try {
      await setProjectTaskWeight(id, num);
      onRefreshData();
    } finally {
      setSavingId(null);
    }
  };

  const handleOverrideSave = async (id: string, value: string) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num > 100) return;
    setSavingId(id);
    try {
      await overrideProjectTaskCompletion(id, num);
      onRefreshData();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {chartData.length > 1 && (
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider mb-3">
            <BarChart3 className="w-4 h-4 text-[#B89B5E]" />
            نسبة الإنجاز حسب المشروع
          </div>
          <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={150} fontSize={11} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'الإنجاز']}
                labelFormatter={(_, payload) => (payload && payload[0] ? (payload[0].payload as any).fullName : '')}
              />
              <Bar dataKey="pct" fill="#3B4636" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن مشروع..."
          className="w-full bg-white border border-[#DED2AC] rounded-xl pr-9 pl-3 py-2 text-xs"
        />
      </div>

      {filteredProjects.map((project) => {
        const buildings = backendData.buildings.filter((b) => b.project_id === project.id);
        if (buildings.length === 0) return null;

        const allProjectTasks = backendData.projectTasks.filter((t) => t.project_id === project.id);
        const buildingCompletions = buildings.map((b) =>
          weightedCompletion(allProjectTasks.filter((t) => t.building_id === b.id))
        );
        const projectCompletion = buildingCompletions.length
          ? Math.round((buildingCompletions.reduce((s, v) => s + v, 0) / buildingCompletions.length) * 10) / 10
          : 0;

        return (
          <div key={project.id} className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED2AC] pb-3">
              <h4 className="font-serif font-bold text-[#3B4636]">{project.name}</h4>
              <span className="text-sm font-bold text-[#3B4636]">{projectCompletion}%</span>
            </div>
            <ProgressBar value={projectCompletion} />

            <div className="space-y-4 pt-2">
              {buildings.map((building) => {
                const rows = allProjectTasks.filter((t) => t.building_id === building.id);
                const buildingPct = weightedCompletion(rows);
                const totalWeight = rows.reduce((s, r) => s + r.weight_percent, 0);
                const weightOff = Math.abs(totalWeight - 100) > 0.01;

                return (
                  <div key={building.id} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#3B4636]">{building.name}</span>
                      <span className="text-xs font-mono font-bold text-[#3B4636]">{buildingPct}%</span>
                    </div>
                    <ProgressBar value={buildingPct} tone={weightOff ? 'warn' : 'ok'} />

                    {weightOff && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        مجموع الأوزان الحالي {totalWeight}% (يجب أن يكون 100%)
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {rows.map((row) => {
                        const draftKey = `w-${row.id}`;
                        const overrideKey = `o-${row.id}`;
                        return (
                          <div key={row.id} className="bg-white border border-[#DED2AC] rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-800">
                              <span>{row.department}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-stone-500">حالياً {row.completion_percent}%</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    disabled={busyBuildingId === building.id}
                                    onClick={() => handleDeleteMeasure(building.id, row.id)}
                                    className="text-stone-400 hover:text-red-600 disabled:opacity-30"
                                    title="حذف هذا القياس"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {!readOnly && (
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-stone-500 w-10 shrink-0">الوزن</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                defaultValue={row.weight_percent}
                                onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
                                className="w-16 border border-[#DED2AC] rounded px-1.5 py-1 text-[11px]"
                              />
                              <button
                                type="button"
                                disabled={savingId === row.id}
                                onClick={() => handleWeightSave(row.id, drafts[draftKey] ?? String(row.weight_percent))}
                                className="text-[#3B4636] hover:text-[#4B5842]"
                                title="حفظ الوزن"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            )}
                            {!readOnly && (
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-stone-500 w-10 shrink-0">تعديل</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                placeholder={String(row.completion_percent)}
                                onChange={(e) => setDrafts((d) => ({ ...d, [overrideKey]: e.target.value }))}
                                className="w-16 border border-[#DED2AC] rounded px-1.5 py-1 text-[11px]"
                              />
                              <button
                                type="button"
                                disabled={savingId === row.id || !drafts[overrideKey]}
                                onClick={() => handleOverrideSave(row.id, drafts[overrideKey])}
                                className="text-[#3B4636] hover:text-[#4B5842] disabled:opacity-30"
                                title="حفظ نسبة الإنجاز يدوياً"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!readOnly && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-[#DED2AC] mt-1">
                      <input
                        type="text"
                        placeholder="اسم قياس جديد (مثال: كما هو منفذ)"
                        value={newMeasure[building.id]?.name ?? ''}
                        onChange={(e) =>
                          setNewMeasure((m) => ({ ...m, [building.id]: { name: e.target.value, weight: m[building.id]?.weight ?? '' } }))
                        }
                        className="flex-1 border border-[#DED2AC] rounded px-2 py-1.5 text-[11px] bg-white"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="الوزن"
                        value={newMeasure[building.id]?.weight ?? ''}
                        onChange={(e) =>
                          setNewMeasure((m) => ({ ...m, [building.id]: { name: m[building.id]?.name ?? '', weight: e.target.value } }))
                        }
                        className="w-16 border border-[#DED2AC] rounded px-1.5 py-1.5 text-[11px] bg-white"
                      />
                      <button
                        type="button"
                        disabled={busyBuildingId === building.id || !newMeasure[building.id]?.name || !newMeasure[building.id]?.weight}
                        onClick={() => handleAddMeasure(project.id, building.id)}
                        className="px-2 py-1.5 bg-[#3B4636] text-[#F2EEDD] rounded text-[11px] flex items-center gap-1 disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" /> إضافة قياس
                      </button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredProjects.every((p) => backendData.buildings.filter((b) => b.project_id === p.id).length === 0) && (
        <div className="text-center text-xs text-stone-500 py-10">
          {search ? 'لا توجد مشاريع مطابقة للبحث.' : 'لا توجد مبانٍ مضافة بعد. أضف مبنى من تبويب "المباني" لبدء تتبع نسب الإنجاز.'}
        </div>
      )}
    </div>
  );
};
