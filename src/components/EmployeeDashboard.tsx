import React, { useEffect, useMemo, useState } from 'react';
import { BackendData } from '../types';
import { fetchMyAssignedProjectIds } from '../services/supabaseService';
import { ProgressView } from './manager/ProgressView';
import { ReportsView } from './manager/ReportsView';
import { FileText, BarChart3, Briefcase } from 'lucide-react';

interface EmployeeDashboardProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

type SubTab = 'progress' | 'reports';

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ backendData, onRefreshData }) => {
  const [subTab, setSubTab] = useState<SubTab>('progress');
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetchMyAssignedProjectIds().then(setAssignedProjectIds).catch(() => setAssignedProjectIds([]));
  }, []);

  const myBackendData: BackendData = useMemo(() => {
    const ids = new Set(assignedProjectIds || []);
    const myProjects = backendData.projects.filter((p) => ids.has(p.id));
    const myBuildings = backendData.buildings.filter((b) => ids.has(b.project_id));
    const myBuildingIds = new Set(myBuildings.map((b) => b.id));
    const myProjectTasks = backendData.projectTasks.filter((t) => myBuildingIds.has(t.building_id));
    return { ...backendData, projects: myProjects, buildings: myBuildings, projectTasks: myProjectTasks };
  }, [backendData, assignedProjectIds]);

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'progress', label: 'نسب الإنجاز', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'التقارير', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  if (assignedProjectIds !== null && assignedProjectIds.length === 0) {
    return (
      <div className="text-center text-xs text-stone-500 py-16 flex flex-col items-center gap-2">
        <Briefcase className="w-6 h-6 text-stone-300" />
        لم يتم تكليفك بأي مشروع بعد. سيقوم المدير بإسناد المشاريع التي تعمل عليها إلى حسابك.
      </div>
    );
  }

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

      {subTab === 'progress' && <ProgressView backendData={myBackendData} onRefreshData={onRefreshData} readOnly />}
      {subTab === 'reports' && <ReportsView backendData={myBackendData} />}
    </div>
  );
};
