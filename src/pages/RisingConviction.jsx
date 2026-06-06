import { useEffect, useState, useMemo } from 'react';
import {
  Flame, TrendingUp, TrendingDown, Layers,
  Filter, LayoutGrid, Table2, ChevronsUpDown, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { getRisingConviction } from '../api/client.js';
import { getIndustryColor, industryBadgeClass } from '../utils/industryColors.js';
import CapBadge from '../components/CapBadge.jsx';

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Inline SVG sparkline ────────────────────────────────────────────────────

function Sparkline({ history, color, width = 96, height = 36 }) {
  if (!history || history.length < 2) return null;
  const vals  = history.map(d => d.pct);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = max - min || 0.0001;
  const pad   = 3;

  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (width - pad * 2);
    const y = (height - pad) - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const polyline      = points.map(([x, y]) => `${x},${y}`).join(' ');
  const [lx, ly]      = points[points.length - 1];
  const [fx, fy]      = points[0];

  return (
    <svg width={width} height={height} className="overflow-visible flex-shrink-0">
      <polyline points={polyline} fill="none" stroke={color}
        strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={lx} cy={ly} r={3} fill={color} />
      <circle cx={fx} cy={fy} r={2} fill={color} opacity={0.4} />
    </svg>
  );
}

// ─── Streak badge ─────────────────────────────────────────────────────────────

function StreakBadge({ streak, maxStreak, direction }) {
  const isRising  = direction === 'rising';
  const intensity = streak / maxStreak;

  const cls = isRising
    ? intensity >= 0.8
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : 'bg-green-50 text-green-700 border-green-200'
    : intensity >= 0.8
      ? 'bg-red-50 text-red-700 border-red-300'
      : 'bg-orange-50 text-orange-700 border-orange-200';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${cls}`}>
      <span className="font-bold">{isRising ? '↑' : '↓'}{streak}</span>
      <span className="opacity-70">straight</span>
    </span>
  );
}

// ─── Fund row inside a stock card ────────────────────────────────────────────

function FundRow({ entry, maxStreak, direction }) {
  const color    = getIndustryColor(entry.industry).hex;
  const gainSign = entry.gain >= 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
      <Sparkline history={entry.pct_history} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={entry.fund_name}>
          {entry.fund_name.split(' ').slice(0, 4).join(' ')}
          {entry.fund_name.split(' ').length > 4 ? '…' : ''}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <StreakBadge streak={entry.streak} maxStreak={maxStreak} direction={direction} />
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {entry.up_count}/{entry.window_count - 1} months {direction === 'rising' ? 'up' : 'down'}
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs tabular-nums text-slate-500 dark:text-slate-400 dark:text-slate-500">
          {fmt(entry.oldest_pct)}%
          <span className="mx-1 text-slate-500 dark:text-slate-400 dark:text-slate-500">→</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(entry.latest_pct)}%</span>
        </div>
        <div className={`text-xs font-bold tabular-nums ${
          direction === 'rising'
            ? entry.gain > 0 ? 'text-emerald-600' : 'text-red-500'
            : entry.gain < 0 ? 'text-red-500' : 'text-emerald-600'
        }`}>
          {gainSign}{fmt(entry.gain)}%
        </div>
      </div>
    </div>
  );
}

// ─── Stock card ───────────────────────────────────────────────────────────────

function StockCard({ stockGroup, maxStreak, isMultiFund, direction }) {
  const { stock_name, isin, industry, entries } = stockGroup;
  const bestStreak = Math.max(...entries.map(e => e.streak));
  const avgGain    = entries.reduce((s, e) => s + e.gain, 0) / entries.length;
  const isRising   = direction === 'rising';

  return (
    <div className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
      isMultiFund
        ? isRising ? 'border-violet-200 ring-1 ring-violet-100' : 'border-red-200 ring-1 ring-red-50'
        : 'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {industry && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(industry)}`}>
                {industry}
              </span>
            )}
            {isMultiFund && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                isRising ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-red-100 text-red-700 border-red-200'
              }`}>
                <Layers className="w-3 h-3" />
                {entries.length} funds
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-snug">{stock_name}</p>
            <CapBadge cap={entries[0]?.market_cap_cat} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{isin}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StreakBadge streak={bestStreak} maxStreak={maxStreak} direction={direction} />
          <div className={`text-xs font-bold tabular-nums ${
            isRising
              ? avgGain >= 0 ? 'text-emerald-600' : 'text-red-500'
              : avgGain < 0  ? 'text-red-500'     : 'text-emerald-600'
          }`}>
            avg {avgGain >= 0 ? '+' : ''}{fmt(avgGain)}%
          </div>
        </div>
      </div>

      {/* Per-fund rows */}
      <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
        {entries.map((entry, i) => (
          <FundRow key={`${entry.fund_id}-${i}`} entry={entry} maxStreak={maxStreak} direction={direction} />
        ))}
      </div>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function SortHeader({ label, col, sortCol, sortDir, onSort, accentColor = 'text-slate-700 dark:text-slate-300' }) {
  const active = sortCol === col;
  return (
    <th
      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:text-slate-300 whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'desc'
            ? <ChevronDown className={`w-3 h-3 ${accentColor}`} />
            : <ChevronUp   className={`w-3 h-3 ${accentColor}`} />
          : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}

function downloadCSV(rows, direction) {
  const headers = ['Stock', 'ISIN', 'Industry', 'Fund', 'Streak', 'Up/Down Months', 'Window Months', 'Oldest %', 'Latest %', 'Change %'];
  const label   = direction === 'rising' ? 'Up' : 'Down';
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.stock_name.replace(/"/g, '""')}"`,
      r.isin,
      `"${(r.industry || '').replace(/"/g, '""')}"`,
      `"${r.fund_name.replace(/"/g, '""')}"`,
      r.streak,
      `${r.up_count}/${r.window_count - 1} ${label}`,
      r.window_count,
      r.oldest_pct,
      r.latest_pct,
      r.gain,
    ].join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${direction}-conviction.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TableView({ flatRows, maxStreak, direction }) {
  // null = no active sort → preserves natural order (same as cards view)
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return flatRows;   // natural order = same as cards
    const mult = sortDir === 'desc' ? -1 : 1;
    return [...flatRows].sort((a, b) => {
      if (sortCol === 'streak')     return mult * (a.streak - b.streak);
      if (sortCol === 'gain')       return mult * (a.gain - b.gain);
      if (sortCol === 'latest_pct') return mult * (a.latest_pct - b.latest_pct);
      if (sortCol === 'stock_name') return mult * a.stock_name.localeCompare(b.stock_name);
      if (sortCol === 'up_count')   return mult * (a.up_count - b.up_count);
      return 0;
    });
  }, [flatRows, sortCol, sortDir]);

  const accentColor = direction === 'rising' ? 'text-emerald-600' : 'text-red-500';
  const hp = { sortCol, sortDir, onSort: handleSort, accentColor };
  const isRising = direction === 'rising';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-400 dark:text-slate-500">{sorted.length} row{sorted.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => downloadCSV(sorted, direction)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <SortHeader label="Stock"       col="stock_name" {...hp} />
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Industry</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Fund</th>
              <SortHeader label="Streak"      col="streak"     {...hp} />
              <SortHeader label={isRising ? 'Up / Window' : 'Down / Window'} col="up_count" {...hp} />
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Trend</th>
              <SortHeader label="Allocation"  col="latest_pct" {...hp} />
              <SortHeader label="Change"      col="gain"       {...hp} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {sorted.map((entry, i) => {
              const color    = getIndustryColor(entry.industry).hex;
              const gainSign = entry.gain >= 0 ? '+' : '';
              const gainColor = isRising
                ? entry.gain > 0 ? 'text-emerald-600' : 'text-red-500'
                : entry.gain < 0 ? 'text-red-500' : 'text-emerald-600';
              return (
                <tr key={`${entry.fund_id}-${entry.isin}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-snug">{entry.stock_name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{entry.isin}</p>
                  </td>
                  <td className="px-4 py-3">
                    {entry.industry
                      ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(entry.industry)}`}>
                          {entry.industry}
                        </span>
                      : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 truncate" title={entry.fund_name}>
                      {entry.fund_name.split(' ').slice(0, 4).join(' ')}
                      {entry.fund_name.split(' ').length > 4 ? '…' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StreakBadge streak={entry.streak} maxStreak={maxStreak} direction={direction} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{entry.up_count}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">/{entry.window_count - 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Sparkline history={entry.pct_history} color={color} width={80} height={28} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmt(entry.oldest_pct)}%</span>
                    <span className="mx-1 text-slate-300 text-xs">→</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(entry.latest_pct)}%</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`text-sm font-bold ${gainColor}`}>
                      {gainSign}{fmt(entry.gain)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared filter + content panel ───────────────────────────────────────────

function ConvictionPanel({ direction }) {
  const isRising = direction === 'rising';

  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lookback, setLookback]   = useState(6);
  const [minStreak, setMinStreak] = useState(2);
  const [multiOnly, setMultiOnly] = useState(false);
  const [viewMode, setViewMode]   = useState('cards');

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRisingConviction(lookback, direction)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lookback, direction]);

  const stockGroups = useMemo(() => {
    const map = new Map();
    for (const entry of data) {
      if (entry.streak < minStreak) continue;
      if (!map.has(entry.isin)) {
        map.set(entry.isin, { stock_name: entry.stock_name, isin: entry.isin, industry: entry.industry, entries: [] });
      }
      map.get(entry.isin).entries.push(entry);
    }
    for (const g of map.values()) g.entries.sort((a, b) => b.streak - a.streak);
    return [...map.values()].sort((a, b) => {
      if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
      return Math.max(...b.entries.map(e => e.streak)) - Math.max(...a.entries.map(e => e.streak));
    });
  }, [data, minStreak]);

  const flatRows     = useMemo(() => stockGroups.flatMap(g => g.entries), [stockGroups]);
  const filtered     = multiOnly ? stockGroups.filter(g => g.entries.length >= 2) : stockGroups;
  const flatFiltered = multiOnly ? flatRows.filter(e => {
    const g = stockGroups.find(sg => sg.isin === e.isin);
    return g && g.entries.length >= 2;
  }) : flatRows;

  const maxStreak  = data.length > 0 ? Math.max(...data.map(d => d.streak), 1) : 1;
  const multiCount = stockGroups.filter(g => g.entries.length >= 2).length;
  const totalShown = viewMode === 'table' ? flatFiltered.length : filtered.length;

  const accentActive  = isRising ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-500 text-white border-red-500';
  const accentHover   = isRising ? 'hover:border-emerald-300 hover:text-emerald-600' : 'hover:border-red-300 hover:text-red-600';
  const streakActive  = isRising ? 'bg-green-700 text-white border-green-700' : 'bg-rose-600 text-white border-rose-600';
  const streakHover   = isRising ? 'hover:border-green-400 hover:text-green-700' : 'hover:border-rose-300 hover:text-rose-600';

  return (
    <>
      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={isRising
              ? <TrendingUp className="w-4 h-4 text-emerald-500" />
              : <TrendingDown className="w-4 h-4 text-red-500" />}
            label={isRising ? 'Rising Stocks' : 'Falling Stocks'}
            value={stockGroups.length}
          />
          <StatCard
            icon={<Layers className={`w-4 h-4 ${isRising ? 'text-violet-500' : 'text-red-400'}`} />}
            label="In 2+ Funds" value={multiCount}
            sub="managers agree"
          />
          <StatCard
            icon={isRising
              ? <Flame className="w-4 h-4 text-emerald-600" />
              : <TrendingDown className="w-4 h-4 text-red-500" />}
            label="Longest Streak"
            value={`${maxStreak} months`}
            sub={data.find(d => d.streak === maxStreak)?.stock_name}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Filter className="w-4 h-4" /> Window:
            </span>
            {[4, 5, 6, 8].map(n => (
              <button key={n} onClick={() => setLookback(n)}
                className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                  lookback === n ? accentActive : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 ${accentHover}`
                }`}>
                {n}mo
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Min streak:</span>
            {[2, 3, 4, 5].filter(n => n < lookback).map(n => (
              <button key={n} onClick={() => setMinStreak(n)}
                className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                  minStreak === n ? streakActive : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 ${streakHover}`
                }`}>
                {n}+
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setMultiOnly(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${multiOnly ? 'bg-violet-600' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white dark:bg-slate-800 rounded-full shadow transition-transform ${multiOnly ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Multi-fund only</span>
          </label>

          <div className="flex items-center gap-3 sm:ml-auto">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {totalShown} {viewMode === 'table' ? 'row' : 'stock'}{totalShown !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button onClick={() => setViewMode('cards')} title="Card view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:text-slate-500'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('table')} title="Table view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:text-slate-500'}`}>
                <Table2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      )}

      {!loading && !error && totalShown === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          {isRising
            ? <Flame className="w-10 h-10 mx-auto mb-3 opacity-30" />
            : <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />}
          <p className="font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">No {isRising ? 'rising' : 'falling'} stocks found</p>
          <p className="text-sm mt-1">Try lowering the min streak or widening the window</p>
        </div>
      )}

      {!loading && !error && totalShown > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(group => (
            <StockCard key={group.isin} stockGroup={group} maxStreak={maxStreak}
              isMultiFund={group.entries.length >= 2} direction={direction} />
          ))}
        </div>
      )}

      {!loading && !error && totalShown > 0 && viewMode === 'table' && (
        <TableView flatRows={flatFiltered} maxStreak={maxStreak} direction={direction} />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RisingConviction() {
  const [tab, setTab] = useState('rising');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {tab === 'rising'
            ? <Flame className="w-5 h-5 text-emerald-600" />
            : <TrendingDown className="w-5 h-5 text-red-500" />}
          Conviction Tracker
        </h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mt-1">
          {tab === 'rising'
            ? 'Stocks being consistently added to — consecutive monthly increases in % NAV allocation.'
            : 'Stocks being consistently trimmed — consecutive monthly decreases in % NAV allocation.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setTab('rising')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            tab === 'rising'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:text-emerald-600'
          }`}
        >
          <Flame className="w-4 h-4" /> Rising Conviction
        </button>
        <button
          onClick={() => setTab('losing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            tab === 'losing'
              ? 'bg-red-500 text-white border-red-500 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-600'
          }`}
        >
          <TrendingDown className="w-4 h-4" /> Losing Conviction
        </button>
      </div>

      {/* Panel — key forces remount on tab change so state/data resets cleanly */}
      <ConvictionPanel key={tab} direction={tab} />
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-1">{icon} {label}</div>
      <div className="font-bold text-slate-800 dark:text-slate-200 text-lg">{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={sub}>{sub}</div>}
    </div>
  );
}
