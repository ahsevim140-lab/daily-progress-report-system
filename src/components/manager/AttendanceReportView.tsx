import React, { useEffect, useMemo, useState } from 'react';
import { BackendData } from '../../types';
import { fetchAttendanceInRange, fetchWorkStartTime } from '../../services/supabaseService';
import { CalendarRange, Search } from 'lucide-react';

interface AttendanceReportViewProps {
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

interface AttendanceRow {
  date: string;
  employee_id: string;
  arrival_time: string | null;
  is_day_off: boolean;
  hours_off: number | null;
}

export const AttendanceReportView: React.FC<AttendanceReportViewProps> = ({ backendData }) => {
  const today = toLocalYMD(new Date());
  const monthAgo = toLocalYMD(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [scopeDept, setScopeDept] = useState('');
  const [scopeEmployee, setScopeEmployee] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError('');
    try {
      const [records, start] = await Promise.all([fetchAttendanceInRange(fromDate, toDate), fetchWorkStartTime()]);
      setStartTime(start);
      setRows(
        records.map((r) => ({
          date: r.date,
          employee_id: r.employee_id,
          arrival_time: r.arrival_time,
          is_day_off: r.is_day_off,
          hours_off: r.hours_off,
        }))
      );
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const employeesInScope = backendData.employees.filter(
    (e) => (!scopeDept || e.department === scopeDept) && (!scopeEmployee || e.id === scopeEmployee)
  );

  const summary = useMemo(() => {
    const startMin = parseMinutes(startTime) ?? 8 * 60;
    return employeesInScope.map((emp) => {
      const empRows = rows.filter((r) => r.employee_id === emp.id);
      const daysTracked = empRows.length;
      const daysOffPlanned = empRows.filter((r) => r.is_day_off).length;
      const daysAbsent = empRows.filter((r) => !r.is_day_off && !r.arrival_time).length;
      let lateMinutesTotal = 0;
      let manualHoursOffTotal = 0;
      empRows.forEach((r) => {
        if (r.hours_off) manualHoursOffTotal += r.hours_off;
        if (r.is_day_off || !r.arrival_time) return;
        const a = parseMinutes(r.arrival_time);
        if (a === null) return;
        lateMinutesTotal += Math.max(0, a - startMin);
      });
      return {
        employee: emp,
        daysTracked,
        daysOffPlanned,
        daysAbsent,
        lateHours: Math.round((lateMinutesTotal / 60) * 10) / 10,
        manualHoursOff: Math.round(manualHoursOffTotal * 10) / 10,
      };
    });
  }, [employeesInScope, rows, startTime]);

  const totals = summary.reduce(
    (acc, s) => ({
      daysTracked: acc.daysTracked + s.daysTracked,
      daysOffPlanned: acc.daysOffPlanned + s.daysOffPlanned,
      daysAbsent: acc.daysAbsent + s.daysAbsent,
      lateHours: Math.round((acc.lateHours + s.lateHours) * 10) / 10,
      manualHoursOff: Math.round((acc.manualHoursOff + s.manualHoursOff) * 10) / 10,
    }),
    { daysTracked: 0, daysOffPlanned: 0, daysAbsent: 0, lateHours: 0, manualHoursOff: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B4636] uppercase tracking-wider">
          <CalendarRange className="w-4 h-4 text-[#B89B5E]" />
          تقرير الحضور (أيام وساعات الغياب)
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">من تاريخ</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white" />
          </div>
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">إلى تاريخ</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white" />
          </div>
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">القسم</label>
            <select
              value={scopeDept}
              onChange={(e) => { setScopeDept(e.target.value); setScopeEmployee(''); }}
              className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white"
            >
              <option value="">كل الشركة</option>
              {backendData.departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-stone-500 mb-1">الموظف</label>
            <select
              value={scopeEmployee}
              onChange={(e) => setScopeEmployee(e.target.value)}
              className="border border-[#DED2AC] rounded-lg px-3 py-2 text-xs bg-white"
            >
              <option value="">كل موظفي القسم</option>
              {backendData.employees
                .filter((e) => !scopeDept || e.department === scopeDept)
                .map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>}

        {loading ? (
          <div className="text-center text-xs text-stone-500 py-8">جارٍ التحميل...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500">أيام مسجّلة</div>
                <div className="text-lg font-bold text-[#3B4636]">{totals.daysTracked}</div>
              </div>
              <div className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500">أيام إجازة</div>
                <div className="text-lg font-bold text-sky-700">{totals.daysOffPlanned}</div>
              </div>
              <div className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500">أيام غياب</div>
                <div className="text-lg font-bold text-red-700">{totals.daysAbsent}</div>
              </div>
              <div className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500">ساعات تأخير</div>
                <div className="text-lg font-bold text-amber-700">{totals.lateHours}</div>
              </div>
              <div className="bg-[#F3EDDD] border border-[#DED2AC] rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500">ساعات غياب إضافية</div>
                <div className="text-lg font-bold text-amber-700">{totals.manualHoursOff}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#DED2AC] rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#3B4636] text-[#F2EEDD]">
                    <th className="p-2.5 text-right font-semibold">الموظف</th>
                    <th className="p-2.5 text-right font-semibold">القسم</th>
                    <th className="p-2.5 text-right font-semibold">أيام مسجّلة</th>
                    <th className="p-2.5 text-right font-semibold">أيام إجازة</th>
                    <th className="p-2.5 text-right font-semibold">أيام غياب</th>
                    <th className="p-2.5 text-right font-semibold">ساعات تأخير</th>
                    <th className="p-2.5 text-right font-semibold">ساعات غياب إضافية</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={s.employee.id} className={i % 2 === 1 ? 'bg-[#F3EDDD]' : 'bg-white'}>
                      <td className="p-2.5 font-medium text-stone-900">{s.employee.name}</td>
                      <td className="p-2.5 text-stone-600">{s.employee.department}</td>
                      <td className="p-2.5 font-mono">{s.daysTracked}</td>
                      <td className="p-2.5 font-mono text-sky-700">{s.daysOffPlanned}</td>
                      <td className="p-2.5 font-mono text-red-700">{s.daysAbsent}</td>
                      <td className="p-2.5 font-mono text-amber-700">{s.lateHours}</td>
                      <td className="p-2.5 font-mono text-amber-700">{s.manualHoursOff}</td>
                    </tr>
                  ))}
                  {summary.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400">
                        <Search className="w-4 h-4 inline ml-1" /> لا توجد بيانات ضمن هذا النطاق.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-stone-500">
              "أيام إجازة" لا تُحتسب كغياب. "أيام غياب" تُحسب من الأيام المسجّلة التي لم يُسجَّل فيها حضور ولم تُعلَّم كإجازة.
              "ساعات غياب إضافية" مُدخلة يدوياً من المدير، منفصلة عن حساب التأخير التلقائي.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
