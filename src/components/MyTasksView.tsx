import React, { useMemo } from 'react';
import { BackendData, Profile, ProjectTask } from '../types';
import { BarChart3, CheckCircle2, Clock3, FolderKanban, ListTodo } from 'lucide-react';

interface MyTasksViewProps {
  backendData: BackendData;
  profile: Profile | null;
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden">
      <div className="h-full bg-[#3B4636] transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function projectProgress(tasks: ProjectTask[]) {
  const totalWeight = tasks.reduce((sum, task) => sum + Math.max(0, task.weight_percent || 0), 0);
  if (totalWeight > 0) {
    return tasks.reduce((sum, task) => sum + task.completion_percent * Math.max(0, task.weight_percent || 0), 0) / totalWeight;
  }
  return tasks.length ? tasks.reduce((sum, task) => sum + task.completion_percent, 0) / tasks.length : 0;
}

// The employee comes from the signed-in profile; no manager-only endpoint is involved.
// A project appears here when it is assigned to this employee; only tasks from the
// employee's department are shown.
export const MyTasksView: React.FC<MyTasksViewProps> = ({ backendData, profile }) => {
  const employeeId = profile?.employee_id ?? null;
  const employee = employeeId ? backendData.employees.find((item) => item.id === employeeId) : undefined;
  const assignedProjectIds = new Set(backendData.projectAssignments.filter((assignment) => assignment.employee_id === employeeId).map((assignment) => assignment.project_id));
  const assignedTasks = employeeId
    ? backendData.projectTasks.filter((task) => assignedProjectIds.has(task.project_id) && task.department === employee?.department)
    : [];

  const assignedProjects = useMemo(() => {
    const grouped = new Map<string, ProjectTask[]>();
    assignedTasks.forEach((task) => {
      const current = grouped.get(task.project_id) ?? [];
      current.push(task);
      grouped.set(task.project_id, current);
    });

    return [...grouped.entries()]
      .map(([projectId, tasks]) => ({
        project: backendData.projects.find((project) => project.id === projectId),
        tasks,
        progress: projectProgress(tasks),
      }))
      .filter((group) => group.project)
      .sort((a, b) => a.project!.name.localeCompare(b.project!.name));
  }, [assignedTasks, backendData.projects]);

  return (
    <div className="space-y-5">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5">
        <div className="flex items-center gap-2 text-[#3B4636] font-bold">
          <FolderKanban className="w-5 h-5 text-[#B89B5E]" />
          <span>My Projects</span>
        </div>
        <p className="text-xs text-stone-500 mt-1">
          Projects that contain tasks assigned to you, with the current progress of your assigned work.
        </p>
      </div>

      {!employeeId && (
        <div className="text-center text-xs text-amber-700 py-10">
          Your account is not linked to an employee record yet.
        </div>
      )}

      {employeeId && !assignedProjects.length && (
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-xl p-8 text-center text-xs text-stone-500">
          No projects or tasks are currently assigned to you.
        </div>
      )}

      {assignedProjects.map(({ project, tasks, progress }) => (
        <section key={project!.id} className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-lg text-[#3B4636]">{project!.name}</h2>
                <span className="text-[10px] rounded-full px-2 py-1 bg-[#F3EDDD] text-stone-600">{project!.status}</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">{tasks.length} assigned task{tasks.length === 1 ? '' : 's'}</p>
            </div>
            <div className="min-w-40 text-left">
              <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />Assigned project progress</span>
                <strong className="text-base text-[#3B4636]">{Math.round(progress)}%</strong>
              </div>
              <ProgressBar value={progress} />
            </div>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => {
              const building = backendData.buildings.find((item) => item.id === task.building_id);
              return (
                <div key={task.id} className="bg-white border border-[#DED2AC] rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3B4636]">
                      <ListTodo className="w-4 h-4 text-[#B89B5E]" />
                      <span>{task.task || task.department || 'Unnamed task'}</span>
                    </div>
                    <span className="text-xs font-bold text-[#3B4636]">{task.completion_percent}%</span>
                  </div>
                  <ProgressBar value={task.completion_percent} />
                  <div className="flex flex-wrap gap-3 text-[10px] text-stone-500">
                    <span>{building?.name || 'Building not specified'}</span>
                    <span>{task.department}</span>
                    <span className="flex items-center gap-1">
                      {task.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock3 className="w-3.5 h-3.5" />}
                      {task.status}
                    </span>
                    {task.planned_finish && <span>Due: {task.planned_finish}</span>}
                    <span>Priority: {task.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
