import React, { useEffect, useState } from 'react';
import { BackendData } from '../../types';
import {
  fetchWorkStartTime,
  setWorkStartTime,
  fetchAttendanceForDate,
  saveAttendanceForDate,
} from '../../services/supabaseService';
import { Save, Clock } from 'lucide-react';

interface AttendanceViewProps {
  backendData: BackendData;
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

function computeStatus(arrival: string, start: string): { status: string; lateMinutes: number | '' } {
  if (!arrival) return { status: 'لم يسجل', lateMinutes: '' };
  const a = parseMinutes(arrival);
  const s = parseMinutes(start) ?? 8 * 60;
  if (a === null) return { status: 'لم يسجل', lateMinutes: '' };
  const late = Math.max(0, a - s);
  return { status: late ? 'متأخر' : 'حاضر', lateMinutes: late };
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ backendData }) => {
  const [date, setDate] = useState(toLocalYMD(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [rows, setRows] = useState<Record<string, { arrival: string; note: string }>>({});
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
      const map: Record<string, { arrival: string; note: string }> = {};
      records.forEach((r) => {
        map[r.employee_id] = { arrival: r.arrival_time || '', note: r.note || '' };
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await setWorkStartTime(startTime);
      const records = backendData.employees.map((e) => ({
        employee_id: e.id,
        arrival_time: rows[e.id]?.arrival || '',
        note: rows[e.id]?.note || '',
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
                  <th className="p-2.5 text-right font-semibold">وقت الحضور</th>
                  <th className="p-2.5 text-right font-semibold">الحالة</th>
                  <th className="p-2.5 text-right font-semibold">التأخير (د)</th>
                  <th className="p-2.5 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {backendData.employees.map((emp, i) => {
                  const arrival = rows[emp.id]?.arrival || '';
                  const note = rows[emp.id]?.note || '';
                  const { status, lateMinutes } = computeStatus(arrival, startTime);
                  return (
                    <tr key={emp.id} className={i % 2 === 1 ? 'bg-[#F3EDDD]' : 'bg-white'}>
                      <td className="p-2.5 font-medium text-stone-900">{emp.name}</td>
                      <td className="p-2.5 text-stone-600">{emp.department}</td>
                      <td className="p-2.5">
                        <input
                          type="time"
                          value={arrival}
                          onChange={(e) =>
                            setRows((r) => ({ ...r, [emp.id]: { arrival: e.target.value, note: r[emp.id]?.note || '' } }))
                          }
                          className="border border-[#DED2AC] rounded px-2 py-1 text-xs bg-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            status === 'حاضر' ? 'text-emerald-700' : status === 'متأخر' ? 'text-amber-700' : 'text-stone-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-stone-600">{lateMinutes === '' ? '—' : lateMinutes}</td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={note}
                          maxLength={500}
                          placeholder="ملاحظة"
                          onChange={(e) =>
                            setRows((r) => ({ ...r, [emp.id]: { arrival: r[emp.id]?.arrival || '', note: e.target.value } }))
                          }
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
      </div>
    </div>
  );
};
