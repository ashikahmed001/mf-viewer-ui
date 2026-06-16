import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, Info, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Score config ──────────────────────────────────────────────────────────────

const SCORES = [
  {
    key:       'momentum',
    label:     'Momentum',
    color:     '#6366F1',
    textClass: 'text-indigo-500',
    tooltip:   'Recency-weighted return — 1M×40% + 3M×35% + 6M×25%, normalized 0–10 across all funds',
  },
  {
    key:       'acceleration',
    label:     'Acceleration',
    color:     '#F59E0B',
    textClass: 'text-amber-500',
    tooltip:   'Annualised 3-month return minus 1-year return — funds picking up pace score higher',
  },
  {
    key:       'consistency',
    label:     'Consistency',
    color:     '#10B981',
    textClass: 'text-emerald-500',
    tooltip:   '% of the last 12 months with positive returns, scaled to 10',
  },
  {
    key:       'recovery',
    label:     'Recovery',
    color:     '#0EA5E9',
    textClass: 'text-sky-500',
    tooltip:   '1-month gain offset against any 6-month drawdown — rewards funds bouncing back from a dip',
  },
  {
    key:       'riskAdj',
    label:     'Risk-adj',
    color:     '#A855F7',
    textClass: 'text-purple-500',
    tooltip:   '6-month return divided by monthly return volatility (Sharpe-like ratio), normalized 0–10',
  },
];

const SORT_TABS = SCORES.map(s => ({ key: s.key, label: s.label }));

// ─── Dot meter ────────────────────────────────────────────────────────────────

function DotMeter({ value, color, totalDots = 20 }) {
  const filled = value != null ? Math.round((value / 10) * totalDots) : 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
      {Array.from({ length: totalDots }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: i < filled ? 1 : 0.13,
          }}
        />
      ))}
    </div>
  );
}

// ─── Score tooltip ────────────────────────────────────────────────────────────

function ScoreTooltip({ text }) {
  return (
    <div className="relative inline-flex items-center group ml-0.5">
      <Info className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 cursor-help transition-colors" />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="w-52 text-[11px] bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-xl px-3 py-2 shadow-2xl leading-relaxed whitespace-normal">
          {text}
        </div>
        <div className="w-2 h-2 bg-slate-900 dark:bg-slate-950 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}

// ─── Fund card ────────────────────────────────────────────────────────────────

function FundCard({ fund, rank }) {
  const scores = fund.scores ?? {};

  // Per-card: find which score is highest
  const highestKey = SCORES.reduce((best, s) => {
    const v    = scores[s.key] ?? -Infinity;
    const bestV = scores[best] ?? -Infinity;
    return v > bestV ? s.key : best;
  }, SCORES[0].key);

  const highestScore = SCORES.find(s => s.key === highestKey);

  // Format NAV date "DD-MM-YYYY" → "D Mon YYYY"
  function fmtNavDate(str) {
    if (!str) return '';
    const [d, m, y] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${+d} ${months[+m - 1]} ${y}`;
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0 pt-0.5">
          #{rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {fund.scheme_name}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5">
              {fund.category}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              NAV ₹{fund.nav} · {fmtNavDate(fund.nav_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Score rows */}
      <div className="space-y-1.5">
        {SCORES.map(s => {
          const val       = scores[s.key];
          const isHighest = s.key === highestKey;
          const display   = val != null ? val.toFixed(1) : '—';

          return (
            <div
              key={s.key}
              style={{
                backgroundColor: isHighest ? `${s.color}18` : 'transparent',
                borderRadius: 8,
                padding: isHighest ? '6px 8px' : '2px 0',
              }}
            >
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: isHighest ? s.color : undefined }}
                  >
                    {!isHighest && (
                      <span className="text-slate-400 dark:text-slate-500">{s.label}</span>
                    )}
                    {isHighest && s.label}
                  </span>
                  {isHighest && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: `${s.color}22`, color: s.color }}
                    >
                      BEST
                    </span>
                  )}
                  <ScoreTooltip text={s.tooltip} />
                </div>
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: isHighest ? s.color : undefined }}
                >
                  {!isHighest && <span className="text-slate-400 dark:text-slate-500">{display}</span>}
                  {isHighest && display}
                </span>
              </div>

              {/* Dot meter */}
              <DotMeter value={val} color={s.color} />
            </div>
          );
        })}
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

  const categories = useMemo(() => {
    if (!data) return ['All'];
    return ['All', ...data.categories];
  }, [data]);

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
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

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-3 mb-6 text-xs text-indigo-700 dark:text-indigo-300">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Each fund is scored across 5 dimensions — hover the <strong>ⓘ</strong> on any row for the formula.
          All scores are normalized 0–10 across all funds. Cached for 6 hours.
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* Score sort tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {SORT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSortKey(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                sortKey === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Category dropdown */}
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

          {/* Direction toggle */}
          <button
            onClick={() => setDirection(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            {direction === 'desc'
              ? <><ChevronDown className="w-3.5 h-3.5" /> Best first</>
              : <><ChevronUp className="w-3.5 h-3.5" /> Worst first</>}
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        Showing {filtered.length} funds
        {catFilter !== 'All' && ` · ${catFilter}`}
        {' · sorted by '}
        {SCORES.find(s => s.key === sortKey)?.label}
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
