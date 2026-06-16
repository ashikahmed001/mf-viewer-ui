import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, ChevronUp, ChevronDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Score config ──────────────────────────────────────────────────────────────

const SCORES = [
  {
    key:     'momentum',
    label:   'Momentum',
    color:   '#6366F1',   // indigo
    tooltip: 'Recency-weighted return — 1M×40% + 3M×35% + 6M×25%, normalized 0–10 across all funds',
  },
  {
    key:     'acceleration',
    label:   'Acceleration',
    color:   '#F59E0B',   // amber
    tooltip: 'Annualised 3-month return minus 1-year return — funds picking up pace score higher',
  },
  {
    key:     'consistency',
    label:   'Consistency',
    color:   '#10B981',   // emerald
    tooltip: '% of the last 12 months with positive returns, scaled to 10',
  },
  {
    key:     'recovery',
    label:   'Recovery',
    color:   '#0EA5E9',   // sky
    tooltip: '1-month gain offset against any 6-month drawdown — rewards funds bouncing back',
  },
  {
    key:     'riskAdj',
    label:   'Risk-adj',
    color:   '#A855F7',   // purple
    tooltip: '6-month return ÷ monthly return volatility (Sharpe-like), normalized 0–10',
  },
];

const PAGE_SIZE = 50;
const DOTS      = 20;
// SVG dot layout constants
const DOT_R     = 2.5;   // radius px
const DOT_GAP   = 7;     // center-to-center px
const SVG_W     = DOTS * DOT_GAP - (DOT_GAP - DOT_R * 2);   // ~134
const SVG_H     = DOT_R * 2;                                   // 5

// ─── Dot bar — single SVG element, no per-dot DOM nodes ───────────────────────

function DotBar({ value, color, muted }) {
  const filled = value != null ? Math.round((value / 10) * DOTS) : 0;
  const dotColor = muted ? '#CBD5E1' : color;   // slate-300 when not best

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block', overflow: 'visible' }}
      preserveAspectRatio="none"
    >
      {Array.from({ length: DOTS }).map((_, i) => (
        <circle
          key={i}
          cx={i * DOT_GAP + DOT_R}
          cy={DOT_R}
          r={DOT_R}
          fill={dotColor}
          opacity={i < filled ? (muted ? 0.7 : 1) : 0.15}
        />
      ))}
    </svg>
  );
}

// ─── Score row ────────────────────────────────────────────────────────────────

function ScoreRow({ s, value, isHighest }) {
  const display = value != null ? value.toFixed(1) : '—';

  return (
    <div
      title={s.tooltip}
      className="flex items-center gap-2 rounded cursor-default"
      style={{
        padding:         isHighest ? '3px 6px 3px 5px' : '2px 0',
        margin:          isHighest ? '1px -6px' : undefined,
        backgroundColor: isHighest ? `${s.color}18` : undefined,
        borderLeft:      isHighest ? `2.5px solid ${s.color}` : undefined,
      }}
    >
      {/* Label — fixed width 80px */}
      <span
        className="text-[11px] shrink-0 truncate"
        style={{
          width:      80,
          color:      isHighest ? s.color : '#94A3B8',
          fontWeight: isHighest ? 600 : 400,
        }}
      >
        {s.label}{isHighest && (
          <span
            className="ml-1 text-[8px] font-bold px-1 py-px rounded"
            style={{ backgroundColor: `${s.color}20`, color: s.color }}
          >
            BEST
          </span>
        )}
      </span>

      {/* Dot bar — fills remaining space */}
      <div className="flex-1 min-w-0">
        <DotBar value={value} color={s.color} muted={!isHighest} />
      </div>

      {/* Score number — fixed 28px */}
      <span
        className="text-[11px] font-semibold tabular-nums shrink-0 text-right"
        style={{ width: 28, color: isHighest ? s.color : '#94A3B8' }}
      >
        {display}
      </span>
    </div>
  );
}

// ─── Fund card ────────────────────────────────────────────────────────────────

function fmtNavDate(str) {
  if (!str) return '';
  const [d, m, y] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${+d} ${months[+m - 1]} ${y}`;
}

function FundCard({ fund, rank }) {
  const scores = fund.scores ?? {};

  const highestKey = SCORES.reduce((best, s) => {
    return (scores[s.key] ?? -Infinity) > (scores[best] ?? -Infinity) ? s.key : best;
  }, SCORES[0].key);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-bold text-slate-300 dark:text-slate-600 shrink-0 pt-0.5 w-5">
          #{rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {fund.scheme_name}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5 shrink-0">
              {fund.category}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              NAV ₹{fund.nav} · {fmtNavDate(fund.nav_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Score rows */}
      <div className="space-y-0.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
        {SCORES.map(s => (
          <ScoreRow
            key={s.key}
            s={s}
            value={scores[s.key] ?? null}
            isHighest={s.key === highestKey}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Trending() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [sortKey, setSortKey]       = useState('momentum');
  const [catFilter, setCatFilter]   = useState('All');
  const [direction, setDirection]   = useState('desc');
  const [page, setPage]             = useState(0);

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
  useEffect(() => { setPage(0); }, [sortKey, catFilter, direction]);

  const filtered = useMemo(() => {
    if (!data?.funds) return [];
    let list = [...data.funds];
    if (catFilter !== 'All') list = list.filter(f => f.category === catFilter);
    list.sort((a, b) => {
      const av = a.scores?.[sortKey] ?? -Infinity;
      const bv = b.scores?.[sortKey] ?? -Infinity;
      return bv - av;
    });
    if (direction === 'asc') list.reverse();
    return list;
  }, [data, sortKey, catFilter, direction]);

  const paginated  = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const categories = useMemo(
    () => (!data ? ['All'] : ['All', ...data.categories]),
    [data],
  );

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-2xl" />
        ))}
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
            {data?.total ?? 0} equity &amp; hybrid Direct Growth funds · 5-dimensional score analysis
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

      {/* Controls */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* Score tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {SCORES.map(s => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                sortKey === s.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5
                         bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setDirection(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            {direction === 'desc'
              ? <><ChevronDown className="w-3.5 h-3.5" /> Best first</>
              : <><ChevronUp   className="w-3.5 h-3.5" /> Worst first</>}
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} funds · sorted by {SCORES.find(s => s.key === sortKey)?.label}
          {catFilter !== 'All' && ` · ${catFilter}`}
          {' · hover a row for score formula'}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Page {page + 1} of {totalPages}
          </p>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No funds in this category</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((fund, i) => (
              <FundCard
                key={fund.scheme_code}
                fund={fund}
                rank={page * PAGE_SIZE + i + 1}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0); }}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
