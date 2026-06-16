import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val == null) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function ReturnBadge({ val, label }) {
  if (val == null) return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
    </div>
  );
  const pos = val >= 0;
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</span>
      <span className={`text-xs font-semibold ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
        {fmt(val)}
      </span>
    </div>
  );
}

function FundCard({ fund, rank }) {
  const r = fund.returns;
  const score = fund.score;
  const isPositive = score >= 0;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Rank */}
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0 pt-0.5">#{rank}</span>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {fund.scheme_name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5">
              {fund.category}
            </span>
          </div>
        </div>

        {/* Score pill */}
        <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
          isPositive
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {fmt(score)}
        </div>
      </div>

      {/* Returns row */}
      <div className="grid grid-cols-5 gap-1 border-t border-slate-100 dark:border-slate-700 pt-3">
        <ReturnBadge val={r['1w']} label="1W" />
        <ReturnBadge val={r['1m']} label="1M" />
        <ReturnBadge val={r['3m']} label="3M" />
        <ReturnBadge val={r['6m']} label="6M" />
        <ReturnBadge val={r['1y']} label="1Y" />
      </div>

      {/* NAV */}
      <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-right">
        NAV ₹{fund.nav} · {fund.nav_date}
      </div>
    </div>
  );
}

// ─── Sort config ──────────────────────────────────────────────────────────────

const SORT_TABS = [
  { key: 'byScore', label: 'Momentum',  field: 'score',        tooltip: 'Weighted score: 1M×0.4 + 3M×0.35 + 6M×0.25' },
  { key: 'by1m',   label: '1 Month',   field: 'returns.1m'    },
  { key: 'by3m',   label: '3 Months',  field: 'returns.3m'    },
  { key: 'by6m',   label: '6 Months',  field: 'returns.6m'    },
  { key: 'by1y',   label: '1 Year',    field: 'returns.1y'    },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Trending() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);
  const [sortKey, setSortKey]   = useState('byScore');
  const [catFilter, setCatFilter] = useState('All');
  const [direction, setDirection] = useState('desc'); // asc | desc

  const load = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      const d = await getTrending(refresh);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Funds for the active sort tab
  const baseFunds = data?.[sortKey] ?? [];

  // Category filter
  const filtered = useMemo(() => {
    let list = catFilter === 'All' ? baseFunds : baseFunds.filter(f => f.category === catFilter);
    if (direction === 'asc') list = [...list].reverse();
    return list;
  }, [baseFunds, catFilter, direction]);

  // Category options from current sort list (not all categories — only what's visible)
  const categories = useMemo(() => {
    if (!data) return [];
    return ['All', ...data.categories];
  }, [data]);

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700">
      <p className="font-semibold">Failed to load trending data</p>
      <p className="text-sm mt-1">{error}</p>
      <button onClick={() => load()} className="mt-3 text-sm underline">Retry</button>
    </div>
  );

  const activeTab = SORT_TABS.find(t => t.key === sortKey);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-500" />
            Trending Funds
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {data?.total ?? 0} equity &amp; hybrid Direct Growth funds · NAV data from mfapi.in
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {data?.computedAt && (
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
              Updated {new Date(data.computedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              {data.cacheAge > 0 && ` · ${data.cacheAge}m ago`}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-3 mb-6 text-xs text-indigo-700 dark:text-indigo-300">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Returns are point-to-point from actual NAV data. Only Direct Growth plans from major AMCs are shown.
          Results are cached for 6 hours — click Refresh to force recompute.
        </span>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {SORT_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setSortKey(tab.key); setCatFilter('All'); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              sortKey === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Direction toggle */}
        <button
          onClick={() => setDirection(d => d === 'desc' ? 'asc' : 'desc')}
          title={direction === 'desc' ? 'Showing best first' : 'Showing worst first'}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 whitespace-nowrap"
        >
          {direction === 'desc' ? <><ChevronDown className="w-3.5 h-3.5" /> Best first</> : <><ChevronUp className="w-3.5 h-3.5" /> Worst first</>}
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              catFilter === cat
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Showing count */}
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        Showing {filtered.length} funds
        {catFilter !== 'All' && ` in "${catFilter}"`}
        {activeTab?.tooltip && <span className="ml-2 text-slate-300 dark:text-slate-600">· {activeTab.tooltip}</span>}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No funds in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((fund, i) => (
            <FundCard key={fund.scheme_code} fund={fund} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
