import React, { useEffect, useState } from 'react';
import { BackendData, Profile } from './types';
import { fetchBackendData } from './services/supabaseService';
import { supabase, offlineMode } from './lib/supabase';
import { AuthGate } from './components/AuthGate';
import { ReportForm } from './components/ReportForm';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TeamLeaderDashboard } from './components/TeamLeaderDashboard';
import { MyTasksView } from './components/MyTasksView';
import { FileText, ShieldCheck, LogOut, Users, DatabaseZap } from 'lucide-react';
import { getCurrentProfile, signOut } from './services/supabaseService';

const EMPTY_DATA: BackendData = {
  projects: [],
  projectAssignments: [],
  employees: [],
  taskCategories: [],
  departments: [],
  buildings: [],
  areas: [],
  projectTasks: [],
  activities: [],
  reportBatches: [],
  reportSnapshots: [],
  attendance: [],
  loginAudits: [],
};

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const role = profile?.role ?? null;
  const currentUserId = profile?.id ?? null;
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard' | 'tasks'>('form');

  const [backendData, setBackendData] = useState<BackendData>(EMPTY_DATA);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const loadEverything = async () => {
    const currentProfile = await getCurrentProfile();
    if (!currentProfile) {
      await signOut();
      setProfile(null);
      setAuthenticated(false);
      setBackendData(EMPTY_DATA);
      return;
    }
    setProfile(currentProfile);
    setAuthenticated(true);

    setDataLoading(true);
    setDataError('');
    try {
      const data = await fetchBackendData();
      setBackendData(data);
    } catch (err: any) {
      setDataError(err.message || 'تعذر تحميل بيانات النظام.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        loadEverything();
      } else {
        setAuthenticated(false);
      }
      setCheckingSession(false);
    });
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setAuthenticated(false);
    setProfile(null);
    setBackendData(EMPTY_DATA);
    setActiveTab('form');
  };

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-[#EFE8D6] text-[#3B4636] text-sm">جارٍ التحميل...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#EFE8D6] text-[#2C2A22] font-sans antialiased selection:bg-[#B89B5E] selection:text-white">
      {offlineMode && (
        <div className="bg-amber-500 text-stone-900 text-[11px] font-bold py-1.5 px-4 flex items-center justify-center gap-2" role="status">
          <DatabaseZap className="w-3.5 h-3.5" />
          OFFLINE / DEMO MODE — data lives only in this browser and is not shared or backed up
        </div>
      )}
      {!authenticated && <AuthGate onAuthenticated={loadEverything} />}

      {authenticated && (
        <div className="min-h-screen flex flex-col">
          <header className="relative bg-[#3B4636] text-[#F2EEDD] px-6 py-6 border-b border-[#B89B5E]/30 shadow-md">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center md:text-right">
                <div className="w-12 h-12 rounded-xl bg-[#B89B5E]/20 border border-[#B89B5E]/50 flex items-center justify-center text-[#D8C48F] shrink-0">
                  <FileText className="w-6 h-6 text-[#D8C48F]" />
                </div>
                <div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight text-[#EFE8D6]">
                    سجل التقارير اليومية
                  </h1>
                  <p className="text-xs text-[#D8C48F]/90 font-medium tracking-wide mt-0.5">
                    نظام إدارة المتابعة وتقارير الإنجاز اليومية للمشاريع
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {role && (
                  <div className="flex items-center gap-2 bg-[#2C2A22]/50 p-1.5 rounded-xl border border-[#B89B5E]/30 shadow-inner">
                    <button
                      onClick={() => setActiveTab('form')}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'form' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>نموذج التقرير</span>
                    </button>
                    {role === 'employee' && <button
                      onClick={() => setActiveTab('tasks')}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'}`}
                    >
                      <Users className="w-3.5 h-3.5" /><span>My Projects</span>
                    </button>}
                    {role !== 'employee' && <button
                      onClick={() => setActiveTab('dashboard')}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'dashboard' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
                      }`}
                    >
                      {role === 'manager' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      <span>{role === 'manager' ? 'Manager Dashboard' : 'Team Leader Dashboard'}</span>
                    </button>}
                  </div>
                )}

                <button
                  onClick={handleSignOut}
                  className="p-2.5 rounded-xl border border-[#B89B5E]/40 text-[#D8C48F] hover:bg-white/10"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="bg-[#3B4636] py-1.5 flex items-center justify-center gap-4 border-t border-[#B89B5E]/20">
            <div className="h-px w-28 bg-[#B89B5E]/50" />
            <div className="w-2 h-2 border border-[#B89B5E] rotate-45" />
            <div className="h-px w-28 bg-[#B89B5E]/50" />
          </div>

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
            {dataError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">{dataError}</div>
            )}
            {dataLoading && backendData.projects.length === 0 ? (
              <div className="text-center text-xs text-stone-500 py-16">جارٍ تحميل البيانات...</div>
            ) : activeTab === 'form' || !role ? (
              <div className="max-w-3xl mx-auto">
                <ReportForm backendData={backendData} profile={profile} />
              </div>
            ) : activeTab === 'tasks' && role === 'employee' ? (
              <MyTasksView backendData={backendData} profile={profile} />
            ) : role === 'manager' ? (
              <ManagerDashboard backendData={backendData} onRefreshData={loadEverything} />
            ) : (
              <TeamLeaderDashboard backendData={backendData} currentUserId={currentUserId} onRefreshData={loadEverything} />
            )}
          </main>

          <footer className="bg-[#2C2A22] text-[#D8C48F]/80 text-xs py-4 px-6 border-t border-[#B89B5E]/30 text-center">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>جميع الحقوق محفوظة © {new Date().getFullYear()} - نظام إدارة المتابعة والتقارير اليومية</span>
              <span className="text-[11px] text-[#D8C48F]/60 font-mono">ENG LOG v5.0 • {offlineMode ? 'Offline model' : 'Supabase'}</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
