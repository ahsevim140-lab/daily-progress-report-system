import { ReportBatch } from './types';

// Converts a Date object or string to a local YYYY-MM-DD string
export function toLocalYMD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

// Export a printable PDF-style report (opens print dialog) matching the
// legacy "سجل تقارير الإنجاز" layout: logo, title, date, and a table with
// one row per task line.
export function exportBatchesToPDF(batches: ReportBatch[], logoDataUrl: string): void {
  const rows: string[] = [];
  batches.forEach((b) => {
    b.lines.forEach((l) => {
      rows.push(`
        <tr>
          <td>${formatArabicDate(b.created_at)}</td>
          <td>${escapeHtml(l.department)}</td>
          <td>${escapeHtml(b.employee_name)}</td>
          <td>${escapeHtml(b.project_name)}</td>
          <td>${escapeHtml(b.building_name)}</td>
          <td>${escapeHtml(l.task)}</td>
          <td>${l.percentage}%</td>
          <td>${escapeHtml(l.note || '')}</td>
        </tr>
      `);
    });
  });

  const todayLabel = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
  });

  const html = `
    <!doctype html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>سجل تقارير الإنجاز</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #2C2A22; margin: 0; }
        .header { text-align: center; margin-bottom: 18px; }
        .header img { width: 70px; height: 70px; object-fit: contain; margin-bottom: 8px; }
        .header h1 { font-size: 18px; margin: 4px 0; }
        .header h2 { font-size: 14px; font-weight: 600; margin: 2px 0; color: #3B4636; }
        .header p { font-size: 11px; color: #6b6456; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #DED2AC; padding: 6px 8px; text-align: right; vertical-align: top; }
        th { background: #3B4636; color: #F2EEDD; font-weight: 600; }
        tr:nth-child(even) td { background: #F3EDDD; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="شعار" />` : ''}
        <h1>سجل تقارير الإنجاز</h1>
        <p>${todayLabel}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>التاريخ والوقت</th>
            <th>القسم</th>
            <th>الاسم</th>
            <th>المشروع</th>
            <th>المبنى</th>
            <th>المهمة</th>
            <th>الإنجاز</th>
            <th>تفاصيل التقرير</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
export function exportBatchesToCSV(batches: ReportBatch[]): void {
  const headers = ['التاريخ والوقت', 'الاسم', 'المشروع', 'المبنى', 'القسم', 'المهمة', 'السابق', 'الجديد', 'الحالة', 'الملاحظة'];
  const rows: string[][] = [];

  batches.forEach((b) => {
    b.lines.forEach((l) => {
      rows.push([
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
