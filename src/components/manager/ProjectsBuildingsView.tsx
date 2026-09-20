import React, { useState } from 'react';
import { BackendData, ProjectStatus } from '../../types';
import {
  addArea, addBuilding, addProject, addProjectTask, deleteArea, deleteBuilding,
  deleteProject, deleteProjectTask, setProjectTaskWeight, updateBuildingWeight, updateProject,
  updateProjectTaskDetails,
} from '../../services/supabaseService';
import { Briefcase, Building, Plus, Trash2, Settings2 } from 'lucide-react';

const statuses: Record<ProjectStatus, string> = {
  draft: 'Draft', ready: 'Ready for use', running: 'Running', stopped: 'Stopped',
  not_wanted: 'Not wanted', completed: 'Completed',
};

export const ProjectsBuildingsView: React.FC<{
  backendData: BackendData;
  onRefreshData: () => void;
}> = ({ backendData, onRefreshData }) => {
  const [projectName, setProjectName] = useState('');
  const [openProject, setOpenProject] = useState<string | null>(backendData.projects[0]?.id || null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };
  const run = async (fn: () => Promise<void>, success: string) => {
    setSaving(true);
    try { await fn(); notify(success); onRefreshData(); }
    catch (e: any) { notify('Error: ' + (e.message || e)); }
    finally { setSaving(false); }
  };
  const setDraft = (key: string, value: string) => setDrafts((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-white rounded-xl text-xs">{msg}</div>}
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] border-b border-[#DED2AC] pb-3">
          <Settings2 className="w-4 h-4 text-[#B89B5E]" />Project Setup
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!projectName.trim()) return;
          run(async () => { await addProject(projectName.trim(), 'draft'); setProjectName(''); }, 'Draft project created.');
        }} className="flex gap-2 max-w-xl">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="New project name..." className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs" />
          <button disabled={saving} className="px-3 py-2 bg-[#3B4636] text-white rounded-xl text-xs"><Plus className="w-3.5 h-3.5 inline" /> Create draft</button>
        </form>

        <div className="space-y-4">
          {backendData.projects.map((project) => {
            const buildings = backendData.buildings.filter((b) => b.project_id === project.id);
            const buildingWeight = buildings.reduce((sum, b) => sum + Number(b.weight_percent || 0), 0);
            const isOpen = openProject === project.id;
            return (
              <div key={project.id} className="border border-[#DED2AC] rounded-xl overflow-hidden">
                <button onClick={() => setOpenProject(isOpen ? null : project.id)} className="w-full text-right bg-[#F3EDDD] p-4 flex flex-wrap justify-between items-center gap-2">
                  <span className="font-bold text-[#3B4636] flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#B89B5E]" />{project.name}</span>
                  <span className="text-xs">{statuses[project.status]} · Building weights: {buildingWeight}%</span>
                </button>
                {isOpen && (
                  <div className="p-4 space-y-4 bg-[#FBF8EF]">
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={project.status} onChange={(e) => run(() => updateProject(project.id, { status: e.target.value as ProjectStatus }), 'Lifecycle status updated.')} className="bg-white border border-[#DED2AC] rounded-lg px-2 py-1.5 text-xs">
                        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <span className="text-[10px] text-stone-500">Configure tasks and weights before publishing.</span>
                      <button onClick={() => run(() => deleteProject(project.id), 'Project deleted.')} className="mr-auto text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {buildings.map((building) => {
                      const areas = backendData.areas.filter((a) => a.building_id === building.id);
                      const tasks = backendData.projectTasks.filter((t) => t.building_id === building.id);
                      const taskWeight = tasks.reduce((sum, t) => sum + Number(t.weight_percent || 0), 0);
                      const taskOptions = backendData.taskCategories.flatMap((c) => c.subs.map((task) => ({ task, category: c.main })));
                      const areaKey = `area-${building.id}`;
                      const deptKey = `dept-${building.id}`;
                      const taskKey = `task-${building.id}`;
                      return (
                        <div key={building.id} className="border border-[#DED2AC] rounded-xl p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-xs text-[#3B4636] flex items-center gap-2"><Building className="w-4 h-4 text-[#B89B5E]" />{building.name}</span>
                            <span className="text-[10px] text-stone-500">Task weights: {taskWeight}%</span>
                            <button onClick={() => run(() => deleteBuilding(building.id), 'Building deleted.')} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <label className="flex items-center gap-2 text-xs">Building weight
                            <input type="number" min="0" max="100" defaultValue={building.weight_percent || 0} onBlur={(e) => run(() => updateBuildingWeight(building.id, Number(e.target.value)), 'Building weight saved.')} className="w-20 bg-white border border-[#DED2AC] rounded px-2 py-1" />%
                          </label>

                          <div>
                            <div className="text-[11px] font-bold text-[#3B4636] mb-2">Areas (organizational only)</div>
                            <div className="flex flex-wrap gap-2">
                              {areas.map((area) => <span key={area.id} className="px-2 py-1 bg-white border border-[#DED2AC] rounded-lg text-xs">{area.name}<button onClick={() => run(() => deleteArea(area.id), 'Area deleted.')} className="text-red-500 mr-1">×</button></span>)}
                              <form onSubmit={(e) => { e.preventDefault(); const name = drafts[areaKey]?.trim(); if (!name) return; run(async () => { await addArea(building.id, name); setDraft(areaKey, ''); }, 'Area added.'); }} className="inline-flex gap-1">
                                <input value={drafts[areaKey] || ''} onChange={(e) => setDraft(areaKey, e.target.value)} placeholder="Add area" className="w-28 bg-white border border-[#DED2AC] rounded px-2 py-1 text-xs" />
                                <button className="text-[#3B4636]"><Plus className="w-3.5 h-3.5" /></button>
                              </form>
                            </div>
                          </div>

                          <div>
                            <div className="text-[11px] font-bold text-[#3B4636] mb-2">Assigned tasks — multiple tasks per department</div>
                            <div className="space-y-2">
                              {tasks.map((row) => <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center bg-white border border-[#DED2AC] rounded-lg p-2 text-xs">
                                <span>{row.department}</span><span className="font-medium">{row.task || 'Unselected task'}</span>
                                <select defaultValue={row.assigned_employee_id || ''} onChange={(e) => run(() => updateProjectTaskDetails(row.id, { assigned_employee_id: e.target.value || null }), 'Assignment saved.')} className="border border-[#DED2AC] rounded px-2 py-1"><option value="">Unassigned</option>{backendData.employees.filter((e) => e.department === row.department).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                                <select defaultValue={row.status || 'not_started'} onChange={(e) => run(() => updateProjectTaskDetails(row.id, { status: e.target.value as any }), 'Task status saved.')} className="border border-[#DED2AC] rounded px-2 py-1"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="under_review">Under review</option><option value="revision_required">Revision required</option><option value="completed">Completed</option><option value="on_hold">On hold</option></select>
                                <input type="date" defaultValue={row.planned_finish || ''} onBlur={(e) => run(() => updateProjectTaskDetails(row.id, { planned_finish: e.target.value || null }), 'Due date saved.')} className="border border-[#DED2AC] rounded px-2 py-1" title="Planned finish" />
                                <div className="flex items-center gap-2"><input type="number" min="0" max="100" defaultValue={row.weight_percent} onBlur={(e) => run(() => setProjectTaskWeight(row.id, Number(e.target.value)), 'Task weight saved.')} className="w-20 border border-[#DED2AC] rounded px-2 py-1" /><button onClick={() => run(() => deleteProjectTask(row.id), 'Task removed.')} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                              </div>)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                              <select value={drafts[deptKey] || ''} onChange={(e) => setDraft(deptKey, e.target.value)} className="bg-white border border-[#DED2AC] rounded px-2 py-1 text-xs"><option value="">Choose department...</option>{backendData.departments.map((d) => <option key={d}>{d}</option>)}</select>
                              <select value={drafts[taskKey] || ''} onChange={(e) => setDraft(taskKey, e.target.value)} className="bg-white border border-[#DED2AC] rounded px-2 py-1 text-xs"><option value="">Choose task...</option>{taskOptions.map((o) => <option key={`${o.category}-${o.task}`} value={`${o.category}|||${o.task}`}>{o.category} — {o.task}</option>)}</select>
                              <button onClick={() => { const dept = drafts[deptKey]; const raw = drafts[taskKey]; if (!dept || !raw) return; const [category, task] = raw.split('|||'); run(async () => { await addProjectTask({ project_id: project.id, building_id: building.id, department: dept, category, task, priority: 'normal', status: 'not_started', weight_percent: 0, completion_percent: 0 }); setDraft(taskKey, ''); }, 'Task assigned.'); }} className="bg-[#3B4636] text-white rounded px-2 py-1 text-xs"><Plus className="w-3.5 h-3.5 inline" /> Assign task</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => run(async () => { await addBuilding(project.id, `Building ${buildings.length + 1}`); }, 'Building added.')} className="px-3 py-2 border border-dashed border-[#B89B5E] rounded-lg text-xs text-[#3B4636]"><Plus className="w-3.5 h-3.5 inline" /> Add building</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
