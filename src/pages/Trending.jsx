import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, ChevronUp, ChevronDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SCORES = [
  { key: 'momentum',     label: 'Momentum',     short: 'Mom',  color: '#6366F1', tooltip: 'Recency-weighted return — 1M×40% + 3M×35% + 6M×25%, normalized 0–10' },
  { key: 'acceleration', label: 'Acceleration', short: 'Acc',  color: '#F59E0B', tooltip: 'Annualised 3-month return minus 1-year return — funds picking up pace score higher' },
  { key: 'consistency',  label: 'Consistency',  short: 'Con',  color: '#10B981', tooltip: '% of last 12 months with positive returns, scaled to 10' },
  { key: 'recovery',     label: 'Recovery',     short: 'Rec',  color: '#0EA5E9', tooltip: '1-month gain offset against any 6-month drawdown — rewards bounce-backs' },
  { key: 'riskAdj',      label: 'Risk-adj',     short: 'Risk', color: '#A855F7', tooltip: '6-month return ÷ monthly volatility (Sharpe-like), normalized 0–10' },
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

// ─── Score Pill ───────────────────────────────────────────────────────────────

function ScorePill({ score, val, active }) {
  return (
    <div title={score.tooltip} style={{ display: 'flex', justifyContent: 'center' }}>
      <span
        style={{
          display:      'inline-block',
          minWidth:     38,
          textAlign:    'center',
          padding:      '3px 8px',
          borderRadius: 999,
          fontSize:     12,
          fontWeight:   700,
          color:        score.color,
          background:   `${score.color}${active ? '22' : '12'}`,
          outline:      active ? `1.5px solid ${score.color}40` : 'none',
          cursor:       'default',
        }}
      >
        {val != null ? val.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function FundRow({ fund, rank, sortKey }) {
  const scores  = fund.scores  ?? {};
  const returns = fund.returns ?? {};

  return (
    <tr style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}
        className="hover:bg-[var(--color-background-secondary)]">
      {/* Rank */}
      <td style={{ padding: '10px 10px 10px 14px', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {rank}
      </td>

      {/* Fund name + category */}
      <td style={{ padding: '10px 12px', verticalAlign: 'middle', maxWidth: 0, width: '100%' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fund.scheme_name}
        </p>
        <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          {fund.category}
        </p>
      </td>

      {/* Score pills */}
      {SCORES.map(s => (
        <td key={s.key} style={{ padding: '10px 6px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
          <ScorePill score={s} val={scores[s.key]} active={s.key === sortKey} />
        </td>
      ))}

      {/* Returns */}
      {RETURNS.map(r => {
        const val = returns[r.key];
        const pos = val != null && val >= 0;
        return (
          <td
            key={r.key}
            style={{
              padding:      '10px 10px 10px 6px',
              fontSize:     12,
              fontWeight:   500,
              textAlign:    'right',
              whiteSpace:   'nowrap',
              verticalAlign: 'middle',
              color: val == null
                ? 'var(--color-text-tertiary)'
                : pos ? '#059669' : '#E11D48',
            }}
          >
            {fmtReturn(val)}
          </td>
        );
      })}
    </tr>
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

  // ── Loading skeleton ──
  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="skeleton h-96 rounded-xl" />
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700">
      <p className="font-semibold">Failed to load trending data</p>
      <p className="text-sm mt-1">{error}</p>
      <button onClick={() => load()} className="mt-3 text-sm underline">Retry</button>
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
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

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          {SCORES.map(s => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              style={sortKey === s.key ? { background: s.color, color: '#fff' } : {}}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                sortKey === s.key
                  ? ''
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

      {/* ── Meta row ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} funds · sorted by {SCORES.find(s => s.key === sortKey)?.label}
          {catFilter !== 'All' && ` · ${catFilter}`}
          {' · hover score pills for formula'}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Page {page + 1} of {totalPages}</p>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No funds in this category</p>
        </div>
      ) : (
        <>
          <div style={{
            border:       '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            overflow:     'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)' }}>
                    <th style={{ padding: '9px 10px 9px 14px', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>#</th>
                    <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>Fund</th>

                    {SCORES.map(s => (
                      <th
                        key={s.key}
                        style={{
                          padding:    '9px 6px',
                          fontSize:   10,
                          fontWeight: 600,
                          textAlign:  'center',
                          whiteSpace: 'nowrap',
                          color:      s.key === sortKey ? s.color : 'var(--color-text-tertiary)',
                        }}
                      >
                        {s.short}
                        {s.key === sortKey && (
                          direction === 'desc'
                            ? <ChevronDown style={{ display: 'inline', width: 10, height: 10, marginLeft: 2, verticalAlign: 'middle' }} />
                            : <ChevronUp   style={{ display: 'inline', width: 10, height: 10, marginLeft: 2, verticalAlign: 'middle' }} />
                        )}
                      </th>
                    ))}

                    {RETURNS.map(r => (
                      <th
                        key={r.key}
                        style={{ padding: '9px 10px 9px 6px', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((fund, i) => (
                    <FundRow
                      key={fund.scheme_code}
                      fund={fund}
                      rank={page * PAGE_SIZE + i + 1}
                      sortKey={sortKey}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
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
