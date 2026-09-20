import { PROGRESS_CLOSED_STATUSES, ProjectStatus, ReportBatch, ReportFlag } from './types';

// Converts a Date object or string to a local YYYY-MM-DD string
export function toLocalYMD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Today's date in the user's local timezone (toISOString() would give the UTC date, which is
// the wrong day for a few hours around midnight).
export function todayLocalYMD(): string {
  return toLocalYMD(new Date());
}

// The single rule for how a new percentage compares with the previous one.
export function deriveFlag(previous: number, next: number): ReportFlag {
  if (next < previous) return 'regressed';
  if (next === previous) return 'stalled';
  return 'none';
}

export function acceptsProgress(status: ProjectStatus | undefined): boolean {
  return !PROGRESS_CLOSED_STATUSES.includes(status ?? 'running');
}

// Format date to local Arabic display string
export function formatArabicDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Export CSV string from a list of report batches (one row per task line)
export function exportBatchesToCSV(batches: ReportBatch[]): void {
  const headers = ['تاريخ العمل', 'وقت الإرسال', 'الاسم', 'المشروع', 'المبنى', 'القسم', 'المهمة', 'السابق', 'الجديد', 'الحالة', 'الملاحظة'];
  const rows: string[][] = [];

  batches.forEach((b) => {
    b.lines.forEach((l) => {
      rows.push([
        `"${b.work_date || toLocalYMD(b.created_at)}"`,
        `"${formatArabicDate(b.created_at)}"`,
        `"${(b.employee_name || '').replace(/"/g, '""')}"`,
        `"${(b.project_name || '').replace(/"/g, '""')}"`,
        `"${(b.building_name || '').replace(/"/g, '""')}"`,
        `"${(l.department || '').replace(/"/g, '""')}"`,
        `"${(l.task || '').replace(/"/g, '""')}"`,
        `"${l.previous_percentage}%"`,
        `"${l.percentage}%"`,
        `"${l.flag}"`,
        `"${(l.note || '').replace(/"/g, '""')}"`,
      ]);
    });
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `reports_export_${toLocalYMD(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
