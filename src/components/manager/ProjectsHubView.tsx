import React, { useEffect, useState } from 'react';
import { BackendData } from '../../types';
import {
  addProject,
  updateProject,
  deleteProject,
  addBuilding,
  updateBuilding,
  deleteBuilding,
  fetchAssignments,
  assignEmployeeToProject,
  unassignEmployeeFromProject,
  AssignmentRow,
} from '../../services/supabaseService';
import { Plus, Briefcase, Building, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, Users } from 'lucide-react';

interface ProjectsHubViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const ProjectsHubView: React.FC<ProjectsHubViewProps> = ({ backendData, onRefreshData }) => {
  const [newProject, setNewProject] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editingBuildingName, setEditingBuildingName] = useState('');
  const [pickEmployee, setPickEmployee] = useState('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

  const loadAssignments = async () => {
    try {
      setAssignments(await fetchAssignments());
    } catch (err: any) {
      notify('خطأ في تحميل التكليفات: ' + (err.message || err));
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

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

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setNewBuildingName('');
    setPickEmployee('');
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}

      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-4">
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

        <div className="space-y-2">
          {backendData.projects.map((project) => {
            const isExpanded = expandedId === project.id;
            const buildings = backendData.buildings.filter((b) => b.project_id === project.id);
            const projectAssignments = assignments.filter((a) => a.project_id === project.id);
            const assignedEmployeeIds = new Set(projectAssignments.map((a) => a.employee_id));
            const availableEmployees = backendData.employees.filter((e) => !assignedEmployeeIds.has(e.id));

            return (
              <div key={project.id} className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  {editingProjectId === project.id ? (
                    <>
                      <input
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1 text-xs ml-2"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <button
                          disabled={saving || !editingProjectName.trim()}
                          onClick={() => withSaving(async () => {
                            await updateProject(project.id, editingProjectName.trim());
                            setEditingProjectId(null);
                          }, 'تم تحديث اسم المشروع.')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingProjectId(null)} className="text-stone-400 hover:text-stone-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={() => toggleExpand(project.id)} className="flex-1 flex items-center gap-2 text-right text-xs font-semibold text-stone-900">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#B89B5E]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#B89B5E]" />}
                        {project.name}
                        <span className="text-[10px] text-stone-500 font-normal">
                          ({buildings.length} مبنى · {projectAssignments.length} موظف مكلّف)
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingProjectId(project.id); setEditingProjectName(project.name); }} className="text-stone-400 hover:text-[#3B4636]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => withSaving(async () => { await deleteProject(project.id); }, 'تم حذف المشروع.')}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-[#DED2AC] bg-white p-4 space-y-4">
                    {/* Buildings */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#3B4636] uppercase tracking-wider">
                        <Building className="w-3.5 h-3.5 text-[#B89B5E]" /> المباني
                      </div>
                      <div className="space-y-1.5">
                        {buildings.map((b) => (
                          <div key={b.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
                            {editingBuildingId === b.id ? (
                              <>
                                <input
                                  value={editingBuildingName}
                                  onChange={(e) => setEditingBuildingName(e.target.value)}
                                  className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1 text-xs ml-2"
                                  autoFocus
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    disabled={saving || !editingBuildingName.trim()}
                                    onClick={() => withSaving(async () => {
                                      await updateBuilding(b.id, editingBuildingName.trim());
                                      setEditingBuildingId(null);
                                    }, 'تم تحديث اسم المبنى.')}
                                    className="text-emerald-600 hover:text-emerald-800"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingBuildingId(null)} className="text-stone-400 hover:text-stone-600">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-stone-900">{b.name}</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => { setEditingBuildingId(b.id); setEditingBuildingName(b.name); }} className="text-stone-400 hover:text-[#3B4636]">
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
                        {buildings.length === 0 && <div className="text-[11px] text-stone-400 text-center py-2">لا توجد مبانٍ بعد.</div>}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newBuildingName.trim()) return;
                          withSaving(async () => {
                            await addBuilding(project.id, newBuildingName.trim(), backendData.departments);
                            setNewBuildingName('');
                          }, 'تمت إضافة المبنى بوزن موزّع بالتساوي بين الأقسام.');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          value={newBuildingName}
                          onChange={(e) => setNewBuildingName(e.target.value)}
                          placeholder="اسم مبنى جديد..."
                          className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button type="submit" disabled={saving} className="px-2.5 py-1.5 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs flex items-center gap-1">
                          <Plus className="w-3 h-3" /> إضافة
                        </button>
                      </form>
                    </div>

                    {/* Assigned employees */}
                    <div className="space-y-2 border-t border-[#DED2AC] pt-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#3B4636] uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-[#B89B5E]" /> الموظفون المكلّفون بهذا المشروع
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {projectAssignments.map((a) => {
                          const emp = backendData.employees.find((e) => e.id === a.employee_id);
                          return (
                            <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3EDDD] border border-[#DED2AC] rounded-lg text-xs">
                              {emp?.name || '—'}
                              <button
                                disabled={saving}
                                onClick={() => withSaving(async () => {
                                  await unassignEmployeeFromProject(a.id);
                                  await loadAssignments();
                                }, 'تم إلغاء التكليف.')}
                                className="text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                        {projectAssignments.length === 0 && <span className="text-[11px] text-stone-400">لا يوجد موظفون مكلّفون بعد.</span>}
                      </div>
                      {availableEmployees.length > 0 && (
                        <div className="flex gap-2">
                          <select
                            value={pickEmployee}
                            onChange={(e) => setPickEmployee(e.target.value)}
                            className="flex-1 bg-white border border-[#DED2AC] rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="">اختر موظفاً لتكليفه...</option>
                            {availableEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>
                            ))}
                          </select>
                          <button
                            disabled={saving || !pickEmployee}
                            onClick={() => withSaving(async () => {
                              await assignEmployeeToProject(pickEmployee, project.id);
                              await loadAssignments();
                              setPickEmployee('');
                            }, 'تم تكليف الموظف بالمشروع.')}
                            className="px-2.5 py-1.5 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs disabled:opacity-40"
                          >
                            تكليف
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {backendData.projects.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-6">لا توجد مشاريع بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
};
