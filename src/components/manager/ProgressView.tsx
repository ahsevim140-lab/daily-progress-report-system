import React, { useState } from 'react';
import { BackendData } from '../../types';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, Lock } from 'lucide-react';

function weighted(rows: { weight_percent: number; completion_percent: number }[]) {
  const total = rows.reduce((s, r) => s + Number(r.weight_percent || 0), 0);
  return total ? Math.round((rows.reduce((s, r) => s + Number(r.weight_percent || 0) * Number(r.completion_percent || 0), 0) / total) * 10) / 10 : 0;
}

const Bar: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
    <div className="h-full bg-[#3B4636] rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const ProgressView: React.FC<{ backendData: BackendData; onRefreshData: () => void }> = ({ backendData }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleProject = (id: string) => setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xs">
        <Lock className="w-4 h-4" />Progress is read-only. Configure buildings, areas, tasks, and weights in Project Setup.
      </div>

      {backendData.projects.map((project) => {
        const buildings = backendData.buildings.filter((b) => b.project_id === project.id);
        const buildingValues = buildings.map((b) => ({ value: weighted(backendData.projectTasks.filter((t) => t.building_id === b.id)), weight: b.weight_percent || 0 }));
        const buildingWeight = buildingValues.reduce((s, b) => s + b.weight, 0);
        const projectPct = buildingWeight ? Math.round((buildingValues.reduce((s, b) => s + b.value * b.weight, 0) / buildingWeight) * 10) / 10 : 0;
        const isCollapsed = collapsed[project.id] === true;

        return (
          <div key={project.id} className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleProject(project.id)} className="w-full text-right p-5 hover:bg-[#F3EDDD]/60 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronDown className="w-5 h-5 text-[#B89B5E]" /> : <ChevronUp className="w-5 h-5 text-[#B89B5E]" />}
                  <div className="text-right"><h4 className="font-serif font-bold text-[#3B4636]">{project.name}</h4><span className="text-[10px] text-stone-500">Status: {project.status} · {buildings.length} building(s)</span></div>
                </div>
                <div className="min-w-40 text-left"><div className="flex items-center justify-between text-[10px] text-stone-500 mb-1"><span>Project progress</span><strong className="text-base text-[#3B4636]">{projectPct}%</strong></div><Bar value={projectPct} /></div>
              </div>
            </button>

            {!isCollapsed && <div className="px-5 pb-5 space-y-4">
              {Math.abs(buildingWeight - 100) > 0.01 && <div className="flex items-center gap-1.5 text-[11px] text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />Building weights total {buildingWeight}%. Configure them in Project Setup.</div>}
              {buildings.map((building) => {
                const rows = backendData.projectTasks.filter((t) => t.building_id === building.id);
                const pct = weighted(rows);
                return <div key={building.id} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-4 space-y-3"><div className="flex justify-between text-xs font-bold text-[#3B4636]"><span>{building.name}</span><span>{pct}% · project weight {building.weight_percent || 0}%</span></div><Bar value={pct} /><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{rows.length ? rows.map((row) => <div key={row.id} className="bg-white border border-[#DED2AC] rounded-lg p-2.5"><div className="flex justify-between text-[11px] font-semibold"><span>{row.department} {row.task && `— ${row.task}`}</span><span>{row.completion_percent}%</span></div><div className="flex flex-wrap gap-2 text-[10px] text-stone-500 mt-1"><span>Status: {row.status}</span><span>Weight: {row.weight_percent}%</span>{row.assigned_employee_name && <span>Assigned: {row.assigned_employee_name}</span>}{row.planned_finish && <span>Due: {row.planned_finish}</span>}</div><Bar value={row.completion_percent} /></div>) : <div className="text-xs text-stone-500 flex items-center gap-2"><Eye className="w-4 h-4" />No tasks assigned yet.</div>}</div></div>;
              })}
            </div>}
          </div>
        );
      })}
      {!backendData.projects.length && <div className="text-center text-xs text-stone-500 py-10">No projects available.</div>}
    </div>
  );
};
