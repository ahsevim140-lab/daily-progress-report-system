import React, { useEffect, useState } from 'react';
import { BackendData, Role } from './types';
import { fetchBackendData } from './services/supabaseService';
import { supabase } from './lib/supabase';
import logoUrl from './assets/logo.png';
import { AuthGate } from './components/AuthGate';
import { ReportForm } from './components/ReportForm';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TeamLeaderDashboard } from './components/TeamLeaderDashboard';
import { FileText, ShieldCheck, LogOut, Users } from 'lucide-react';
import { getCurrentRole, getCurrentUserId, signOut } from './services/supabaseService';

const EMPTY_DATA: BackendData = {
  projects: [],
  employees: [],
  taskCategories: [],
  departments: [],
  buildings: [],
  projectTasks: [],
};

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>('form');

  const [backendData, setBackendData] = useState<BackendData>(EMPTY_DATA);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const loadEverything = async () => {
    const currentRole = await getCurrentRole();
    if (!currentRole) {
      await signOut();
      setRole(null);
      setCurrentUserId(null);
      setAuthenticated(false);
      setBackendData(EMPTY_DATA);
      return;
    }
    setRole(currentRole);
    setCurrentUserId(await getCurrentUserId());
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
    setRole(null);
    setCurrentUserId(null);
    setBackendData(EMPTY_DATA);
    setActiveTab('form');
  };

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-[#EFE8D6] text-[#3B4636] text-sm">جارٍ التحميل...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#EFE8D6] text-[#2C2A22] font-sans antialiased selection:bg-[#B89B5E] selection:text-white">
      {!authenticated && <AuthGate onAuthenticated={loadEverything} />}

      {authenticated && (
        <div className="min-h-screen flex flex-col">
          <header className="relative bg-[#3B4636] text-[#F2EEDD] px-6 py-6 border-b border-[#B89B5E]/30 shadow-md overflow-hidden">
            <img
              src={logoUrl}
              alt="شعار"
              className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 object-contain pointer-events-none opacity-95"
            />
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-center md:text-right">
                <img src={logoUrl} alt="شعار" className="w-10 h-10 object-contain md:hidden" />
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
                {(role === 'manager' || role === 'team_leader') && (
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
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'dashboard' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
                      }`}
                    >
                      {role === 'manager' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      <span>{role === 'manager' ? 'لوحة المدير' : 'لوحة قائد الفريق'}</span>
                    </button>
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
            ) : activeTab === 'form' || role === 'employee' || !role ? (
              <div className="max-w-3xl mx-auto">
                <ReportForm backendData={backendData} />
              </div>
            ) : role === 'manager' ? (
              <ManagerDashboard backendData={backendData} onRefreshData={loadEverything} />
            ) : (
              <TeamLeaderDashboard backendData={backendData} currentUserId={currentUserId} onRefreshData={loadEverything} />
            )}
          </main>

          <footer className="bg-[#2C2A22] text-[#D8C48F]/80 text-xs py-4 px-6 border-t border-[#B89B5E]/30 text-center">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>جميع الحقوق محفوظة © {new Date().getFullYear()} - نظام إدارة المتابعة والتقارير اليومية</span>
              <span className="text-[11px] text-[#D8C48F]/60 font-mono">ENG LOG v4.0 • Supabase</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
