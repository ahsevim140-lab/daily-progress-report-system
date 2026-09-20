import React, { useMemo, useState } from 'react';
import { AttendanceStatus, BackendData } from '../../types';
import { todayLocalYMD } from '../../utils';
import { upsertAttendance } from '../../services/supabaseService';
import { CalendarDays, Printer, Save, Search } from 'lucide-react';

const labels: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', day_off: 'Day off', hours_off: 'Hours off', absent: 'Absent' };

export const AttendanceView: React.FC<{ backendData: BackendData; onRefreshData: () => void }> = ({ backendData, onRefreshData }) => {
  const today = todayLocalYMD();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'entry' | 'report'>('entry');
  const [nameFilter, setNameFilter] = useState('');
  const [department, setDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const rows = useMemo(() => {
    const name = nameFilter.trim().toLocaleLowerCase();
    return backendData.employees
      .filter((employee) => !name || employee.name.toLocaleLowerCase().includes(name))
      .filter((employee) => !department || employee.department === department)
      .map((employee) => backendData.attendance.find((record) => record.employee_id === employee.id && record.attendance_date === date) || ({
        employee_id: employee.id,
        employee_name: employee.name,
        department: employee.department,
        attendance_date: date,
        entrance_time: '',
        status: 'present' as AttendanceStatus,
        hours_off: 0,
        note: '',
      }));
  }, [backendData, date, department, nameFilter]);

  const filtered = statusFilter ? rows.filter((row) => row.status === statusFilter) : rows;

  const save = async (row: any) => {
    setSaving(row.employee_id);
    try {
      await upsertAttendance({
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        department: row.department,
        attendance_date: date,
        entrance_time: row.entrance_time || null,
        status: row.status,
        hours_off: Number(row.hours_off) || 0,
        note: row.note || null,
      });
      onRefreshData();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4 print:text-black">
      <div className="flex gap-2 bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-2 print:hidden">
        <button type="button" onClick={() => setMode('entry')} className={`px-4 py-2 rounded-xl text-xs font-bold ${mode === 'entry' ? 'bg-[#B89B5E] text-white' : 'text-[#3B4636]'}`}>Attendance entry</button>
        <button type="button" onClick={() => setMode('report')} className={`px-4 py-2 rounded-xl text-xs font-bold ${mode === 'report' ? 'bg-[#B89B5E] text-white' : 'text-[#3B4636]'}`}>Report / Print</button>
      </div>
      <div className="flex flex-wrap items-end gap-3 bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-4">
        <label className="text-xs">Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="block mt-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1.5 text-xs" />
        </label>
        <label className="text-xs">Employee name
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-stone-400" />
            <input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Search name" className="bg-white border border-[#DED2AC] rounded-lg pl-7 pr-2 py-1.5 text-xs w-40" />
          </div>
        </label>
        <label className="text-xs">Department
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="block mt-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1.5 text-xs">
            <option value="">All departments</option>
            {backendData.departments.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs">Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="block mt-1 bg-white border border-[#DED2AC] rounded-lg px-2 py-1.5 text-xs">
            <option value="">All statuses</option>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {mode === 'report' && <button onClick={() => window.print()} className="ml-auto px-3 py-2 bg-[#3B4636] text-white rounded-lg text-xs flex items-center gap-2"><Printer className="w-4 h-4" />Print filtered report</button>}
      </div>
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 font-bold text-[#3B4636] mb-1"><CalendarDays className="w-4 h-4 text-[#B89B5E]" />Attendance for {date}</div>
        <div className="text-[11px] text-stone-500 mb-3">Choose any date above to view or record attendance for that day.</div>
        <table className="w-full text-xs">
          <thead><tr className="text-right border-b border-[#DED2AC]"><th className="p-2">Employee</th><th className="p-2">Department</th><th className="p-2">Entrance</th><th className="p-2">Status</th><th className="p-2">Hours off</th><th className="p-2">Note</th><th /></tr></thead>
          <tbody>{filtered.map((row: any) => <tr key={row.employee_id} className="border-b border-[#DED2AC]/70">
            <td className="p-2 font-medium">{row.employee_name}</td>
            <td className="p-2">{row.department}</td>
            <td className="p-2">{mode === 'entry' ? <input type="time" defaultValue={row.entrance_time || ''} onChange={(event) => { row.entrance_time = event.target.value; }} className="bg-white border border-[#DED2AC] rounded px-2 py-1" /> : (row.entrance_time || '—')}</td>
            <td className="p-2">{mode === 'entry' ? <select defaultValue={row.status} onChange={(event) => { row.status = event.target.value; }} className="bg-white border border-[#DED2AC] rounded px-2 py-1">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : labels[row.status as AttendanceStatus]}</td>
            <td className="p-2">{mode === 'entry' ? <input type="number" min="0" step="0.5" defaultValue={row.hours_off || 0} onChange={(event) => { row.hours_off = event.target.value; }} className="w-16 bg-white border border-[#DED2AC] rounded px-2 py-1" /> : (row.hours_off || 0)}</td>
            <td className="p-2">{mode === 'entry' ? <input defaultValue={row.note || ''} onChange={(event) => { row.note = event.target.value; }} className="w-32 bg-white border border-[#DED2AC] rounded px-2 py-1" /> : (row.note || '—')}</td>
            <td className="p-2">{mode === 'entry' && <button disabled={saving === row.employee_id} onClick={() => save(row)} className="text-[#3B4636]"><Save className="w-4 h-4" /></button>}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="text-center text-xs text-stone-500 py-8">No employees match the filters.</div>}
      </div>
    </div>
  );
};
