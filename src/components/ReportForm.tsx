import React, { useMemo, useState } from 'react';
import { BackendData, DraftBuildingGroup, DraftProjectGroup, DraftTaskLine, Profile } from '../types';
import { submitReport } from '../services/supabaseService';
import { acceptsProgress, deriveFlag, todayLocalYMD } from '../utils';
import {
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Building,
  Briefcase,
  FileText,
  Percent,
  User,
  Layers,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';

interface ReportFormProps {
  backendData: BackendData;
  profile: Profile | null;
}

const ALWAYS_CATEGORIES = ['اجتماع', 'وضع راهن', 'تدقيق', 'عام', 'تدريب', 'أخرى'];
const PERCENT_OPTIONS = ['100', '90', '80', '70', '60', '50', '40', '30', '20', '10', '0'];

function uid() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}
function emptyTaskLine(): DraftTaskLine {
  return { id: uid(), category: '', task: '', percentage: '', activity: '', hoursWorked: '', blocker: '', note: '' };
}
function emptyBuildingGroup(): DraftBuildingGroup {
  return { id: uid(), buildingId: '', lines: [emptyTaskLine()] };
}
function emptyProjectGroup(): DraftProjectGroup {
  return { id: uid(), projectId: '', department: '', buildings: [emptyBuildingGroup()] };
}

type LineStatus = 'up' | 'stalled' | 'regressed' | null;

