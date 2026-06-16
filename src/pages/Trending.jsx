import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, ChevronUp, ChevronDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SCORES = [
  { key: 'momentum',     label: 'Momentum',     short: 'Mom',  tooltip: 'Recency-weighted return — 1M×40% + 3M×35% + 6M×25%, normalized 0–10' },
  { key: 'acceleration', label: 'Acceleration', short: 'Acc',  tooltip: 'Annualised 3-month return minus 1-year return — funds picking up pace score higher' },
  { key: 'consistency',  label: 'Consistency',  short: 'Con',  tooltip: '% of last 12 months with positive returns, scaled to 10' },
  { key: 'recovery',     label: 'Recovery',     short: 'Rec',  tooltip: '1-month gain offset against any 6-month drawdown — rewards bounce-backs' },
  { key: 'riskAdj',      label: 'Risk-adj',     short: 'Risk', tooltip: '6-month return ÷ monthly volatility (Sharpe-like), normalized 0–10' },
];

const RETURNS = [
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtReturn(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function fmtNavDate(str) {
  if (!str) return '';
  const [d, m, y] = str.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${+d} ${mo[+m - 1]} ${y}`;
}

// ─── Fund card ────────────────────────────────────────────────────────────────

function FundCard({ fund, rank, sortKey }) {
  const scores  = fund.scores  ?? {};
  const returns = fund.returns ?? {};

  const heroScore = SCORES.find(s => s.key === sortKey);
  const heroVal   = scores[sortKey];

  return (
    <div style={{
      background:   'var(--color-background-primary)',
      border:       '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding:      '14px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', paddingTop: 2, width: 20, flexShrink: 0 }}>
          #{rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.35, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {fund.scheme_name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              {fund.category}
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              NAV ₹{fund.nav} · {fmtNavDate(fund.nav_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', margin: '10px 0' }} />

      {/* Hero score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 500, color: '#6366F1', lineHeight: 1 }}>
          {heroVal != null ? heroVal.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {heroScore?.label} score
        </span>
      </div>

      {/* 5 score tiles */}
      <div style={{ display: 'flex', gap: 6 }}>
        {SCORES.map(s => {
          const active = s.key === sortKey;
          const val    = scores[s.key];
          return (
            <div
              key={s.key}
              title={s.tooltip}
              style={{
                flex:         1,
                textAlign:    'center',
                padding:      '5px 4px',
                borderRadius: 'var(--border-radius-md)',
                background:   active ? 'rgba(99,102,241,0.1)' : 'var(--color-background-secondary)',
                cursor:       'default',
              }}
            >
              <span style={{ fontSize: 9, color: active ? '#6366F1' : 'var(--color-text-tertiary)', display: 'block', marginBottom: 2 }}>
                {s.short}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: active ? '#6366F1' : 'var(--color-text-primary)', display: 'block' }}>
                {val != null ? val.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', margin: '10px 0' }} />

      {/* Returns row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {RETURNS.map(r => {
          const val = returns[r.key];
          const pos = val != null && val >= 0;
          return (
            <div key={r.key} style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 2 }}>
                {r.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: val == null ? 'var(--color-text-tertiary)' : pos ? '#059669' : '#E11D48' }}>
                {fmtReturn(val)}
              </span>
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
          <div key={i} className="skeleton h-52 rounded-2xl" />
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
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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

      {/* Meta */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} funds · sorted by {SCORES.find(s => s.key === sortKey)?.label}
          {catFilter !== 'All' && ` · ${catFilter}`}
          {' · hover score tiles for formula'}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Page {page + 1} of {totalPages}</p>
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
                sortKey={sortKey}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0); }}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">{page + 1} / {totalPages}</span>
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
