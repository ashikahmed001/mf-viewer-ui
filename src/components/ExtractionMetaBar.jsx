import { FileText, Calendar, Hash, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const confidenceConfig = {
  High:   { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200',  icon: CheckCircle,     dot: 'bg-green-500' },
  Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: Info,            dot: 'bg-yellow-500' },
  Low:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200',    icon: AlertTriangle,   dot: 'bg-red-500' },
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

export default function ExtractionMetaBar({ extraction }) {
  if (!extraction) return null;

  // Normalise casing — DB may store "high", "HIGH", or "High"
  const rawLabel = extraction.confidence_label || '';
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() || 'Medium';
  const cfg = confidenceConfig[label] || confidenceConfig.Medium;
  const Icon = cfg.icon;

  return (
    <div className="space-y-3">
      {/* Low confidence warning */}
      {label === 'Low' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Low Confidence Extraction</p>
            <p className="text-sm text-red-600 mt-0.5">
              Data accuracy may be reduced. Review the source file before relying on these figures.
              {extraction.notes && <span className="block mt-1 italic">"{extraction.notes}"</span>}
            </p>
          </div>
        </div>
      )}

      {/* Meta bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetaCard icon={<Calendar className="w-4 h-4" />} label="Report Month" value={fmt(extraction.report_month)} />
        <MetaCard icon={<Hash className="w-4 h-4" />} label="Holdings Count" value={extraction.holding_count?.toLocaleString()} />
        <MetaCard icon={<FileText className="w-4 h-4" />} label="Source File" value={extraction.source_file} truncate />
        <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text} mb-1`}>
            <Icon className="w-3.5 h-3.5" />
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className={`font-semibold text-sm ${cfg.text}`}>{label}</span>
            <span className={`text-xs ${cfg.text} opacity-70`}>({extraction.confidence_score}%)</span>
          </div>
        </div>
      </div>

      {/* Notes (non-low) */}
      {label !== 'Low' && extraction.notes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-600 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <span>{extraction.notes}</span>
        </div>
      )}
    </div>
  );
}

function MetaCard({ icon, label, value, truncate }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`font-semibold text-sm text-slate-800 ${truncate ? 'truncate' : ''}`} title={value}>
        {value || '—'}
      </div>
    </div>
  );
}
