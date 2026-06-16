import { useEffect, useState, useMemo, useRef } from 'react';
import { TrendingUp, RefreshCw, Filter, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { getTrending } from '../api/client.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SCORES = [
  {
    key: 'momentum', label: 'Momentum', short: 'Mom', color: '#6366F1',
    formula:     '1M × 40% + 3M × 35% + 6M × 25%',
    what:        'Measures how strongly a fund has been gaining recently by weighting short-term returns more heavily than older ones.',
    high:        'Fund has delivered strong returns across all recent periods — consistent upward movement.',
    low:         'Recent returns are weak or negative; the fund may be losing steam.',
  },
  {
    key: 'acceleration', label: 'Acceleration', short: 'Acc', color: '#F59E0B',
    formula:     'Annualised 3M return − 1Y return',
    what:        'Captures whether a fund is speeding up — i.e. its recent pace is outrunning its longer-term average.',
    high:        'Fund is accelerating: the last 3 months are outpacing the full-year trend.',
    low:         'Fund is decelerating or has slowed down compared to its 1-year trajectory.',
  },
  {
    key: 'consistency', label: 'Consistency', short: 'Con', color: '#10B981',
    formula:     '(Positive months ÷ 12) × 100, scaled 0–10',
    what:        'Measures how reliably a fund delivers positive returns across the last 12 months, regardless of magnitude.',
    high:        'Fund rarely has down months — steady and dependable across market conditions.',
    low:         'Fund frequently posts negative monthly returns; performance is erratic.',
  },
  {
    key: 'recovery', label: 'Recovery', short: 'Rec', color: '#0EA5E9',
    formula:     '1M return − min(0, 6M return)',
    what:        'Rewards funds that bounced back after a drawdown. If the 6M return was negative, it adds that as extra credit for the 1M rebound.',
    high:        'Fund recovered sharply from recent weakness — strong bounce-back signal.',
    low:         'Fund is still in drawdown or the 1M recovery is minimal.',
  },
  {
    key: 'riskAdj', label: 'Risk-adj', short: 'Risk', color: '#A855F7',
    formula:     '6M return ÷ monthly return std dev',
    what:        'A Sharpe-like ratio: how much return the fund earned per unit of volatility over 6 months. Normalized 0–10 across all funds.',
    high:        'Fund delivered strong returns with low volatility — efficient risk-reward.',
    low:         'Either returns are weak or the fund is very volatile relative to its gain.',
  },
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

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function ScoreTooltip({ score, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const show = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // prefer below, but clamp to viewport
    let top  = rect.bottom + 8;
    let left = rect.left + rect.width / 2;
    setPos({ top, left });
    setVisible(true);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
      {visible && (
        <div style={{
          position:      'fixed',
          top:           pos.top,
          left:          pos.left,
          transform:     'translateX(-50%)',
          zIndex:        9999,
          background:    'var(--color-background-primary)',
          border:        `1px solid ${score.color}30`,
          borderTop:     `2px solid ${score.color}`,
          borderRadius:  10,
          padding:       '12px 14px',
          width:         260,
          boxShadow:     '0 8px 24px rgba(0,0,0,0.14)',
          pointerEvents: 'none',
          textAlign:     'left',
        }}>
          {/* Title */}
          <p style={{ fontSize: 12, fontWeight: 700, color: score.color, marginBottom: 6 }}>
            {score.label}
          </p>

          {/* What it measures */}
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
            {score.what}
          </p>

          {/* Formula */}
          <div style={{ background: `${score.color}10`, borderRadius: 6, padding: '5px 8px', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: score.color, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>
              Formula
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {score.formula}
            </span>
          </div>

          {/* High / Low */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', flexShrink: 0, marginTop: 1 }}>High</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{score.high}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#E11D48', flexShrink: 0, marginTop: 1 }}>Low</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{score.low}</span>
            </div>
          </div>

        </div>
      )}
    </span>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

function SortTh({ score, sortKey, direction, onSort, isLast }) {
  const active = sortKey === score.key;
  const Icon   = active ? (direction === 'desc' ? ChevronDown : ChevronUp) : ChevronsUpDown;

  return (
    <th
      style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}
      className={isLast ? 'border-r border-slate-200 dark:border-slate-700' : ''}
    >
      <button
        onClick={() => onSort(score.key)}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        3,
          fontSize:   10,
          fontWeight: active ? 700 : 600,
          color:      active ? score.color : 'var(--color-text-tertiary)',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    0,
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {score.short}
        <Icon style={{ width: 10, height: 10, flexShrink: 0, opacity: active ? 1 : 0.4 }} />
      </button>
    </th>
  );
}

// ─── Score Pill ───────────────────────────────────────────────────────────────

function ScorePill({ score, val, active }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span style={{
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
      }}>
        {val != null ? val.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function FundRow({ fund, rank, sortKey, odd }) {
  const scores  = fund.scores  ?? {};
  const returns = fund.returns ?? {};
  const B = '#e2e8f0'; // slate-200, reliable visible border

  return (
    <tr
      style={{ borderTop: `1px solid ${B}`, background: odd ? '#f8fafc' : '#ffffff' }}
      className="dark:border-slate-700 dark:odd:bg-slate-800/40 dark:even:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
    >
      <td style={{ padding: '11px 10px 11px 16px', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', verticalAlign: 'middle', borderRight: `1px solid ${B}` }}
          className="dark:border-slate-700">
        {rank}
      </td>

      <td style={{ padding: '11px 14px', verticalAlign: 'middle', maxWidth: 0, width: '100%', borderRight: `1px solid ${B}` }}
          className="dark:border-slate-700">
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fund.scheme_name}
        </p>
        <div style={{ marginTop: 4 }}>
          <span style={{
            display:      'inline-block',
            fontSize:     9,
            fontWeight:   500,
            padding:      '2px 7px',
            borderRadius: 999,
            background:   '#f1f5f9',
            color:        '#64748b',
            whiteSpace:   'nowrap',
          }}>
            {fund.category}
          </span>
        </div>
      </td>

      {SCORES.map((s, i) => (
        <td key={s.key} style={{
          padding:     '8px 6px',
          whiteSpace:  'nowrap',
          verticalAlign: 'middle',
          borderRight: i === SCORES.length - 1 ? '1px solid #e2e8f0' : 'none',
        }} className={i === SCORES.length - 1 ? 'dark:border-slate-700' : ''}>
          <ScorePill score={s} val={scores[s.key]} active={s.key === sortKey} />
        </td>
      ))}

      {RETURNS.map(r => {
        const val = returns[r.key];
        const pos = val != null && val >= 0;
        return (
          <td key={r.key} style={{
            padding:       '11px 14px 11px 6px',
            fontSize:      12,
            fontWeight:    500,
            textAlign:     'right',
            whiteSpace:    'nowrap',
            verticalAlign: 'middle',
            color: val == null
              ? 'var(--color-text-tertiary)'
              : pos ? '#059669' : '#E11D48',
          }}>
            {fmtReturn(val)}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Fund autocomplete search ─────────────────────────────────────────────────

function FundSearch({ value, onChange, allFunds }) {
  const [open, setOpen]   = useState(false);
  const [rect, setRect]   = useState(null);
  const inputRef          = useRef(null);
  const containerRef      = useRef(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.trim().toLowerCase();
    return allFunds
      .filter(f => f.scheme_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, allFunds]);

  const openDropdown = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  };

  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const highlight = (name) => {
    const q = value.trim();
    if (!q) return name;
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <strong style={{ fontWeight: 700 }}>{name.slice(idx, idx + q.length)}</strong>
        {name.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); openDropdown(); }}
        onFocus={openDropdown}
        placeholder="Search funds…"
        className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ paddingLeft: 28, paddingRight: value ? 28 : 10, paddingTop: 7, paddingBottom: 7, width: 240 }}
      />
      {value && (
        <button
          onMouseDown={e => { e.preventDefault(); onChange(''); setOpen(false); }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-tertiary)' }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      )}

      {/* Fixed-position dropdown — escapes any overflow:hidden or stacking context */}
      {open && suggestions.length > 0 && rect && (
        <div style={{
          position:     'fixed',
          top:          rect.bottom + 4,
          left:         rect.left,
          width:        360,
          zIndex:       9999,
          background:   'var(--color-background-primary)',
          border:       '1px solid #e2e8f0',
          borderRadius: 10,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.14)',
          overflow:     'hidden',
          maxHeight:    320,
          overflowY:    'auto',
        }}>
          {suggestions.map((fund, i) => (
            <div
              key={fund.scheme_code}
              onMouseDown={e => { e.preventDefault(); onChange(fund.scheme_name); setOpen(false); }}
              style={{
                padding:    '9px 12px',
                cursor:     'pointer',
                borderTop:  i > 0 ? '1px solid #f1f5f9' : 'none',
              }}
              className="hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <p style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                {highlight(fund.scheme_name)}
              </p>
              <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                {fund.category}
              </p>
            </div>
          ))}
        </div>
      )}
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
  const [direction, setDirection]   = useState('desc');
  const [catFilter, setCatFilter]   = useState('All');
  const [search, setSearch]         = useState('');
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
  useEffect(() => { setPage(0); }, [sortKey, catFilter, direction, search]);

  const handleSort = (col) => {
    if (col === sortKey) {
      setDirection(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(col);
      setDirection('desc');
    }
  };

  const filtered = useMemo(() => {
    if (!data?.funds) return [];
    let list = [...data.funds];
    if (catFilter !== 'All') list = list.filter(f => f.category === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(f => f.scheme_name.toLowerCase().includes(q));
    }
    const isReturn = RETURNS.some(r => r.key === sortKey);
    list.sort((a, b) => {
      const av = isReturn ? (a.returns?.[sortKey] ?? -Infinity) : (a.scores?.[sortKey] ?? -Infinity);
      const bv = isReturn ? (b.returns?.[sortKey] ?? -Infinity) : (b.scores?.[sortKey] ?? -Infinity);
      return direction === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [data, sortKey, direction, catFilter, search]);

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
      <div className="skeleton h-96 rounded-xl" />
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
        {/* Autocomplete search */}
        <FundSearch
          value={search}
          onChange={setSearch}
          allFunds={data?.funds ?? []}
        />

        {/* Category filter */}
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

        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} funds
          {catFilter !== 'All' && ` · ${catFilter}`}
          {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No funds in this category</p>
        </div>
      ) : (
        <>
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="border-r border-slate-200 dark:border-slate-700" style={{ padding: '10px 10px 10px 16px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textAlign: 'left' }}>#</th>
                    <th className="border-r border-slate-200 dark:border-slate-700" style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textAlign: 'left' }}>Fund</th>

                    {SCORES.map((s, i) => (
                      <SortTh
                        key={s.key}
                        score={s}
                        sortKey={sortKey}
                        direction={direction}
                        onSort={handleSort}
                        isLast={i === SCORES.length - 1}
                      />
                    ))}

                    {RETURNS.map(r => {
                      const active = sortKey === r.key;
                      const Icon   = active ? (direction === 'desc' ? ChevronDown : ChevronUp) : ChevronsUpDown;
                      return (
                        <th key={r.key} style={{ padding: '10px 14px 10px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleSort(r.key)}
                            style={{
                              display:    'inline-flex',
                              alignItems: 'center',
                              gap:        3,
                              fontSize:   10,
                              fontWeight: active ? 700 : 600,
                              color:      active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                              background: 'none',
                              border:     'none',
                              cursor:     'pointer',
                              padding:    0,
                              userSelect: 'none',
                            }}
                          >
                            {r.label}
                            <Icon style={{ width: 10, height: 10, flexShrink: 0, opacity: active ? 1 : 0.4 }} />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((fund, i) => (
                    <FundRow
                      key={fund.scheme_code}
                      fund={fund}
                      rank={page * PAGE_SIZE + i + 1}
                      sortKey={sortKey}
                      odd={i % 2 === 1}
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
