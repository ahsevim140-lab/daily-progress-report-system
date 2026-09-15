import React, { useEffect, useState } from 'react';
import { BackendData } from '../../types';
import {
  fetchWorkStartTime,
  setWorkStartTime,
  fetchAttendanceForDate,
  saveAttendanceForDate,
} from '../../services/supabaseService';
import { Save, Clock, CalendarDays, CalendarRange, Umbrella } from 'lucide-react';
import { AttendanceReportView } from './AttendanceReportView';

interface AttendanceViewProps {
  backendData: BackendData;
}

interface RowState {
  arrival: string;
  note: string;
  isDayOff: boolean;
  hoursOff: string;
}

function toLocalYMD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseMinutes(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function computeStatus(row: RowState, start: string): { status: string; lateMinutes: number | '' } {
  if (row.isDayOff) return { status: 'إجازة', lateMinutes: '' };
  if (!row.arrival) return { status: 'لم يسجل', lateMinutes: '' };
  const a = parseMinutes(row.arrival);
  const s = parseMinutes(start) ?? 8 * 60;
  if (a === null) return { status: 'لم يسجل', lateMinutes: '' };
  const late = Math.max(0, a - s);
  return { status: late ? 'متأخر' : 'حاضر', lateMinutes: late };
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ backendData }) => {
  const [mode, setMode] = useState<'daily' | 'report'>('daily');
  const [date, setDate] = useState(toLocalYMD(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  };

  const loadDate = async (d: string) => {
    setLoading(true);
    try {
      const [start, records] = await Promise.all([fetchWorkStartTime(), fetchAttendanceForDate(d)]);
      setStartTime(start);
      const map: Record<string, RowState> = {};
      records.forEach((r) => {
        map[r.employee_id] = {
          arrival: r.arrival_time || '',
          note: r.note || '',
          isDayOff: r.is_day_off,
          hoursOff: r.hours_off != null ? String(r.hours_off) : '',
        };
      });
      setRows(map);
    } catch (err: any) {
      notify('خطأ في تحميل بيانات الحضور: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const updateRow = (empId: string, patch: Partial<RowState>) => {
    setRows((r) => ({
      ...r,
      [empId]: {
        arrival: r[empId]?.arrival || '',
        note: r[empId]?.note || '',
        isDayOff: r[empId]?.isDayOff || false,
        hoursOff: r[empId]?.hoursOff || '',
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setWorkStartTime(startTime);
      const records = backendData.employees.map((e) => ({
        employee_id: e.id,
        arrival_time: rows[e.id]?.arrival || '',
        note: rows[e.id]?.note || '',
        is_day_off: rows[e.id]?.isDayOff || false,
        hours_off: rows[e.id]?.hoursOff || '',
      }));
      await saveAttendanceForDate(date, records);
      notify('تم حفظ بيانات الحضور بنجاح.');
    } catch (err: any) {
      notify('خطأ: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-[#2C2A22]/50 p-1.5 rounded-xl border border-[#B89B5E]/30 shadow-inner w-fit">
        <button
          onClick={() => setMode('daily')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
            mode === 'daily' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" /> التسجيل اليومي
        </button>
        <button
          onClick={() => setMode('report')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
            mode === 'report' ? 'bg-[#B89B5E] text-[#2C2A22] font-bold' : 'text-[#F2EEDD] hover:bg-white/10'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5" /> تقرير الحضور
        </button>
      </div>

      {mode === 'report' ? (
        <AttendanceReportView backendData={backendData} />
      ) : (
      <div className="space-y-4">
      {msg && <div className="p-3 bg-[#3B4636] text-[#F2EEDD] rounded-xl text-xs font-medium">{msg}</div>}

      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">تاريخ الحضور</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">بداية الدوام</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="mt-4 px-4 py-2 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ بيانات الحضور
          </button>
        </div>

        {loading ? (
          <div className="text-center text-xs text-stone-500 py-8">جارٍ التحميل...</div>
        ) : backendData.employees.length === 0 ? (
          <div className="text-center text-xs text-stone-500 py-8">لا يوجد موظفون بعد. أضفهم من تبويب الموظفين.</div>
        ) : (
          <div className="overflow-x-auto border border-[#DED2AC] rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#3B4636] text-[#F2EEDD]">
                  <th className="p-2.5 text-right font-semibold">الموظف</th>
                  <th className="p-2.5 text-right font-semibold">القسم</th>
                  <th className="p-2.5 text-right font-semibold">إجازة</th>
                  <th className="p-2.5 text-right font-semibold">وقت الحضور</th>
                  <th className="p-2.5 text-right font-semibold">الحالة</th>
                  <th className="p-2.5 text-right font-semibold">التأخير (د)</th>
                  <th className="p-2.5 text-right font-semibold">ساعات غياب إضافية</th>
                  <th className="p-2.5 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {backendData.employees.map((emp, i) => {
                  const row: RowState = rows[emp.id] || { arrival: '', note: '', isDayOff: false, hoursOff: '' };
                  const { status, lateMinutes } = computeStatus(row, startTime);
                  return (
                    <tr key={emp.id} className={i % 2 === 1 ? 'bg-[#F3EDDD]' : 'bg-white'}>
                      <td className="p-2.5 font-medium text-stone-900">{emp.name}</td>
                      <td className="p-2.5 text-stone-600">{emp.department}</td>
                      <td className="p-2.5">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.isDayOff}
                            onChange={(e) => updateRow(emp.id, { isDayOff: e.target.checked, arrival: '' })}
                          />
                          <Umbrella className="w-3.5 h-3.5 text-[#B89B5E]" />
                        </label>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="time"
                          value={row.arrival}
                          disabled={row.isDayOff}
                          onChange={(e) => updateRow(emp.id, { arrival: e.target.value })}
                          className="border border-[#DED2AC] rounded px-2 py-1 text-xs bg-white disabled:bg-stone-100 disabled:text-stone-400"
                        />
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            status === 'حاضر'
                              ? 'text-emerald-700'
                              : status === 'متأخر'
                              ? 'text-amber-700'
                              : status === 'إجازة'
                              ? 'text-sky-700'
                              : 'text-stone-400'
                          }`}
                        >
                          {status === 'إجازة' ? <Umbrella className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-stone-600">{lateMinutes === '' ? '—' : lateMinutes}</td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={row.hoursOff}
                          placeholder="0"
                          onChange={(e) => updateRow(emp.id, { hoursOff: e.target.value })}
                          className="w-20 border border-[#DED2AC] rounded px-2 py-1 text-xs bg-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.note}
                          maxLength={500}
                          placeholder="ملاحظة"
                          onChange={(e) => updateRow(emp.id, { note: e.target.value })}
                          className="w-full border border-[#DED2AC] rounded px-2 py-1 text-xs bg-white"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-stone-500">
          "إجازة" تعني يوم عن العمل مخطط له — لا يُحتسب كغياب. "ساعات غياب إضافية" حقل يدوي منفصل عن حساب التأخير التلقائي (مثل الخروج المبكر أو الغياب الجزئي).
        </p>
      </div>
      </div>
      )}
    </div>
  );
};
