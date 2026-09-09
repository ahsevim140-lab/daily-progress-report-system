import React, { useMemo, useState } from 'react';
import { BackendData } from '../types';
import { ReportsView } from './manager/ReportsView';
import { ProgressView } from './manager/ProgressView';
import { ProjectsView } from './manager/ProjectsView';
import { BuildingsView } from './manager/BuildingsView';
import { FileText, BarChart3, Briefcase } from 'lucide-react';

interface TeamLeaderDashboardProps {
  backendData: BackendData;
  currentUserId: string | null;
  onRefreshData: () => void;
}

type SubTab = 'reports' | 'projects' | 'progress';

export const TeamLeaderDashboard: React.FC<TeamLeaderDashboardProps> = ({ backendData, currentUserId, onRefreshData }) => {
  const [subTab, setSubTab] = useState<SubTab>('reports');

  // "My projects" scope: only projects this team leader created, and
  // everything hanging off them. Reports are already scoped server-side
  // (own team OR own projects) by RLS, so ReportsView needs no filtering.
  const myBackendData: BackendData = useMemo(() => {
    const myProjectIds = new Set(
      backendData.projects.filter((p) => p.created_by === currentUserId).map((p) => p.id)
    );
    const myProjects = backendData.projects.filter((p) => myProjectIds.has(p.id));
    const myBuildings = backendData.buildings.filter((b) => myProjectIds.has(b.project_id));
    const myBuildingIds = new Set(myBuildings.map((b) => b.id));
    const myProjectTasks = backendData.projectTasks.filter((t) => myBuildingIds.has(t.building_id));
    return {
      ...backendData,
      projects: myProjects,
      buildings: myBuildings,
      projectTasks: myProjectTasks,
    };
  }, [backendData, currentUserId]);

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'reports', label: 'التقارير', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'projects', label: 'مشاريعي', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'progress', label: 'نسب الإنجاز', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 bg-[#2C2A22]/50 p-1.5 rounded-xl border border-[#B89B5E]/30 shadow-inner w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              subTab === t.id ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {subTab === 'reports' && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 px-1">
            تظهر هنا تقارير أعضاء فريقك، وتقارير مشاريعك الخاصة من أي موظف.
          </p>
          <ReportsView backendData={backendData} />
        </div>
      )}

      {subTab === 'projects' && (
        <div className="space-y-6">
          <ProjectsView backendData={myBackendData} onRefreshData={onRefreshData} />
          <BuildingsView backendData={myBackendData} onRefreshData={onRefreshData} />
        </div>
      )}

      {subTab === 'progress' && (
        <ProgressView backendData={myBackendData} onRefreshData={onRefreshData} />
      )}
    </div>
  );
};
