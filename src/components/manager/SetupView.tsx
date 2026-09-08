import React, { useState } from 'react';
import { BackendData } from '../../types';
import {
  addDepartment,
  deleteDepartment,
  addEmployee,
  deleteEmployee,
  addProject,
  deleteProject,
  addBuilding,
  deleteBuilding,
  addTaskSub,
  deleteTaskSub,
  manageUsers,
  AppUser,
} from '../../services/supabaseService';
import { Plus, Trash2, UserCheck, Briefcase, Building, ListTodo, FolderKanban, KeyRound, UserCog, UserX } from 'lucide-react';

interface SetupViewProps {
  backendData: BackendData;
  onRefreshData: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ backendData, onRefreshData }) => {
  const [newDepartment, setNewDepartment] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingProject, setNewBuildingProject] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newTaskMain, setNewTaskMain] = useState('');
  const [newTaskSub, setNewTaskSub] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'employee' | 'manager'>('employee');
  const [newUserEmployeeId, setNewUserEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

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

  const loadUsers = async () => {
    try {
      const result = await manageUsers('list');
      setUsers(result.users || []);
    } catch (err: any) {
      notify('خطأ في تحميل المستخدمين: ' + (err.message || err));
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

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
      });
      setNewUsername('');
      setNewPassword('');
      setNewUserDisplayName('');
      setNewUserRole('employee');
      setNewUserEmployeeId('');
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
    <div className="space-y-6">
      {msg && (
        <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>
      )}

      {/* User Management */}
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
          <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as 'employee' | 'manager')} className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
            <option value="employee">موظف</option>
            <option value="manager">مدير</option>
          </select>
          <select value={newUserEmployeeId} onChange={(e) => setNewUserEmployeeId(e.target.value)} className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs">
            <option value="">ربط بموظف...</option>
            {backendData.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>)}
          </select>
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
                <div className="text-[11px] text-stone-500 mt-0.5">@{user.username} · {user.role === 'manager' ? 'مدير' : 'موظف'}</div>
              </div>
              <div className="flex items-center gap-1.5">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
            <FolderKanban className="w-4 h-4 text-[#B89B5E]" />
            الأقسام
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newDepartment.trim()) return;
              withSaving(async () => {
                await addDepartment(newDepartment.trim());
                setNewDepartment('');
              }, 'تمت إضافة القسم.');
            }}
            className="flex gap-2"
          >
            <input
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="اسم قسم جديد..."
              className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
            />
            <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {backendData.departments.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs">
                {d}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-stone-500">لحذف قسم، احذفه من قاعدة البيانات مباشرة إن لزم (لتفادي حذف بيانات مرتبطة به بالخطأ).</p>
        </div>

        {/* Projects */}
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3">
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
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {backendData.projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
                <span className="font-medium text-stone-900">{p.name}</span>
                <button
                  onClick={() => withSaving(async () => { await deleteProject(p.id); }, 'تم حذف المشروع.')}
                  className="text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Buildings */}
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
            <Building className="w-4 h-4 text-[#B89B5E]" />
            المباني
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newBuildingName.trim() || !newBuildingProject) return;
              withSaving(async () => {
                await addBuilding(newBuildingProject, newBuildingName.trim(), backendData.departments);
                setNewBuildingName('');
              }, 'تمت إضافة المبنى بوزن موزّع بالتساوي بين الأقسام — عدّله من تبويب نسب الإنجاز.');
            }}
            className="space-y-2"
          >
            <select
              value={newBuildingProject}
              onChange={(e) => setNewBuildingProject(e.target.value)}
              className="w-full bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
            >
              <option value="">اختر المشروع...</option>
              {backendData.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                placeholder="اسم المبنى..."
                className="flex-1 bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
              />
              <button type="submit" disabled={saving} className="px-3 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>
          </form>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {backendData.buildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
                <span className="font-medium text-stone-900">
                  {b.name} <span className="text-stone-500">({backendData.projects.find((p) => p.id === b.project_id)?.name})</span>
                </span>
                <button
                  onClick={() => withSaving(async () => { await deleteBuilding(b.id); }, 'تم حذف المبنى.')}
                  className="text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Employees */}
        <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
            <UserCheck className="w-4 h-4 text-[#B89B5E]" />
            الموظفون
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newEmpName.trim() || !newEmpDept) return;
              withSaving(async () => {
                await addEmployee(newEmpName.trim(), newEmpDept);
                setNewEmpName('');
              }, 'تمت إضافة الموظف.');
            }}
            className="space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                placeholder="اسم الموظف..."
                className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
              />
              <select
                value={newEmpDept}
                onChange={(e) => setNewEmpDept(e.target.value)}
                className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
              >
                <option value="">اختر القسم...</option>
                {backendData.departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> إضافة موظف
            </button>
          </form>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {backendData.employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between text-xs p-2 bg-[#F3EDDD] rounded-lg border border-[#DED2AC]">
                <span><strong>{emp.name}</strong> <span className="text-stone-500">— {emp.department}</span></span>
                <button
                  onClick={() => withSaving(async () => { await deleteEmployee(emp.id); }, 'تم حذف الموظف.')}
                  className="text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task categories */}
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider border-b border-[#DED2AC] pb-3">
          <ListTodo className="w-4 h-4 text-[#B89B5E]" />
          تصنيفات المهام
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTaskMain.trim() || !newTaskSub.trim()) return;
            withSaving(async () => {
              await addTaskSub(newTaskMain.trim(), newTaskSub.trim(), backendData.taskCategories);
              setNewTaskSub('');
            }, 'تمت إضافة المهمة.');
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        >
          <input
            value={newTaskMain}
            onChange={(e) => setNewTaskMain(e.target.value)}
            placeholder="التصنيف الرئيسي..."
            className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <input
            value={newTaskSub}
            onChange={(e) => setNewTaskSub(e.target.value)}
            placeholder="المهمة الفرعية..."
            className="bg-white border border-[#DED2AC] rounded-xl px-3 py-2 text-xs"
          />
          <button type="submit" disabled={saving} className="py-2 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </form>
        <div className="space-y-3">
          {backendData.taskCategories.map((cat) => (
            <div key={cat.id} className="bg-[#F3EDDD] border border-[#DED2AC] p-4 rounded-xl space-y-2">
              <div className="text-xs font-bold text-[#3B4636]">{cat.main}</div>
              <div className="flex flex-wrap gap-1.5">
                {cat.subs.map((sub) => (
                  <span key={sub} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#DED2AC] rounded-lg text-xs">
                    {sub}
                    <button
                      onClick={() => withSaving(async () => { await deleteTaskSub(cat, sub); }, 'تم الحذف.')}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
