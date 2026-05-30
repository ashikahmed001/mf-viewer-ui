import { useEffect, useState, useMemo } from 'react';
import {
  Newspaper, TrendingUp, TrendingDown, ArrowRightLeft,
  Zap, ChevronDown, ChevronUp, Filter, Layers,
} from 'lucide-react';
import { getFeed } from '../api/client.js';
import { industryBadgeClass, getIndustryColor } from '../utils/industryColors.js';

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

// ─── Event type config ────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  new_entry:     { label: 'New',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: TrendingUp },
  exit:          { label: 'Exited', color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         dot: 'bg-red-500',     icon: TrendingDown },
  weight_change: { label: 'Change', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',        dot: 'bg-blue-400',    icon: ArrowRightLeft },
};

// ─── Convergence card ─────────────────────────────────────────────────────────

function ConvergenceCard({ item }) {
  const isNew = item.type === 'new_entry';
  const ring  = isNew ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50';
  const badge = isNew ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300';
  const arrow = isNew ? '↑' : '↓';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${ring}`}>
      <div className="flex-shrink-0 mt-0.5">
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${badge}`}>
          <Zap className="w-3 h-3" /> {item.fund_count} funds {arrow}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.stock_name}</p>
        {item.industry && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium mt-0.5 ${industryBadgeClass(item.industry)}`}>
            {item.industry}
          </span>
        )}
        <p className="text-xs text-slate-500 mt-1 truncate">
          {item.fund_names.map(n => n.split(' ').slice(0, 3).join(' ')).join(' · ')}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-sm font-bold text-slate-800">{fmt(item.avg_pct, 4)}%</span>
        <p className="text-xs text-slate-400">avg NAV</p>
      </div>
    </div>
  );
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({ event }) {
  const cfg      = TYPE_CONFIG[event.type] || TYPE_CONFIG.weight_change;
  const isChange = event.type === 'weight_change';
  const isNew    = event.type === 'new_entry';

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{event.stock_name}</span>
          {event.industry && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(event.industry)}`}>
              {event.industry}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate" title={event.fund_name}>
          {event.fund_name.split(' ').slice(0, 4).join(' ')}
          {event.fund_name.split(' ').length > 4 ? '…' : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0 tabular-nums">
        {isChange ? (
          <>
            <div className="text-xs text-slate-500">
              {fmt(event.prev_pct_nav, 4)}%
              <span className="mx-1 text-slate-400">→</span>
              <span className="font-semibold text-slate-700">{fmt(event.pct_nav, 4)}%</span>
            </div>
            <div className={`text-xs font-bold ${event.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {event.delta > 0 ? '+' : ''}{fmt(event.delta, 4)}%
            </div>
          </>
        ) : (
          <div className={`text-sm font-bold ${cfg.color}`}>
            {isNew ? '+' : '-'}{fmt(isNew ? event.pct_nav : event.prev_pct_nav, 4)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event section (New / Exits / Changes) ────────────────────────────────────

function EventSection({ title, events, type, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  if (!events.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        <span className={`text-xs font-semibold ${cfg.color}`}>{title}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cfg.bg}`}>{events.length}</span>
        <span className="ml-auto text-slate-300">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {events.map((e, i) => <EventRow key={`${e.fund_id}-${e.isin}-${i}`} event={e} />)}
        </div>
      )}
    </div>
  );
}

// ─── Month card ───────────────────────────────────────────────────────────────

const MONTH_LEFT_COLORS = ['border-l-blue-500', 'border-l-indigo-400', 'border-l-violet-400', 'border-l-purple-400', 'border-l-fuchsia-400', 'border-l-slate-300'];

