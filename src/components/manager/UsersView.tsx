import React, { useEffect, useState } from 'react';
import { BackendData, Role } from '../../types';
import { manageUsers, AppUser } from '../../services/supabaseService';
import { Plus, KeyRound, UserCog, UserX } from 'lucide-react';

interface UsersViewProps {
  backendData: BackendData;
}

const roleLabel: Record<Role, string> = {
  employee: 'موظف',
  team_leader: 'قائد فريق',
  manager: 'مدير',
};

export const UsersView: React.FC<UsersViewProps> = ({ backendData }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('employee');
  const [newUserEmployeeId, setNewUserEmployeeId] = useState('');
  const [newUserTeamLeaderId, setNewUserTeamLeaderId] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

  const loadUsers = async () => {
    try {
      const result = await manageUsers('list');
      setUsers(result.users || []);
    } catch (err: any) {
      notify('خطأ في تحميل المستخدمين: ' + (err.message || err));
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const teamLeaders = users.filter((u) => u.role === 'team_leader');

  const handleEmployeeLinkChange = (employeeId: string) => {
    setNewUserEmployeeId(employeeId);
    const emp = backendData.employees.find((e) => e.id === employeeId);
    if (emp && !newUserDepartment) setNewUserDepartment(emp.department);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword || !newUserDisplayName.trim()) return;
    setSaving(true);
    try {
      await manageUsers('create', {
        username: newUsername.trim(),
        password: newPassword,
        display_name: newUserDisplayName.trim(),
        role: newUserRole,
        employee_id: newUserEmployeeId || null,
        team_leader_id: newUserRole === 'employee' ? newUserTeamLeaderId || null : null,
        department: newUserDepartment || null,
      });
      setNewUsername('');
      setNewPassword('');
      setNewUserDisplayName('');
      setNewUserRole('employee');
      setNewUserEmployeeId('');
      setNewUserTeamLeaderId('');
      setNewUserDepartment('');
      notify('تم إنشاء المستخدم بنجاح.');
      await loadUsers();
    } catch (err: any) {
      notify('خطأ: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (user: AppUser, changes: Record<string, unknown>, message: string) => {
    setSaving(true);
    try {
      await manageUsers('update', {
        id: user.id,
        display_name: user.display_name,
        role: user.role,
        active: user.active,
        employee_id: user.employee_id,
        team_leader_id: user.team_leader_id,
        department: user.department,
        ...changes,
      });
      notify(message);
      await loadUsers();
    } catch (err: any) {
      notify('خطأ: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}

      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#DED2AC] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider">
            <UserCog className="w-4 h-4 text-[#B89B5E]" />
            إدارة المستخدمين
          </div>
          <span className="text-[11px] text-stone-500">إنشاء حسابات الدخول من هنا — لا حاجة للبريد الإلكتروني</span>
        </div>

        <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-6 gap-2.5 bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-4">
          <input value={newUserDisplayName} onChange={(e) => setNewUserDisplayName(e.target.value)} placeholder="الاسم" className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs md:col-span-2" required />
          <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase())} placeholder="اسم المستخدم" className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs" required />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور" className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs" minLength={6} required />
          <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as Role)} className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
            <option value="employee">موظف</option>
            <option value="team_leader">قائد فريق</option>
            <option value="manager">مدير</option>
          </select>
          <select value={newUserEmployeeId} onChange={(e) => handleEmployeeLinkChange(e.target.value)} className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
            <option value="">ربط بموظف...</option>
            {backendData.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>)}
          </select>
          <select value={newUserDepartment} onChange={(e) => setNewUserDepartment(e.target.value)} className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
            <option value="">بدون قسم</option>
            {backendData.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {newUserRole === 'employee' && (
            <select value={newUserTeamLeaderId} onChange={(e) => setNewUserTeamLeaderId(e.target.value)} className="md:col-span-2 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
              <option value="">بدون قائد فريق</option>
              {teamLeaders.map((tl) => <option key={tl.id} value={tl.id}>{tl.display_name || tl.username}</option>)}
            </select>
          )}

          <button type="submit" disabled={saving} className="md:col-span-6 py-2.5 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> إضافة مستخدم
          </button>
        </form>

        <div className="space-y-2">
          {users.length === 0 ? (
            <div className="text-xs text-stone-500 text-center py-4">لا يوجد مستخدمون إضافيون.</div>
          ) : users.map((user) => (
            <div key={user.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-white border border-[#DED2AC] rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636]">
                  <span>{user.display_name || user.username}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{user.active ? 'نشط' : 'موقوف'}</span>
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  @{user.username} · {roleLabel[user.role]}
                  {user.department && <> · {user.department}</>}
                  {user.role === 'employee' && user.team_leader_id && (
                    <> · فريق: {teamLeaders.find((tl) => tl.id === user.team_leader_id)?.display_name || '—'}</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  disabled={saving}
                  value={user.department || ''}
                  onChange={(e) => updateUser(user, { department: e.target.value || null }, 'تم تحديث القسم.')}
                  className="px-2 py-2 rounded-lg border border-[#DED2AC] text-[11px] text-stone-600 bg-white disabled:opacity-50"
                >
                  <option value="">بدون قسم</option>
                  {backendData.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {user.role === 'employee' && (
                  <select
                    disabled={saving}
                    value={user.team_leader_id || ''}
                    onChange={(e) => updateUser(user, { team_leader_id: e.target.value || null }, 'تم تحديث قائد الفريق.')}
                    className="px-2 py-2 rounded-lg border border-[#DED2AC] text-[11px] text-stone-600 bg-white disabled:opacity-50"
                  >
                    <option value="">بدون قائد فريق</option>
                    {teamLeaders.map((tl) => <option key={tl.id} value={tl.id}>{tl.display_name || tl.username}</option>)}
                  </select>
                )}
                <button disabled={saving} onClick={() => updateUser(user, { active: !user.active }, user.active ? 'تم إيقاف المستخدم.' : 'تم تفعيل المستخدم.')} className="px-2.5 py-2 rounded-lg border border-[#DED2AC] text-[11px] text-stone-600 hover:bg-[#F3EDDD] disabled:opacity-50">
                  <UserX className="w-3.5 h-3.5 inline ml-1" />{user.active ? 'إيقاف' : 'تفعيل'}
                </button>
                <button disabled={saving} onClick={() => { const password = window.prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):'); if (password) updateUser(user, { password }, 'تم تغيير كلمة المرور.'); }} className="px-2.5 py-2 rounded-lg border border-[#DED2AC] text-[11px] text-stone-600 hover:bg-[#F3EDDD] disabled:opacity-50">
                  <KeyRound className="w-3.5 h-3.5 inline ml-1" />تغيير كلمة المرور
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
