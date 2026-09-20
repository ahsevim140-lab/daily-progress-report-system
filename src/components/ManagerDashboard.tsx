import React, { useState } from 'react';
import { BackendData } from '../types';
import { ReportsView } from './manager/ReportsView';
import { ProgressView } from './manager/ProgressView';
import { UsersView } from './manager/UsersView';
import { ProjectsBuildingsView } from './manager/ProjectsBuildingsView';
import { EmployeesView } from './manager/EmployeesView';
import { DepartmentsView } from './manager/DepartmentsView';
import { TaskCategoriesView } from './manager/TaskCategoriesView';
import { AttendanceView } from './manager/AttendanceView';
import { ActivityView } from './manager/ActivityView';
import { HealthView } from './manager/HealthView';
import { FileText, BarChart3, UserCog, Briefcase, UserCheck, FolderKanban, ListTodo, CalendarDays, Activity, HeartPulse } from 'lucide-react';

type SubTab = 'reports' | 'progress' | 'users' | 'projects' | 'employees' | 'departments' | 'tasks' | 'attendance' | 'activity' | 'health';
export const ManagerDashboard: React.FC<{ backendData: BackendData; onRefreshData: () => void }> = ({ backendData, onRefreshData }) => {
  const [subTab, setSubTab] = useState<SubTab>('reports');
  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'reports', label: 'Reports', icon: <FileText className="w-3.5 h-3.5" /> }, { id: 'progress', label: 'Progress', icon: <BarChart3 className="w-3.5 h-3.5" /> }, { id: 'health', label: 'Health', icon: <HeartPulse className="w-3.5 h-3.5" /> }, { id: 'activity', label: 'Activity', icon: <Activity className="w-3.5 h-3.5" /> }, { id: 'attendance', label: 'Attendance', icon: <CalendarDays className="w-3.5 h-3.5" /> }, { id: 'projects', label: 'Project Setup', icon: <Briefcase className="w-3.5 h-3.5" /> }, { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-3.5 h-3.5" /> }, { id: 'employees', label: 'Employees', icon: <UserCheck className="w-3.5 h-3.5" /> }, { id: 'departments', label: 'Departments', icon: <FolderKanban className="w-3.5 h-3.5" /> }, { id: 'users', label: 'Users', icon: <UserCog className="w-3.5 h-3.5" /> },
  ];
  return <div className="space-y-5"><div className="flex flex-wrap items-center gap-2 bg-[#2C2A22]/50 p-1.5 rounded-xl border border-[#B89B5E]/30 shadow-inner">{tabs.map((t) => <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${subTab === t.id ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'}`}>{t.icon}<span>{t.label}</span></button>)}</div>
    {subTab === 'reports' && <ReportsView backendData={backendData} />}{subTab === 'progress' && <ProgressView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'health' && <HealthView backendData={backendData} />}{subTab === 'activity' && <ActivityView backendData={backendData} />}{subTab === 'attendance' && <AttendanceView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'projects' && <ProjectsBuildingsView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'tasks' && <TaskCategoriesView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'employees' && <EmployeesView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'departments' && <DepartmentsView backendData={backendData} onRefreshData={onRefreshData} />}{subTab === 'users' && <UsersView backendData={backendData} />}
  </div>;
};
