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

// ─── Leaderboard view ─────────────────────────────────────────────────────────

function SortHeader({ label, col, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th
      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp   className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}

function downloadCSV(stockGroups, direction) {
  const headers = ['#', 'Stock', 'ISIN', 'Industry', 'Market Cap', 'Funds', 'Best Streak', 'Avg Change %'];
  const label   = direction === 'rising' ? 'Up' : 'Down';
  const csvRows = [
    headers.join(','),
    ...stockGroups.map((g, i) => {
      const bestStreak = Math.max(...g.entries.map(e => e.streak));
      const avgGain    = g.entries.reduce((s, e) => s + e.gain, 0) / g.entries.length;
      return [
        i + 1,
        `"${g.stock_name.replace(/"/g, '""')}"`,
        g.isin,
        `"${(g.industry || '').replace(/"/g, '""')}"`,
        g.entries[0]?.market_cap_cat || '',
        g.entries.length,
        `${bestStreak} straight`,
        avgGain.toFixed(2),
      ].join(',');
    }),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${direction}-conviction.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function LeaderboardView({ stockGroups, maxStreak, direction }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const isRising = direction === 'rising';

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return stockGroups;
    const mult = sortDir === 'desc' ? -1 : 1;
    return [...stockGroups].sort((a, b) => {
      const aStreak = Math.max(...a.entries.map(e => e.streak));
      const bStreak = Math.max(...b.entries.map(e => e.streak));
      const aGain   = a.entries.reduce((s, e) => s + e.gain, 0) / a.entries.length;
      const bGain   = b.entries.reduce((s, e) => s + e.gain, 0) / b.entries.length;
      if (sortCol === 'streak')     return mult * (aStreak - bStreak);
      if (sortCol === 'gain')       return mult * (aGain - bGain);
      if (sortCol === 'funds')      return mult * (a.entries.length - b.entries.length);
      if (sortCol === 'stock_name') return mult * a.stock_name.localeCompare(b.stock_name);
      return 0;
    });
  }, [stockGroups, sortCol, sortDir]);

  const hp = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {sorted.length} stock{sorted.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => downloadCSV(sorted, direction)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download CSV
        </button>
      </div>

      {/* column headers */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide w-8">#</th>
              <SortHeader label="Stock"  col="stock_name" {...hp} />
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Industry</th>
              <SortHeader label="Funds"  col="funds"      {...hp} />
              <SortHeader label="Streak" col="streak"     {...hp} />
              <SortHeader label="Avg Δ"  col="gain"       {...hp} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {sorted.map((group, idx) => {
              const bestStreak = Math.max(...group.entries.map(e => e.streak));
              const avgGain    = group.entries.reduce((s, e) => s + e.gain, 0) / group.entries.length;
              const gainSign   = avgGain >= 0 ? '+' : '';
              const gainColor  = isRising
                ? avgGain >= 0 ? 'text-emerald-600' : 'text-red-500'
                : avgGain < 0  ? 'text-red-500'     : 'text-emerald-600';

              return (
                <tr key={group.isin} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  {/* rank */}
                  <td className="px-4 py-3 text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                    {idx + 1}
                  </td>

                  {/* stock + fund pills */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{group.stock_name}</span>
                      <CapBadge cap={group.entries[0]?.market_cap_cat} />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {group.entries.slice(0, 4).map((e, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-px rounded"
                          title={e.fund_name}
                        >
                          {e.fund_name.split(' ').slice(0, 3).join(' ')}
                          {e.fund_name.split(' ').length > 3 ? '…' : ''}
                        </span>
                      ))}
                      {group.entries.length > 4 && (
                        <span className="inline-flex items-center text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-px rounded">
                          +{group.entries.length - 4} more
                        </span>
                      )}
                    </div>
                  </td>

                  {/* industry */}
                  <td className="px-4 py-3">
                    {group.industry
                      ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(group.industry)}`}>
                          {group.industry}
                        </span>
                      : <span className="text-slate-400 text-xs">—</span>}
                  </td>

                  {/* fund count */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      isRising
                        ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                    }`}>
                      <Layers className="w-3 h-3" />
                      {group.entries.length}
                    </span>
                  </td>

                  {/* streak */}
                  <td className="px-4 py-3">
                    <StreakBadge streak={bestStreak} maxStreak={maxStreak} direction={direction} />
                  </td>

                  {/* avg gain */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`text-sm font-bold ${gainColor}`}>
                      {gainSign}{fmt(avgGain)}%
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
  const [viewMode, setViewMode]           = useState('cards');
  const [selectedIndustries, setSelectedIndustries] = useState(new Set());
  const [minGain, setMinGain]             = useState(null);

  function toggleIndustry(ind) {
    setSelectedIndustries(prev => {
      const next = new Set(prev);
      next.has(ind) ? next.delete(ind) : next.add(ind);
      return next;
    });
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRisingConviction(lookback, direction)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lookback, direction]);

  const industries = useMemo(() => {
    const set = new Set(data.map(d => d.industry).filter(Boolean));
    return [...set].sort();
  }, [data]);

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

  const filtered = useMemo(() => stockGroups
    .filter(g => !multiOnly || g.entries.length >= 2)
    .filter(g => selectedIndustries.size === 0 || selectedIndustries.has(g.industry))
    .filter(g => {
      if (minGain === null) return true;
      const avg = g.entries.reduce((s, e) => s + e.gain, 0) / g.entries.length;
      return Math.abs(avg) >= minGain;
    }),
  [stockGroups, multiOnly, selectedIndustries, minGain]);

  const maxStreak  = data.length > 0 ? Math.max(...data.map(d => d.streak), 1) : 1;
  const multiCount = stockGroups.filter(g => g.entries.length >= 2).length;
  const totalShown = filtered.length;

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
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6 flex flex-col gap-3">

        {/* Row 1: window · streak · multi-fund · view toggle */}
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
              className={`w-9 h-5 rounded-full transition-colors relative ${multiOnly ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${multiOnly ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Multi-fund only</span>
          </label>

          <div className="flex items-center gap-3 sm:ml-auto">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {totalShown} stock{totalShown !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button onClick={() => setViewMode('cards')} title="Card view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('table')} title="Leaderboard view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
                <Table2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: industry pills */}
        {!loading && industries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Industry:</span>
            {industries.map(ind => (
              <button key={ind} onClick={() => toggleIndustry(ind)}
                className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  selectedIndustries.has(ind)
                    ? isRising
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-red-500 text-white border-red-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'
                }`}>
                {ind}
              </button>
            ))}
            {selectedIndustries.size > 0 && (
              <button
                onClick={() => setSelectedIndustries(new Set())}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Row 3: min gain/drop */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">
            Min {isRising ? 'gain' : 'drop'}:
          </span>
          {[null, 0.25, 0.5, 1, 2].map(val => (
            <button key={val ?? 'any'} onClick={() => setMinGain(val)}
              className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                minGain === val ? accentActive : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 ${accentHover}`
              }`}>
              {val === null ? 'Any' : `≥${val}%`}
            </button>
          ))}
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
        <LeaderboardView stockGroups={filtered} maxStreak={maxStreak} direction={direction} />
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