export const ReportForm: React.FC<ReportFormProps> = ({ backendData, profile }) => {
  // Who is reporting comes from the signed-in account's linked employee record.
  // Only a manager may choose someone else, and that is an explicit "on behalf of" action.
  const ownEmployee = profile?.employee_id ? backendData.employees.find((e) => e.id === profile.employee_id) : undefined;
  const isManager = profile?.role === 'manager';
  const [behalfDept, setBehalfDept] = useState('');
  const [behalfEmployeeId, setBehalfEmployeeId] = useState('');
  const [reportOnBehalf, setReportOnBehalf] = useState(false);
  // Reports are always recorded for today. Staff cannot submit a report for a
  // previous or future date from the entry screen.
  const workDate = todayLocalYMD();
  const [projectGroups, setProjectGroups] = useState<DraftProjectGroup[]>([emptyProjectGroup()]);

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err' | 'info'; message: string } | null>(null);

  const onBehalf = isManager && (reportOnBehalf || !ownEmployee);
  const behalfCandidates = backendData.employees.filter((e) => e.department === behalfDept);
  const reportingEmployee = onBehalf ? backendData.employees.find((e) => e.id === behalfEmployeeId) : ownEmployee;
  const fixedDepartment = reportingEmployee?.department || '';
  const openProjects = backendData.projects
    .filter((p) => acceptsProgress(p.status))
    .filter((p) => isManager && !onBehalf ? true : backendData.projectAssignments.some((assignment) => assignment.project_id === p.id && assignment.employee_id === reportingEmployee?.id));

  const buildingsForProject = (projectId: string) => backendData.buildings.filter((b) => b.project_id === projectId);

  const getMainTaskOptions = (projectId: string, buildingId: string, department: string) => {
    const allowedCategories = backendData.taskCategories.filter((cat) => Boolean(cat.is_general) || (cat.departments || (cat.department ? [cat.department] : [])).includes(department) || ALWAYS_CATEGORIES.includes(cat.main));
    const allowedNames = new Set(allowedCategories.map((cat) => cat.main));
    const selectedProjectTasks = backendData.projectTasks.filter(
      (t) => t.project_id === projectId && t.building_id === buildingId && t.department === department && t.task && allowedNames.has(t.category || department)
    );
    if (selectedProjectTasks.length > 0) {
      return [...new Set(selectedProjectTasks.map((t) => t.category || department))];
    }
    if (!department) return [];
    return allowedCategories.map((cat) => cat.main);
  };

  const getSubtaskOptions = (projectId: string, buildingId: string, department: string, category: string) => {
    if (!department || !category) return [];
    const selectedProjectTasks = backendData.projectTasks
      .filter((t) => t.project_id === projectId && t.building_id === buildingId && t.department === department && t.task && (t.category || department) === category)
      .map((t) => t.task);
    if (selectedProjectTasks.length > 0) return [...new Set(selectedProjectTasks)];
    const selectedCategory = backendData.taskCategories.find((cat) => cat.main === category && (cat.is_general || (cat.departments || (cat.department ? [cat.department] : [])).includes(department) || ALWAYS_CATEGORIES.includes(cat.main)));
    return selectedCategory?.subs || [];
  };

  // current tracked completion for a given project+building+department(+task)
  const currentCompletion = (projectId: string, buildingId: string, department: string, task = ''): number | null => {
    if (!projectId || !buildingId || !department) return null;
    const pt = backendData.projectTasks.find(
      (t) => t.project_id === projectId && t.building_id === buildingId && t.department === department && (!task || !t.task || t.task === task)
    );
    return pt ? pt.completion_percent : 0;
  };

  const lineStatus = (projectId: string, buildingId: string, department: string, line: DraftTaskLine): LineStatus => {
    if (!line.task || line.percentage === '') return null;
    const current = currentCompletion(projectId, buildingId, department, line.task);
    if (current === null) return null;
    const flag = deriveFlag(current, Number(line.percentage));
    return flag === 'none' ? 'up' : flag;
  };

  // ---- project group mutators ----
  const addProjectGroup = () => setProjectGroups([...projectGroups, emptyProjectGroup()]);
  const removeProjectGroup = (id: string) => {
    if (projectGroups.length <= 1) return;
    setProjectGroups(projectGroups.filter((pg) => pg.id !== id));
  };
  const setProjectId = (id: string, projectId: string) =>
    setProjectGroups(projectGroups.map((pg) => (pg.id === id ? { ...pg, projectId, buildings: [emptyBuildingGroup()] } : pg)));

  // ---- building group mutators ----
  const addBuildingGroup = (projectGroupId: string) =>
    setProjectGroups(projectGroups.map((pg) => (pg.id === projectGroupId ? { ...pg, buildings: [...pg.buildings, emptyBuildingGroup()] } : pg)));
  const removeBuildingGroup = (projectGroupId: string, buildingGroupId: string) =>
    setProjectGroups(
      projectGroups.map((pg) =>
        pg.id === projectGroupId && pg.buildings.length > 1
          ? { ...pg, buildings: pg.buildings.filter((bg) => bg.id !== buildingGroupId) }
          : pg
      )
    );
  const setBuildingId = (projectGroupId: string, buildingGroupId: string, buildingId: string) =>
    setProjectGroups(
      projectGroups.map((pg) =>
        pg.id === projectGroupId
          ? { ...pg, buildings: pg.buildings.map((bg) => (bg.id === buildingGroupId ? { ...bg, buildingId } : bg)) }
          : pg
      )
    );

  // ---- task line mutators ----
  const addTaskLine = (projectGroupId: string, buildingGroupId: string) =>
    setProjectGroups(
      projectGroups.map((pg) =>
        pg.id === projectGroupId
          ? { ...pg, buildings: pg.buildings.map((bg) => (bg.id === buildingGroupId ? { ...bg, lines: [...bg.lines, emptyTaskLine()] } : bg)) }
          : pg
      )
    );
  const removeTaskLine = (projectGroupId: string, buildingGroupId: string, lineId: string) =>
    setProjectGroups(
      projectGroups.map((pg) =>
        pg.id === projectGroupId
          ? {
              ...pg,
              buildings: pg.buildings.map((bg) =>
                bg.id === buildingGroupId && bg.lines.length > 1 ? { ...bg, lines: bg.lines.filter((l) => l.id !== lineId) } : bg
              ),
            }
          : pg
      )
    );
  const setLineField = (projectGroupId: string, buildingGroupId: string, lineId: string, field: keyof DraftTaskLine, value: string) =>
    setProjectGroups(
      projectGroups.map((pg) =>
        pg.id === projectGroupId
          ? {
              ...pg,
              buildings: pg.buildings.map((bg) =>
                bg.id === buildingGroupId
                  ? { ...bg, lines: bg.lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)) }
                  : bg
              ),
            }
          : pg
      )
    );

  const canSubmit = useMemo(() => {
    if (!reportingEmployee || !workDate) return false;
    if (projectGroups.length === 0) return false;
    return projectGroups.every((pg) => {
      if (!pg.projectId || !fixedDepartment || pg.buildings.length === 0) return false;
      return pg.buildings.every((bg) => {
        if (!bg.buildingId || bg.lines.length === 0) return false;
        return bg.lines.every((line) => {
          if (!line.category || !line.task || line.percentage === '') return false;
          const st = lineStatus(pg.projectId, bg.buildingId, fixedDepartment, line);
          if ((st === 'stalled' || st === 'regressed') && !line.note.trim()) return false;
          return true;
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportingEmployee, fixedDepartment, projectGroups, backendData.projectTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({ type: 'err', message: 'يرجى اختيار القسم والمهمة ونسبة الإنجاز، وإضافة ملاحظة عند ثبات أو انخفاض النسبة.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: 'جارٍ حفظ التقرير...' });

    try {
      await submitReport(projectGroups, { workDate, department: fixedDepartment, onBehalfOfEmployeeId: onBehalf ? behalfEmployeeId : null });
      setStatus({ type: 'ok', message: 'تم حفظ التقرير بنجاح.' });
      setProjectGroups([emptyProjectGroup()]);
    } catch (err: any) {
      setStatus({ type: 'err', message: 'حدث خطأ أثناء الإرسال: ' + (err.message || err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-6 md:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Who + when: constant for the whole report */}
          <div className="space-y-4 pb-6 border-b border-[#DED2AC]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                  <User className="w-3.5 h-3.5 text-[#B89B5E]" />
                  مقدّم التقرير
                </label>
                {!onBehalf && ownEmployee && (
                  <div className="w-full bg-stone-100 border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs font-medium">
                    {ownEmployee.name} <span className="text-stone-500">— {ownEmployee.department}</span>
                  </div>
                )}
                {!onBehalf && !ownEmployee && (
                  <div className="w-full bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3.5 py-2.5 text-xs">
                    حسابك غير مرتبط بسجل موظف، لذلك لا يمكن إرسال تقرير. اطلب من المدير ربط الحساب بموظف.
                  </div>
                )}
                {onBehalf && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={behalfDept}
                      onChange={(e) => { setBehalfDept(e.target.value); setBehalfEmployeeId(''); }}
                      className="bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                    >
                      <option value="">القسم...</option>
                      {backendData.departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <select
                      value={behalfEmployeeId}
                      onChange={(e) => setBehalfEmployeeId(e.target.value)}
                      disabled={!behalfDept}
                      className="bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <option value="">{behalfDept ? 'الموظف...' : 'اختر القسم أولاً'}</option>
                      {behalfCandidates.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isManager && ownEmployee && (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-stone-600">
                    <input type="checkbox" checked={reportOnBehalf} onChange={(e) => setReportOnBehalf(e.target.checked)} />
                    تقديم التقرير نيابةً عن موظف آخر
                  </label>
                )}
                {onBehalf && (
                  <p className="mt-2 text-[11px] text-amber-700">سيُسجَّل التقرير باسم الموظف المختار، ويُحفظ اسم حسابك كمُرسِل.</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                  تاريخ التقرير
                </label>
                <div className="w-full bg-stone-100 border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs font-medium">
                  {workDate} <span className="text-stone-500">— يتم تسجيل التقرير بتاريخ اليوم فقط</span>
                </div>
              </div>
            </div>
          </div>

          {/* Where: repeatable project -> building -> task structure */}
          <div className="space-y-5">
            {projectGroups.map((pg, pgIndex) => (
              <div key={pg.id} className="bg-white/60 border border-[#DED2AC] rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                      <Briefcase className="w-3.5 h-3.5 text-[#B89B5E]" />
                      المشروع {projectGroups.length > 1 ? `#${pgIndex + 1}` : ''}
                    </label>
                    <select
                      value={pg.projectId}
                      onChange={(e) => setProjectId(pg.id, e.target.value)}
                      className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                      required
                    >
                      <option value="">اختر المشروع...</option>
                      {openProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  {projectGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProjectGroup(pg.id)}
                      className="mt-6 text-xs text-[#9C4A3C] hover:text-red-700 flex items-center gap-1 hover:underline font-medium shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف المشروع
                    </button>
                  )}
                </div>

                {/* Buildings within this project */}
                <div className="space-y-4 pr-3 border-r-2 border-[#DED2AC]">
                  {pg.buildings.map((bg, bgIndex) => (
                    <div key={bg.id} className="bg-[#F3EDDD]/60 border border-[#DED2AC] rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                            <Building className="w-3.5 h-3.5 text-[#B89B5E]" />
                            المبنى {pg.buildings.length > 1 ? `#${bgIndex + 1}` : ''}
                          </label>
                          <select
                            value={bg.buildingId}
                            onChange={(e) => setBuildingId(pg.id, bg.id, e.target.value)}
                            disabled={!pg.projectId}
                            className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium disabled:bg-stone-100 disabled:text-stone-400"
                            required
                          >
                            <option value="">{pg.projectId ? 'اختر المبنى...' : 'اختر المشروع أولاً...'}</option>
                            {buildingsForProject(pg.projectId).map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>
                        {pg.buildings.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBuildingGroup(pg.id, bg.id)}
                            className="mt-6 text-xs text-[#9C4A3C] hover:text-red-700 flex items-center gap-1 hover:underline font-medium shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف المبنى
                          </button>
                        )}
                      </div>

                      {/* Task lines within this building */}
                      <div className="space-y-4">
                        {bg.lines.map((line, lineIndex) => {
                          const current = currentCompletion(pg.projectId, bg.buildingId, fixedDepartment, line.task);
                          const st = lineStatus(pg.projectId, bg.buildingId, fixedDepartment, line);
                          const needsNote = st === 'stalled' || st === 'regressed';

                          return (
                            <div
                              key={line.id}
                              className={`bg-white border rounded-xl p-5 transition-all shadow-xs border-r-4 ${
                                st === 'regressed'
                                  ? 'border-red-300 border-r-red-500'
                                  : st === 'stalled'
                                  ? 'border-amber-300 border-r-amber-500'
                                  : 'border-[#DED2AC] border-r-[#B89B5E]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#DED2AC]/80">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#3B4636] flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-[#B89B5E]/20 text-[#3B4636] flex items-center justify-center text-[11px] font-mono font-bold">
                                    {lineIndex + 1}
                                  </span>
                                  مهمة
                                </span>
                                {bg.lines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTaskLine(pg.id, bg.id, line.id)}
                                    className="text-xs text-[#9C4A3C] hover:text-red-700 flex items-center gap-1 hover:underline font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    حذف
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                                    <Layers className="w-3.5 h-3.5 text-[#B89B5E]" />
                                    المهمة الرئيسية
                                  </label>
                                  <select
                                    value={line.category}
                                    onChange={(e) => {
                                      setLineField(pg.id, bg.id, line.id, 'category', e.target.value);
                                      setLineField(pg.id, bg.id, line.id, 'task', '');
                                    }}
                                    disabled={!fixedDepartment || !bg.buildingId}
                                    className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] disabled:bg-stone-100 disabled:text-stone-400"
                                    required
                                  >
                                    <option value="">{fixedDepartment ? 'اختر المهمة الرئيسية...' : 'لا يوجد قسم مرتبط بالحساب...'}</option>
                                    {getMainTaskOptions(pg.projectId, bg.buildingId, fixedDepartment).map((main) => (
                                      <option key={main} value={main}>{main}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                                    <FileText className="w-3.5 h-3.5 text-[#B89B5E]" />
                                    المهمة الفرعية
                                  </label>
                                  <select
                                    value={line.task}
                                    onChange={(e) => setLineField(pg.id, bg.id, line.id, 'task', e.target.value)}
                                    disabled={!line.category}
                                    className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] disabled:bg-stone-100 disabled:text-stone-400"
                                    required
                                  >
                                    <option value="">{line.category ? 'اختر المهمة الفرعية...' : 'اختر المهمة الرئيسية أولاً...'}</option>
                                    {getSubtaskOptions(pg.projectId, bg.buildingId, fixedDepartment, line.category).map((sub) => (
                                      <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {current !== null && (
                                <div className="mb-3 text-[11px] text-stone-600 bg-white/60 border border-[#DED2AC] rounded-lg px-3 py-2 flex items-center gap-1.5">
                                  <span>نسبة الإنجاز الحالية المسجّلة لهذا القسم في هذا المبنى:</span>
                                  <span className="font-bold text-[#3B4636]">{current}%</span>
                                </div>
                              )}

                              <div className="mb-4">
                                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                                  <Percent className="w-3.5 h-3.5 text-[#B89B5E]" />
                                  نسبة الإنجاز الجديدة
                                </label>
                                <div className="flex items-center gap-3">
                                  <select
                                    value={line.percentage}
                                    onChange={(e) => setLineField(pg.id, bg.id, line.id, 'percentage', e.target.value)}
                                    className="flex-1 bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                                    required
                                  >
                                    <option value="">اختر نسبة الإنجاز...</option>
                                    {PERCENT_OPTIONS.map((pct) => (
                                      <option key={pct} value={pct}>{pct}%</option>
                                    ))}
                                  </select>

                                  {st === 'up' && (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                      <TrendingUp className="w-3.5 h-3.5" /> تقدم
                                    </span>
                                  )}
                                  {st === 'stalled' && (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                      <Minus className="w-3.5 h-3.5" /> ثابت
                                    </span>
                                  )}
                                  {st === 'regressed' && (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                                      <TrendingDown className="w-3.5 h-3.5" /> تراجع
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${needsNote ? 'text-red-700' : 'text-stone-700'}`}>
                                  {needsNote ? <AlertTriangle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5 text-[#B89B5E]" />}
                                  {needsNote ? 'ملاحظة السبب (مطلوب)' : 'ملاحظات إضافية (اختياري)'}
                                </label>
                                <textarea
                                  value={line.note}
                                  onChange={(e) => setLineField(pg.id, bg.id, line.id, 'note', e.target.value)}
                                  placeholder={needsNote ? 'اشرح سبب عدم التقدم أو انخفاض النسبة...' : 'تفاصيل إضافية عن المهمة...'}
                                  rows={2}
                                  className={`w-full bg-white text-stone-900 rounded-lg px-3 py-2 text-xs resize-y focus:outline-none ${needsNote ? 'border border-red-300 focus:border-red-500' : 'border border-[#DED2AC] focus:border-[#B89B5E]'}`}
                                  required={needsNote}
                                />
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => addTaskLine(pg.id, bg.id)}
                          className="w-full py-2.5 px-4 border border-dashed border-[#B89B5E] text-[#3B4636] hover:bg-[#B89B5E]/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4 text-[#B89B5E]" />
                          <span>إضافة مهمة أخرى لهذا المبنى</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addBuildingGroup(pg.id)}
                    disabled={!pg.projectId}
                    className="w-full py-2.5 px-4 border border-dashed border-[#B89B5E] text-[#3B4636] hover:bg-[#B89B5E]/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 text-[#B89B5E]" />
                    <span>إضافة مبنى آخر لهذا المشروع</span>
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addProjectGroup}
              className="w-full py-3 px-4 border border-dashed border-[#3B4636] text-[#3B4636] hover:bg-[#3B4636]/5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مشروع آخر</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="w-full bg-[#3B4636] hover:bg-[#4B5842] text-[#F2EEDD] font-medium py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs shadow-xs disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جارٍ حفظ التقرير...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#D8C48F]" />
                  <span>إرسال التقرير</span>
                </>
              )}
            </button>
          </div>

          {status && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-3 ${
                status.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : status.type === 'err'
                  ? 'bg-red-50 border border-red-200 text-red-900'
                  : 'bg-stone-100 border border-stone-200 text-stone-800'
              }`}
            >
              {status.type === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : status.type === 'err' ? (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed font-medium">{status.message}</div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
