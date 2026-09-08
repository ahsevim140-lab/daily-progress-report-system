import React, { useState } from 'react';
import { BackendData } from '../types';
import { ReportsView } from './manager/ReportsView';
import { ProgressView } from './manager/ProgressView';
import { SetupView } from './manager/SetupView';
import { FileText, BarChart3, Settings } from 'lucide-react';

interface ManagerDashboardProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

type SubTab = 'reports' | 'progress' | 'setup';

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ backendData, onRefreshData }) => {
  const [subTab, setSubTab] = useState<SubTab>('reports');

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'reports', label: 'التقارير', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'progress', label: 'نسب الإنجاز', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'setup', label: 'إدارة القوائم', icon: <Settings className="w-3.5 h-3.5" /> },
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

      {subTab === 'reports' && <ReportsView backendData={backendData} />}
      {subTab === 'progress' && <ProgressView backendData={backendData} onRefreshData={onRefreshData} />}
      {subTab === 'setup' && <SetupView backendData={backendData} onRefreshData={onRefreshData} />}
    </div>
  );
};