function MonthCard({ month, isLatest, index, filter }) {
  const [expanded, setExpanded] = useState(isLatest);
  const { summary, convergence, new_entries, exits, weight_changes } = month;
  const accentColor = MONTH_LEFT_COLORS[Math.min(index, MONTH_LEFT_COLORS.length - 1)];

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${accentColor} rounded-2xl overflow-hidden shadow-sm`}>
      {/* Month header */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`font-bold text-sm ${isLatest ? 'text-slate-900' : 'text-slate-700'}`}>
              {fmtMonth(month.month)}
              {isLatest && <span className="ml-2 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">Latest</span>}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              +{summary.new_entries} in
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">
              -{summary.exits} out
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              ~{summary.changes} changed
            </span>
            {summary.convergence > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-semibold">
                <Zap className="w-3 h-3" /> {summary.convergence} convergence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{summary.funds_active} fund{summary.funds_active !== 1 ? 's' : ''} · {summary.total} events</p>
        </div>
        <span className="text-slate-300 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {convergence.length > 0 && (
            <div className="p-4 border-b border-slate-100 bg-violet-50/40 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700">Convergence — multiple managers moved together</span>
              </div>
              {convergence.map((c, i) => <ConvergenceCard key={`${c.type}-${c.isin}-${i}`} item={c} />)}
            </div>
          )}
          <div className="divide-y divide-slate-100">
            <EventSection key={`${filter}-ne`} title="New Entries" events={new_entries} type="new_entry" defaultOpen={isLatest || filter === 'new_entry'} />
            <EventSection key={`${filter}-ex`} title="Exits" events={exits} type="exit" defaultOpen={isLatest || filter === 'exit'} />
            <EventSection key={`${filter}-wc`} title="Weight Changes" events={weight_changes} type="weight_change" defaultOpen={filter === 'weight_change'} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Feed() {
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [months, setMonths]     = useState(6);
  const [filter, setFilter]     = useState('all');
  const [convOnly, setConvOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getFeed(months)
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
        } else {
          setError(d?.error || 'Unexpected response from server');
          setData([]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [months]);

  const filtered = useMemo(() => {
    return data
      .filter(m => !convOnly || m.summary.convergence > 0)
      .map(m => ({
        ...m,
        new_entries:    filter === 'all' || filter === 'new_entry'     ? m.new_entries    : [],
        exits:          filter === 'all' || filter === 'exit'          ? m.exits          : [],
        weight_changes: filter === 'all' || filter === 'weight_change' ? m.weight_changes : [],
      }));
  }, [data, filter, convOnly]);

  const latest = data[0];

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-500" />
            Activity Feed
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Month-over-month changes across all funds — entries, exits, and conviction shifts.
          </p>
        </div>
        {!loading && !error && latest && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0 mt-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            {fmtMonth(latest.month)}
          </div>
        )}
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      {!loading && !error && latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-white" />}
            label="New Entries" value={latest.summary.new_entries}
            bg="bg-emerald-500" sub="positions opened" />
          <StatCard
            icon={<TrendingDown className="w-4 h-4 text-white" />}
            label="Exits" value={latest.summary.exits}
            bg="bg-red-500" sub="positions closed" />
          <StatCard
            icon={<ArrowRightLeft className="w-4 h-4 text-white" />}
            label="Weight Changes" value={latest.summary.changes}
            bg="bg-blue-500" sub="allocations shifted" />
          <StatCard
            icon={<Zap className="w-4 h-4 text-white" />}
            label="Convergence" value={latest.summary.convergence}
            bg="bg-violet-500" sub={latest.convergence[0]?.stock_name ?? 'none this month'} />
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <Filter className="w-3.5 h-3.5" /> Last
            </span>
            {[3, 6, 9, 12].map(n => (
              <button key={n} onClick={() => setMonths(n)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                  months === n
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                }`}>
                {n}mo
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            {[
              { v: 'all',           label: 'All events' },
              { v: 'new_entry',     label: 'New only' },
              { v: 'exit',          label: 'Exits only' },
              { v: 'weight_change', label: 'Changes only' },
            ].map(({ v, label }) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                  filter === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setConvOnly(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${convOnly ? 'bg-violet-600' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${convOnly ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-violet-500" /> Convergence only
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {filtered.map((m, i) => (
            <MonthCard key={m.month} month={m} isLatest={i === 0} index={i} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`${bg} px-4 py-3 flex items-center justify-between`}>
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="px-4 py-3">
        <div className="text-2xl font-bold text-slate-800 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5 truncate" title={sub}>{sub}</div>}
      </div>
    </div>
  );
}
