import React, { useMemo, useState } from 'react';
import { BackendData, Role } from '../../types';
import { CalendarDays, Clock3, LogIn, Search, UserCheck } from 'lucide-react';

const roleLabels: Record<Role, string> = { employee: 'Employee', team_leader: 'Team Leader', manager: 'Manager' };
function formatTimestamp(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export const ActivityView: React.FC<{ backendData: BackendData }> = ({ backendData }) => {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const audits = useMemo(() => backendData.loginAudits.filter((audit) => {
    const haystack = `${audit.username} ${audit.display_name} ${roleLabels[audit.role]}`.toLowerCase();
    return (!role || audit.role === role) && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [backendData.loginAudits, query, role]);
  return <div className="space-y-4">
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 space-y-2">
      <div className="flex items-center gap-2 text-[#3B4636] font-bold"><LogIn className="w-5 h-5 text-[#B89B5E]" />Login Activity</div>
      <p className="text-xs text-stone-500">Successful sign-ins recorded by the system. Failed login attempts are not stored.</p>
      <div className="flex flex-wrap gap-2 pt-2"><div className="relative flex-1 min-w-56"><Search className="absolute right-2 top-2 w-4 h-4 text-stone-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username or name..." className="w-full bg-white border border-[#DED2AC] rounded-lg px-8 py-2 text-xs" /></div><select value={role} onChange={(e) => setRole(e.target.value)} className="bg-white border border-[#DED2AC] rounded-lg px-3 py-2 text-xs"><option value="">All roles</option><option value="manager">Managers</option><option value="team_leader">Team leaders</option><option value="employee">Employees</option></select></div>
    </div>
    <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 font-bold text-[#3B4636] text-sm"><Clock3 className="w-4 h-4 text-[#B89B5E]" />Recent sign-ins <span className="text-[10px] text-stone-500 font-normal">{audits.length} records</span></div>
      {audits.map((audit) => <div key={audit.id} className="flex flex-wrap items-center justify-between gap-3 bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#3B4636] text-[#F2EEDD] flex items-center justify-center"><UserCheck className="w-4 h-4" /></div><div><div className="text-xs font-bold text-[#3B4636]">{audit.display_name}</div><div className="text-[11px] text-stone-500">@{audit.username} · {roleLabels[audit.role]}{audit.employee_id ? ` · linked employee` : ''}</div></div></div><div className="text-[11px] text-stone-600 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-[#B89B5E]" />{formatTimestamp(audit.logged_in_at)}</div></div>)}
      {!audits.length && <div className="text-center text-xs text-stone-500 py-10">No login records match the filters.</div>}
    </div>
  </div>;
};
