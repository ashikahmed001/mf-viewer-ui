import { ChevronDown } from 'lucide-react';

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

export default function MonthSelector({ extractions, value, onChange, label = 'Select Month' }) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 pr-10
                   text-slate-800 dark:text-slate-200 font-medium shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                   cursor-pointer"
      >
        <option value="">{label}</option>
        {(extractions || []).map(e => (
          <option key={e.id} value={e.id}>
            {fmtMonth(e.report_month)} — {e.confidence_label?.charAt(0).toUpperCase() + e.confidence_label?.slice(1).toLowerCase()} ({e.holding_count} holdings)
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
    </div>
  );
}
