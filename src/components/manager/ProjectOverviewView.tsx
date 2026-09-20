import React, { useMemo, useState } from 'react';
import { BackendData } from '../../types';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock3, Users } from 'lucide-react';
import { todayLocalYMD } from '../../utils';

function weighted(rows: { weight_percent: number; completion_percent: number }[]) {
  const total = rows.reduce((sum, row) => sum + Number(row.weight_percent || 0), 0);
  return total ? Math.round((rows.reduce((sum, row) => sum + Number(row.weight_percent || 0) * Number(row.completion_percent || 0), 0) / total) * 10) / 10 : 0;
}
function ageInDays(value?: string) { return value ? Math.floor((Date.now() - new Date(value).getTime()) / 86400000) : 999; }
const Bar: React.FC<{ value: number }> = ({ value }) => <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-[#3B4636] rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;

export const ProjectOverviewView: React.FC<{ backendData: BackendData }> = ({ backendData }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const today = todayLocalYMD();
  const overview = useMemo(() => backendData.projects.map((project) => {
    const buildings = backendData.buildings.filter((building) => building.project_id === project.id);
    const tasks = backendData.projectTasks.filter((task) => task.project_id === project.id);
    const buildingValues = buildings.map((building) => ({ building, rows: tasks.filter((task) => task.building_id === building.id), area: backendData.areas.filter((area) => area.building_id === building.id).reduce((sum, area) => sum + Number(area.area_m2 || 0), 0) }));
    const totalArea = buildingValues.reduce((sum, item) => sum + item.area, 0);
    const progress = totalArea ? buildingValues.reduce((sum, item) => sum + weighted(item.rows) * item.area, 0) / totalArea : weighted(tasks);
    const overdue = tasks.filter((task) => task.planned_finish && task.planned_finish < today && !['completed', 'cancelled'].includes(task.status));
    const blocked = tasks.filter((task) => task.status === 'blocked');
    const stale = tasks.filter((task) => ageInDays(task.updated_at) > 3 && !['completed', 'cancelled'].includes(task.status));
    const staff = new Set(tasks.map((task) => task.assigned_employee_id).filter(Boolean));
    return { project, buildings: buildingValues, tasks, totalArea, progress, overdue, blocked, stale, staff };
  }), [backendData, today]);

  return <div className="space-y-4">
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[#3B4636] font-bold"><BarChart3 className="w-5 h-5 text-[#B89B5E]" />Project Overview</div>
      <p className="text-xs text-stone-500 mt-1">Progress, building breakdown, and items requiring attention in one view.</p>
    </div>
    {overview.map(({ project, buildings, tasks, totalArea, progress, overdue, blocked, stale, staff }) => {
      const isOpen = expanded[project.id] !== false;
      return <section key={project.id} className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl overflow-hidden">
        <button onClick={() => setExpanded((current) => ({ ...current, [project.id]: !isOpen }))} className="w-full text-right p-5 hover:bg-[#F3EDDD]/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">{isOpen ? <ChevronUp className="w-4 h-4 text-[#B89B5E]" /> : <ChevronDown className="w-4 h-4 text-[#B89B5E]" />}<div><h2 className="font-serif font-bold text-lg text-[#3B4636]">{project.name}</h2><span className="text-[10px] text-stone-500">{project.status} · {buildings.length} buildings · {totalArea} m²</span></div></div>
            <div className="w-52 text-left"><div className="flex justify-between text-[10px] text-stone-500 mb-1"><span>Overall progress</span><strong className="text-base text-[#3B4636]">{progress.toFixed(1)}%</strong></div><Bar value={progress} /></div>
          </div>
        </button>
        {isOpen && <div className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200"><div className="flex gap-1 text-red-700 text-[11px]"><AlertTriangle className="w-3.5 h-3.5" />Overdue</div><strong className="text-xl text-red-800">{overdue.length}</strong></div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200"><div className="flex gap-1 text-amber-700 text-[11px]"><Clock3 className="w-3.5 h-3.5" />Stale</div><strong className="text-xl text-amber-800">{stale.length}</strong></div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200"><div className="flex gap-1 text-orange-700 text-[11px]"><AlertTriangle className="w-3.5 h-3.5" />Blocked</div><strong className="text-xl text-orange-800">{blocked.length}</strong></div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200"><div className="flex gap-1 text-blue-700 text-[11px]"><Users className="w-3.5 h-3.5" />Assigned staff</div><strong className="text-xl text-blue-800">{staff.size}</strong></div>
          </div>
          <div className="space-y-2">{buildings.map(({ building, rows, area }) => <div key={building.id} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-4"><div className="flex justify-between text-xs font-bold text-[#3B4636] mb-2"><span>{building.name} <span className="font-normal text-stone-500">· {area} m² · {totalArea ? ((area / totalArea) * 100).toFixed(1) : '0.0'}% of project</span></span><span>{weighted(rows)}%</span></div><Bar value={weighted(rows)} /><div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">{rows.map((task) => <div key={task.id} className="bg-white border border-[#DED2AC] rounded-lg p-2 text-[11px]"><div className="flex justify-between"><span>{task.department}{task.task ? ` — ${task.task}` : ''}</span><strong>{task.completion_percent}%</strong></div><div className="text-[10px] text-stone-500 mt-1">{task.status}{task.assigned_employee_name ? ` · ${task.assigned_employee_name}` : ''}{task.planned_finish ? ` · due ${task.planned_finish}` : ''}</div><Bar value={task.completion_percent} /></div>)}{!rows.length && <span className="text-xs text-stone-500">No tasks assigned yet.</span>}</div></div>)}</div>
          <div className="border-t border-[#DED2AC] pt-3 text-xs">{!overdue.length && !blocked.length && !stale.length ? <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />No attention items detected.</span> : <div className="space-y-1">{[...overdue, ...blocked, ...stale].slice(0, 6).map((task) => <div key={`${task.id}-${task.status}`} className="flex justify-between gap-2"><span>{task.department} — {task.task || 'Unassigned task'}</span><span className="text-stone-500">{task.status}{task.planned_finish ? ` · due ${task.planned_finish}` : ''}</span></div>)}</div>}</div>
        </div>}
      </section>;
    })}
    {!overview.length && <div className="text-center text-xs text-stone-500 py-10">No projects available.</div>}
  </div>;
};
