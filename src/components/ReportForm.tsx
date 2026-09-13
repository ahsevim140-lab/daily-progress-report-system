import React, { useMemo, useState } from 'react';
import { BackendData, DraftReportLine } from '../types';
import { submitReportBatch } from '../services/supabaseService';
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
}

const PERCENT_OPTIONS = ['100', '90', '80', '70', '60', '50', '40', '30', '20', '10', '0'];

function emptyLine(): DraftReportLine {
  return { id: Date.now().toString() + Math.random(), department: '', task: '', percentage: '', note: '' };
}

export const ReportForm: React.FC<ReportFormProps> = ({ backendData }) => {
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [lines, setLines] = useState<DraftReportLine[]>([emptyLine()]);
  // Main-category selection per line is a UI-only concern (only the final
  // sub-task gets submitted), so it's tracked separately from DraftReportLine.
  const [lineCategory, setLineCategory] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err' | 'info'; message: string } | null>(null);

  const availableEmployees = backendData.employees
    .filter((e) => e.department === selectedDept)
    .map((e) => e.name);

  const buildingsForProject = backendData.buildings.filter((b) => b.project_id === projectId);

  // A category with an empty visible_departments list is shown to everyone;
  // otherwise only to the departments a manager picked for it.
  const getVisibleCategories = (department: string) => {
    if (!department) return backendData.taskCategories;
    const matched = backendData.taskCategories.filter(
      (cat) => cat.visible_departments.length === 0 || cat.visible_departments.includes(department)
    );
    return matched.length > 0 ? matched : backendData.taskCategories;
  };

  const getTasksForCategory = (department: string, mainCategory: string) => {
    const group = getVisibleCategories(department).find((c) => c.main === mainCategory);
    return group ? group.subs : [];
  };

  // current tracked completion for a given department, in the chosen project+building
  const currentCompletion = (department: string): number | null => {
    if (!projectId || !buildingId || !department) return null;
    const pt = backendData.projectTasks.find(
      (t) => t.project_id === projectId && t.building_id === buildingId && t.department === department
    );
    return pt ? pt.completion_percent : 0;
  };

  const handleAddLine = () => setLines([...lines, emptyLine()]);
  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((l) => l.id !== id));
    setLineCategory((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const handleLineChange = (id: string, field: keyof DraftReportLine, value: string) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };
  const handleLineDeptChange = (id: string, department: string) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, department, task: '' } : l)));
    setLineCategory((prev) => ({ ...prev, [id]: '' }));
  };
  const handleLineCategoryChange = (id: string, category: string) => {
    setLineCategory((prev) => ({ ...prev, [id]: category }));
    setLines(lines.map((l) => (l.id === id ? { ...l, task: '' } : l)));
  };

  const lineStatus = (line: DraftReportLine): 'up' | 'stalled' | 'regressed' | null => {
    if (!line.department || line.percentage === '') return null;
    const current = currentCompletion(line.department);
    if (current === null) return null;
    const pct = Number(line.percentage);
    if (pct > current) return 'up';
    if (pct === current) return 'stalled';
    return 'regressed';
  };

  const canSubmit = useMemo(() => {
    if (!selectedDept || !selectedName || !projectId || !buildingId) return false;
    return lines.every((l) => {
      if (!l.department || !l.task || l.percentage === '') return false;
      const st = lineStatus(l);
      if ((st === 'stalled' || st === 'regressed') && !l.note.trim()) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept, selectedName, projectId, buildingId, lines, backendData.projectTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({ type: 'err', message: 'يرجى تعبئة جميع الحقول المطلوبة، وإضافة سبب عند ثبات أو انخفاض نسبة الإنجاز.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: 'جارٍ حفظ التقرير...' });

    try {
      await submitReportBatch(selectedName, projectId, buildingId, lines);
      setStatus({ type: 'ok', message: 'تم حفظ التقرير بنجاح.' });
      setLines([emptyLine()]);
      setLineCategory({});
    } catch (err: any) {
      setStatus({ type: 'err', message: 'حدث خطأ أثناء الإرسال: ' + (err.message || err) });
    } finally {
      setSubmitting(false);
    }
  };

  // Used by the "new building / new project" continue buttons: submits the
  // current batch (same validation as the main submit), then resets only
  // what actually needs to change for the next entry — so the employee
  // doesn't have to re-pick their name/department, or the project, each time.
  const submitAndContinue = async (resetTarget: 'building' | 'project') => {
    if (!canSubmit) {
      setStatus({ type: 'err', message: 'يرجى تعبئة جميع الحقول المطلوبة قبل المتابعة إلى مبنى أو مشروع آخر.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: 'جارٍ حفظ التقرير...' });

    try {
      await submitReportBatch(selectedName, projectId, buildingId, lines);
      setBuildingId('');
      if (resetTarget === 'project') setProjectId('');
      setLines([emptyLine()]);
      setLineCategory({});
      setStatus({
        type: 'ok',
        message: resetTarget === 'project'
          ? 'تم حفظ التقرير. اختر المشروع الجديد للمتابعة.'
          : 'تم حفظ التقرير. اختر المبنى التالي ضمن نفس المشروع للمتابعة.',
      });
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
          {/* Who */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 border-b border-[#DED2AC]">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                <Layers className="w-3.5 h-3.5 text-[#B89B5E]" />
                القسم
              </label>
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSelectedName('');
                }}
                className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                required
              >
                <option value="">اختر القسم...</option>
                {backendData.departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                <User className="w-3.5 h-3.5 text-[#B89B5E]" />
                الاسم
              </label>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                disabled={!selectedDept}
                className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium disabled:bg-stone-100 disabled:text-stone-400"
                required
              >
                <option value="">{selectedDept ? 'اختر اسمك من القائمة...' : 'اختر القسم أولاً...'}</option>
                {availableEmployees.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Where: project + building, chosen once for the whole batch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 border-b border-[#DED2AC]">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                <Briefcase className="w-3.5 h-3.5 text-[#B89B5E]" />
                المشروع
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setBuildingId('');
                }}
                className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                required
              >
                <option value="">اختر المشروع...</option>
                {backendData.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A7361] mb-2">
                <Building className="w-3.5 h-3.5 text-[#B89B5E]" />
                المبنى
              </label>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                disabled={!projectId}
                className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B89B5E] font-medium disabled:bg-stone-100 disabled:text-stone-400"
                required
              >
                <option value="">{projectId ? 'اختر المبنى...' : 'اختر المشروع أولاً...'}</option>
                {buildingsForProject.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Task lines for this project+building */}
          <div className="space-y-4">
            {lines.map((line, index) => {
              const current = currentCompletion(line.department);
              const status = lineStatus(line);
              const needsNote = status === 'stalled' || status === 'regressed';

              return (
                <div
                  key={line.id}
                  className={`bg-[#F3EDDD] border rounded-xl p-5 transition-all shadow-xs border-r-4 ${
                    status === 'regressed'
                      ? 'border-red-300 border-r-red-500'
                      : status === 'stalled'
                      ? 'border-amber-300 border-r-amber-500'
                      : 'border-[#DED2AC] border-r-[#B89B5E]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#DED2AC]/80">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#3B4636] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#B89B5E]/20 text-[#3B4636] flex items-center justify-center text-[11px] font-mono font-bold">
                        {index + 1}
                      </span>
                      مهمة
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="text-xs text-[#9C4A3C] hover:text-red-700 flex items-center gap-1 hover:underline font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#B89B5E]" />
                        القسم / الاختصاص
                      </label>
                      <select
                        value={line.department}
                        onChange={(e) => handleLineDeptChange(line.id, e.target.value)}
                        className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E]"
                        required
                      >
                        <option value="">اختر القسم...</option>
                        {backendData.departments.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#B89B5E]" />
                        التصنيف الرئيسي
                      </label>
                      <select
                        value={lineCategory[line.id] || ''}
                        onChange={(e) => handleLineCategoryChange(line.id, e.target.value)}
                        className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] disabled:bg-stone-100 disabled:text-stone-400"
                        required
                        disabled={!line.department}
                      >
                        <option value="">{line.department ? 'اختر التصنيف...' : 'اختر القسم أولاً...'}</option>
                        {getVisibleCategories(line.department).map((group) => (
                          <option key={group.id} value={group.main}>{group.main}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#B89B5E]" />
                        المهمة
                      </label>
                      <select
                        value={line.task}
                        onChange={(e) => handleLineChange(line.id, 'task', e.target.value)}
                        className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E]"
                        required
                        disabled={!lineCategory[line.id]}
                      >
                        <option value="">{lineCategory[line.id] ? 'اختر المهمة...' : 'اختر التصنيف أولاً...'}</option>
                        {getTasksForCategory(line.department, lineCategory[line.id] || '').map((sub) => (
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
                        onChange={(e) => handleLineChange(line.id, 'percentage', e.target.value)}
                        className="flex-1 bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] font-medium"
                        required
                      >
                        <option value="">اختر نسبة الإنجاز...</option>
                        {PERCENT_OPTIONS.map((pct) => (
                          <option key={pct} value={pct}>{pct}%</option>
                        ))}
                      </select>

                      {status === 'up' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <TrendingUp className="w-3.5 h-3.5" /> تقدم
                        </span>
                      )}
                      {status === 'stalled' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <Minus className="w-3.5 h-3.5" /> ثابت
                        </span>
                      )}
                      {status === 'regressed' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                          <TrendingDown className="w-3.5 h-3.5" /> تراجع
                        </span>
                      )}
                    </div>
                  </div>

                  {needsNote && (
                    <div className="mb-4">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        سبب ثبات أو انخفاض النسبة (مطلوب)
                      </label>
                      <textarea
                        value={line.note}
                        onChange={(e) => handleLineChange(line.id, 'note', e.target.value)}
                        placeholder="اشرح سبب عدم التقدم أو انخفاض النسبة..."
                        rows={2}
                        className="w-full bg-white border border-red-300 text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500 resize-y"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#B89B5E]" />
                      ملاحظات إضافية (اختياري)
                    </label>
                    {!needsNote && (
                      <textarea
                        value={line.note}
                        onChange={(e) => handleLineChange(line.id, 'note', e.target.value)}
                        placeholder="تفاصيل إضافية عن المهمة..."
                        rows={2}
                        className="w-full bg-white border border-[#DED2AC] text-stone-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#B89B5E] resize-y"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleAddLine}
              className="py-3 px-4 border border-dashed border-[#B89B5E] text-[#3B4636] hover:bg-[#B89B5E]/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#B89B5E]" />
              <span>إضافة مهمة أخرى لنفس المبنى</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitAndContinue('building')}
              className="py-3 px-4 border border-dashed border-[#B89B5E] text-[#3B4636] hover:bg-[#B89B5E]/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Building className="w-4 h-4 text-[#B89B5E]" />
              <span>إضافة مبنى آخر لنفس المشروع</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitAndContinue('project')}
              className="py-3 px-4 border border-dashed border-[#B89B5E] text-[#3B4636] hover:bg-[#B89B5E]/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Briefcase className="w-4 h-4 text-[#B89B5E]" />
              <span>إضافة مشروع جديد</span>
            </button>
          </div>
          <p className="text-[10px] text-stone-500 -mt-2">
            الزرّان الأخيران يحفظان التقرير الحالي أولاً، ثم يفتحان مشروعاً/مبنى جديداً مباشرة.
          </p>

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
