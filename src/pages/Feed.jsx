import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Newspaper, TrendingUp, TrendingDown, ArrowRightLeft,
  Zap, ChevronDown, ChevronUp, SlidersHorizontal, Star, Check, X,
} from 'lucide-react';
import { getFeed, getFunds } from '../api/client.js';
import { industryBadgeClass } from '../utils/industryColors.js';

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function savePref(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

function shortName(name) {
  // Drop common suffixes and cap at 4 words for compact display
  return name
    .replace(/\s*-?\s*(direct|regular|growth|idcw|plan|fund)\b/gi, '')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}

// ─── Signal type config ───────────────────────────────────────────────────────

const SIGNALS = [
  { id: 'all',           label: 'All signals',   color: 'slate',   Icon: SlidersHorizontal },
  { id: 'new_entry',     label: 'New entries',   color: 'emerald', Icon: TrendingUp },
  { id: 'exit',          label: 'Exits',         color: 'red',     Icon: TrendingDown },
  { id: 'weight_change', label: 'Weight shifts', color: 'blue',    Icon: ArrowRightLeft },
  { id: 'convergence',   label: 'Convergence',   color: 'violet',  Icon: Zap },
];

const TYPE_CFG = {
  new_entry:     { dot: 'bg-emerald-500', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  exit:          { dot: 'bg-red-500',     color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  weight_change: { dot: 'bg-blue-400',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
};

// Significance thresholds
const NOTABLE = { entry: 0.5, exit: 0.5, delta: 0.3 };

// ─── Fund multi-select dropdown ───────────────────────────────────────────────

function FundPicker({ funds, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const allSelected = selected.length === 0 || selected.length === funds.length;
  const label = allSelected
    ? 'All funds'
    : selected.length === 1
      ? shortName(funds.find(f => f.id === selected[0])?.name ?? '')
      : `${selected.length} funds`;

  function toggle(id) {
    if (selected.includes(id)) {
      const next = selected.filter(x => x !== id);
      onChange(next.length === funds.length ? [] : next);
    } else {
      const next = [...selected, id];
      onChange(next.length === funds.length ? [] : next);
    }
  }

  function selectOnly(id) { onChange([id]); }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
          ${!allSelected
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:border-slate-400'}`}
      >
        <Star className={`w-3.5 h-3.5 ${!allSelected ? 'text-amber-500 fill-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
        {label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Track funds</span>
            {!allSelected && (
              <button onClick={() => onChange([])} className="text-xs text-blue-600 hover:underline">
                Show all
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {funds.map(f => {
              const checked = allSelected || selected.includes(f.id);
              return (
                <div key={f.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 group">
                  <button
                    className="flex items-center gap-2.5 flex-1 text-left"
                    onClick={() => toggle(f.id)}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                      ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{shortName(f.name)}</span>
                  </button>
                  <button
                    onClick={() => selectOnly(f.id)}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
                  >
                    only
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Convergence card ─────────────────────────────────────────────────────────

function ConvergenceCard({ item }) {
  const isNew = item.type === 'new_entry';
  const ring  = isNew ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50';
  const badge = isNew ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${ring}`}>
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 mt-0.5 ${badge}`}>
        <Zap className="w-3 h-3" /> {item.fund_count} funds
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.stock_name}</p>
        {item.industry && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium mt-0.5 ${industryBadgeClass(item.industry)}`}>
            {item.industry}
          </span>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 truncate">
          {item.fund_names.map(n => shortName(n)).join(' · ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(item.avg_pct, 4)}%</span>
        <p className="text-xs text-slate-400 dark:text-slate-500">avg NAV</p>
      </div>
    </div>
  );
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({ event }) {
  const cfg     = TYPE_CFG[event.type] || TYPE_CFG.weight_change;
  const isChange = event.type === 'weight_change';
  const isNew    = event.type === 'new_entry';

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{event.stock_name}</span>
          {event.industry && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(event.industry)}`}>
              {event.industry}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{shortName(event.fund_name)}</p>
      </div>
      <div className="text-right shrink-0 tabular-nums">
        {isChange ? (
          <>
            <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {fmt(event.prev_pct_nav, 4)}%
              <span className="mx-1 text-slate-300">→</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(event.pct_nav, 4)}%</span>
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

// ─── Collapsible event section ────────────────────────────────────────────────

function EventSection({ title, events, type, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = TYPE_CFG[type];
  if (!events.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
      >
        <span className={`text-xs font-semibold ${cfg.color}`}>{title}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cfg.bg}`}>{events.length}</span>
        <span className="ml-auto text-slate-300">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {events.map((e, i) => <EventRow key={`${e.fund_id}-${e.isin}-${i}`} event={e} />)}
        </div>
      )}
    </div>
  );
}

// ─── Month card ───────────────────────────────────────────────────────────────

const ACCENTS = [
  'border-l-blue-500', 'border-l-indigo-400', 'border-l-violet-400',
  'border-l-purple-400', 'border-l-fuchsia-400', 'border-l-slate-300',
];

function MonthCard({ month, isLatest, index, signal }) {
  const [expanded, setExpanded] = useState(isLatest);
  const { summary, convergence, new_entries, exits, weight_changes } = month;
  const totalShown = new_entries.length + exits.length + weight_changes.length + convergence.length;

  if (totalShown === 0 && !isLatest) return null;

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-4 ${ACCENTS[Math.min(index, ACCENTS.length - 1)]} rounded-2xl overflow-hidden shadow-sm`}>
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`font-bold text-sm ${isLatest ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
              {fmtMonth(month.month)}
              {isLatest && <span className="ml-2 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">Latest</span>}
            </span>
            {new_entries.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                +{new_entries.length} in
              </span>
            )}
            {exits.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">
                -{exits.length} out
              </span>
            )}
            {weight_changes.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                ~{weight_changes.length} shifted
              </span>
            )}
            {convergence.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-semibold">
                <Zap className="w-3 h-3 inline mr-0.5" />{convergence.length} converge
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {summary.funds_active} fund{summary.funds_active !== 1 ? 's' : ''} · {totalShown} events shown
          </p>
        </div>
        <span className="text-slate-300 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {convergence.length > 0 && (signal === 'all' || signal === 'convergence') && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-violet-50/40 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700">Convergence — multiple managers moved together</span>
              </div>
              {convergence.map((c, i) => <ConvergenceCard key={`${c.type}-${c.isin}-${i}`} item={c} />)}
            </div>
          )}
          {signal !== 'convergence' && (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <EventSection title="New Entries"    events={new_entries}    type="new_entry"     defaultOpen={isLatest || signal === 'new_entry'} />
              <EventSection title="Exits"          events={exits}          type="exit"          defaultOpen={isLatest || signal === 'exit'} />
              <EventSection title="Weight Shifts"  events={weight_changes} type="weight_change" defaultOpen={signal === 'weight_change'} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Feed() {
  const [data,    setData]    = useState([]);
  const [funds,   setFunds]   = useState([]);   // [{id, name}]
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Persistent prefs
  const [months,     setMonths]     = useState(() => loadPref('feed_months', 6));
  const [signal,     setSignal]     = useState(() => loadPref('feed_signal', 'all'));
  const [notable,    setNotable]    = useState(() => loadPref('feed_notable', false));
  const [favFunds,   setFavFunds]   = useState(() => loadPref('feed_favFunds', [])); // [] = all

  // Persist on change
  useEffect(() => savePref('feed_months',   months),   [months]);
  useEffect(() => savePref('feed_signal',   signal),   [signal]);
  useEffect(() => savePref('feed_notable',  notable),  [notable]);
  useEffect(() => savePref('feed_favFunds', favFunds), [favFunds]);

  // Load feed data
  useEffect(() => {
    setLoading(true); setError(null);
    getFeed(months)
      .then(d => Array.isArray(d) ? setData(d) : (setError(d?.error || 'Unexpected response'), setData([])))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [months]);

  // Load fund list for picker
  useEffect(() => {
    getFunds().then(list => setFunds(list.map(f => ({ id: f.id, name: f.name })))).catch(() => {});
  }, []);

  // Derive active fund IDs for filtering
  const activeFundIds = useMemo(() => {
    if (!favFunds.length) return null; // null = all
    return new Set(favFunds);
  }, [favFunds]);

  // Apply all filters
  const filtered = useMemo(() => {
    return data.map(m => {
      let { new_entries, exits, weight_changes, convergence } = m;

      // Fund filter
      if (activeFundIds) {
        new_entries    = new_entries.filter(e => activeFundIds.has(e.fund_id));
        exits          = exits.filter(e => activeFundIds.has(e.fund_id));
        weight_changes = weight_changes.filter(e => activeFundIds.has(e.fund_id));
        // Only keep convergence where ≥2 of YOUR selected funds moved together
        convergence = convergence
          .map(c => ({
            ...c,
            fund_ids:   c.fund_ids?.filter(id => activeFundIds.has(id)) ?? [],
            fund_names: c.fund_names?.filter((_, i) => activeFundIds.has(c.fund_ids?.[i])) ?? [],
          }))
          .filter(c => c.fund_ids.length >= 2)
          .map(c => ({ ...c, fund_count: c.fund_ids.length }));
      }

      // Signal filter
      if (signal === 'new_entry')     { exits = []; weight_changes = []; }
      if (signal === 'exit')          { new_entries = []; weight_changes = []; }
      if (signal === 'weight_change') { new_entries = []; exits = []; convergence = []; }
      if (signal === 'convergence')   { new_entries = []; exits = []; weight_changes = []; }

      // Notable-only filter (raises the bar above the DB MIN_DELTA)
      if (notable) {
        new_entries    = new_entries.filter(e => (e.pct_nav ?? 0) >= NOTABLE.entry);
        exits          = exits.filter(e => (e.prev_pct_nav ?? 0) >= NOTABLE.exit);
        weight_changes = weight_changes.filter(e => Math.abs(e.delta) >= NOTABLE.delta);
      }

      return { ...m, new_entries, exits, weight_changes, convergence };
    });
  }, [data, activeFundIds, signal, notable]);

  const latest = filtered[0];
  const totalEvents = filtered.reduce((s, m) => s + m.new_entries.length + m.exits.length + m.weight_changes.length, 0);

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-500" />
            Activity Feed
          </h1>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mt-1">
            Month-over-month changes — entries, exits, and conviction shifts.
          </p>
        </div>
        {!loading && !error && latest && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 shrink-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            {fmtMonth(latest.month)}
          </div>
        )}
      </div>

      {/* ── Stat cards (latest month, after filters) ─────────────────────── */}
      {!loading && !error && latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<TrendingUp className="w-4 h-4 text-white" />}     label="New Entries"    value={latest.new_entries.length}    bg="bg-emerald-500" sub="positions opened" />
          <StatCard icon={<TrendingDown className="w-4 h-4 text-white" />}   label="Exits"          value={latest.exits.length}          bg="bg-red-500"     sub="positions closed" />
          <StatCard icon={<ArrowRightLeft className="w-4 h-4 text-white" />} label="Weight Shifts"  value={latest.weight_changes.length} bg="bg-blue-500"    sub="allocations shifted" />
          <StatCard icon={<Zap className="w-4 h-4 text-white" />}            label="Convergence"    value={latest.convergence.length}    bg="bg-violet-500"  sub={latest.convergence[0]?.stock_name ?? 'none this month'} />
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 shadow-sm mb-6 space-y-3">

        {/* Row 1: Lookback + fund picker */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Last</span>
          <div className="flex items-center gap-1.5">
            {[3, 6, 9, 12].map(n => (
              <button key={n} onClick={() => setMonths(n)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                  months === n
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}>
                {n}mo
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {/* Fund picker */}
          {funds.length > 0 && (
            <FundPicker funds={funds} selected={favFunds} onChange={setFavFunds} />
          )}

          {/* Notable toggle */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <button
              onClick={() => setNotable(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0
                ${notable ? 'bg-slate-800' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${notable ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 whitespace-nowrap">Notable only</span>
          </label>
        </div>

        {/* Row 2: Signal type chips */}
        <div className="flex flex-wrap gap-2">
          {SIGNALS.map(({ id, label, color, Icon }) => {
            const active = signal === id;
            const base = {
              slate:   active ? 'bg-slate-900 text-white border-slate-900'   : 'text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400',
              emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'text-emerald-700 border-emerald-200 hover:border-emerald-400 bg-emerald-50',
              red:     active ? 'bg-red-600 text-white border-red-600'       : 'text-red-700 border-red-200 hover:border-red-400 bg-red-50',
              blue:    active ? 'bg-blue-600 text-white border-blue-600'     : 'text-blue-700 border-blue-200 hover:border-blue-400 bg-blue-50',
              violet:  active ? 'bg-violet-600 text-white border-violet-600' : 'text-violet-700 border-violet-200 hover:border-violet-400 bg-violet-50',
            }[color];
            return (
              <button key={id} onClick={() => setSignal(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${base}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })}

          {/* Active filters summary */}
          {(favFunds.length > 0 || notable) && (
            <button
              onClick={() => { setFavFunds([]); setNotable(false); setSignal('all'); }}
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Reset filters
            </button>
          )}
        </div>

        {/* Notable threshold hint */}
        {notable && (
          <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2.5">
            Notable threshold: entries ≥ {NOTABLE.entry}% NAV · exits ≥ {NOTABLE.exit}% NAV · weight shifts ≥ {NOTABLE.delta}%
          </p>
        )}
      </div>

      {/* ── Active fund chips ─────────────────────────────────────────────── */}
      {favFunds.length > 0 && funds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {favFunds.map(id => {
            const f = funds.find(x => x.id === id);
            if (!f) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-full">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {shortName(f.name)}
                <button onClick={() => setFavFunds(prev => prev.filter(x => x !== id))} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Error / Loading / Content ─────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      )}

      {!loading && !error && (
        <>
          {totalEvents === 0 && !loading && (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
              <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No events match your current filters.</p>
              <button onClick={() => { setSignal('all'); setNotable(false); setFavFunds([]); }}
                className="mt-2 text-sm text-blue-600 hover:underline">
                Reset filters
              </button>
            </div>
          )}
          <div className="space-y-4">
            {filtered.map((m, i) => (
              <MonthCard key={m.month} month={m} isLatest={i === 0} index={i} signal={signal} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      <div className={`${bg} px-4 py-3 flex items-center justify-between`}>
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="px-4 py-3">
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={sub}>{sub}</div>}
      </div>
    </div>
  );
}
