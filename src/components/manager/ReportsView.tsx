import React, { useEffect, useMemo, useState } from 'react';
import { BackendData, ReportBatch } from '../../types';
import { fetchReportBatches } from '../../services/supabaseService';
import { formatArabicDate, toLocalYMD, exportBatchesToCSV, exportBatchesToPDF } from '../../utils';
import logoUrl from '../../assets/logo.png';
import {
  RefreshCw,
  Search,
  Download,
  FileDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface ReportsViewProps {
  backendData: BackendData;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ backendData }) => {
  const [batches, setBatches] = useState<ReportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchReportBatches();
      setBatches(data);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل التقارير.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (filterProject && b.project_id !== filterProject) return false;
      if (filterDate && toLocalYMD(b.created_at) !== filterDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const combined = `${b.employee_name} ${b.project_name} ${b.building_name} ${b.lines
          .map((l) => `${l.department} ${l.task} ${l.note || ''}`)
          .join(' ')}`.toLowerCase();
        if (!combined.includes(term)) return false;
      }
      return true;
    });
  }, [batches, filterProject, filterDate, searchTerm]);

  const batchSeverity = (b: ReportBatch): 'regressed' | 'stalled' | 'none' => {
    if (b.lines.some((l) => l.flag === 'regressed')) return 'regressed';
    if (b.lines.some((l) => l.flag === 'stalled')) return 'stalled';
    return 'none';
  };

  const rowClass = (severity: 'regressed' | 'stalled' | 'none') =>
    severity === 'regressed'
      ? 'bg-red-50 border-red-200'
      : severity === 'stalled'
      ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-[#DED2AC]';

  const handleExportPDF = async () => {
    let logoDataUrl = '';
    try {
      const res = await fetch(logoUrl);
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // fall back to no logo if it can't be loaded
    }
    exportBatchesToPDF(filtered, logoDataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-white border border-[#DED2AC] rounded-lg px-2.5 py-1.5 text-xs text-stone-900"
        >
          <option value="">كل المشاريع</option>
          {backendData.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-white border border-[#DED2AC] rounded-lg px-2.5 py-1.5 text-xs text-stone-900"
        />

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث..."
            className="w-full pr-9 pl-3 py-1.5 bg-white border border-[#DED2AC] rounded-lg text-xs text-stone-900"
          />
        </div>

        <button
          onClick={load}
          className="px-3 py-1.5 bg-[#3B4636] text-[#F2EEDD] rounded-lg text-xs font-medium flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>

        <button
          onClick={() => exportBatchesToCSV(filtered)}
          className="px-3 py-1.5 bg-white border border-[#DED2AC] text-[#3B4636] rounded-lg text-xs font-medium flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          تصدير CSV
        </button>

        <button
          onClick={handleExportPDF}
          className="px-3 py-1.5 bg-white border border-[#DED2AC] text-[#3B4636] rounded-lg text-xs font-medium flex items-center gap-1.5"
        >
          <FileDown className="w-3.5 h-3.5" />
          تصدير PDF
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">{error}</div>
      )}

      <div className="bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl p-4 shadow-sm space-y-2">
        <div className="text-xs font-bold text-[#3B4636] uppercase tracking-wider pb-2 border-b border-[#DED2AC]">
          سجل التقارير ({filtered.length})
        </div>

        {filtered.length === 0 && !loading && (
          <div className="text-center text-xs text-stone-500 py-8">لا توجد تقارير مطابقة.</div>
        )}

        {filtered.map((b) => {
          const severity = batchSeverity(b);
          const isOpen = expanded.has(b.id);
          return (
            <div key={b.id} className={`border rounded-xl overflow-hidden ${rowClass(severity)}`}>
              <button
                type="button"
                onClick={() => toggleExpand(b.id)}
                className="w-full flex items-center justify-between p-3 text-right"
              >
                <div className="flex items-center gap-3 text-xs">
                  {severity === 'regressed' && <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />}
                  {severity === 'stalled' && <Minus className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span className="font-mono text-stone-500 whitespace-nowrap">{formatArabicDate(b.created_at)}</span>
                  <span className="font-bold text-stone-900">{b.employee_name}</span>
                  <span className="text-stone-700">{b.project_name}</span>
                  <span className="text-stone-500">/ {b.building_name}</span>
                  <span className="text-[11px] bg-white border border-[#DED2AC] px-2 py-0.5 rounded-full text-stone-600">
                    {b.lines.length} {b.lines.length === 1 ? 'مهمة' : 'مهام'}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-stone-500" /> : <ChevronDown className="w-4 h-4 text-stone-500" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {b.lines.map((l) => (
                    <div
                      key={l.id}
                      className={`text-xs p-2.5 rounded-lg border flex flex-col gap-1 ${
                        l.flag === 'regressed'
                          ? 'bg-red-100/60 border-red-300'
                          : l.flag === 'stalled'
                          ? 'bg-amber-100/60 border-amber-300'
                          : 'bg-white border-[#DED2AC]'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold text-stone-900">{l.department} — {l.task}</span>
                        <span className="font-mono text-stone-600">
                          {l.previous_percentage}% → <strong>{l.percentage}%</strong>
                        </span>
                      </div>
                      {l.note && (
                        <div className="flex items-start gap-1.5 text-stone-700">
                          {l.flag !== 'none' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />}
                          <span>{l.note}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
