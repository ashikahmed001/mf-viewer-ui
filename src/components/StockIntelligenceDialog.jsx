/**
 * StockIntelligenceDialog
 * ─────────────────────────────────────────────────────────────
 * A full-screen modal that renders the Stock Intelligence report
 * (conviction score, stat cards, adoption trend, fund breakdown,
 * sector peers) for any stock. Open it by calling openStockDialog()
 * from useStockDialog().
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ArrowUp, ArrowDown, Minus, X } from 'lucide-react';
import { useStockDialog } from '../context/StockDialogContext.jsx';
import { getStockTracker, getStockPeers, getStockPriceByIsin } from '../api/client.js';
import CapBadge from './CapBadge.jsx';
import { industryBadgeClass } from '../utils/industryColors.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  const [year, month] = String(dateStr).split('-');
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

const ALWAYS_STRIP = new Set([
  'fund', 'direct', 'plan', 'option', 'idcw', 'regular', 'scheme',
  'the', 'of', 'and', '-',
]);
function buildShortNames(names) {
  const freq = new Map();
  for (const name of names) {
    const words = name.replace(/\([^)]*\)/g, '')
      .split(/[\s\-\/]+/)
      .map(w => w.replace(/[^a-zA-Z0-9&]/g, '').toLowerCase())
      .filter(w => w.length > 1);
    for (const w of new Set(words)) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const threshold = Math.max(2, names.length * 0.6);
  const common = new Set([...freq.entries()].filter(([, c]) => c >= threshold).map(([w]) => w));
  const result = new Map();
  for (const name of names) {
    const words = name.replace(/\([^)]*\)/g, '')
      .split(/[\s\-\/]+/)
      .map(w => w.replace(/[^a-zA-Z0-9&]/g, ''))
      .filter(w => w.length > 1);
    const kept = words.filter(w => !common.has(w.toLowerCase()) && !ALWAYS_STRIP.has(w.toLowerCase()));
    const short = (kept.length ? kept : words.slice(-2))
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    result.set(name, short || name.split(' ')[0]);
  }
  return result;
}

const COLORS = [
  '#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#ef4444','#22c55e','#eab308',
];

// ── Main component ───────────────────────────────────────────────────────────

export default function StockIntelligenceDialog() {
  const { stock, closeStockDialog, openStockDialog } = useStockDialog();

  const [tracker,    setTracker]    = useState(null);
  const [peers,      setPeers]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [showExited, setShowExited] = useState(false);
  const [priceData,    setPriceData]    = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError,   setPriceError]   = useState(false);

  // Fetch tracker + peers when stock changes
  useEffect(() => {
    if (!stock) return;
    setLoading(true); setError(null); setTracker(null); setPeers(null);
    setShowExited(false); setPriceData(null); setPriceLoading(false); setPriceError(false);
    Promise.all([
      getStockTracker(stock.isin),
      getStockPeers(stock.isin),
    ])
      .then(([t, p]) => { setTracker(t); setPeers(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [stock?.isin]);

  // Fetch Yahoo Finance price as soon as we have an ISIN
  useEffect(() => {
    if (!stock?.isin) return;
    setPriceLoading(true);
    getStockPriceByIsin(stock.isin)
      .then(raw => {
        const result = raw?.chart?.result?.[0];
        if (!result) return;
        const closes     = result.indicators.quote[0].close;
        const timestamps = result.timestamp;
        // Build {date, close} pairs — filter nulls
        const candles = timestamps
          .map((ts, i) => ({ date: new Date(ts * 1000), close: closes[i] }))
          .filter(c => c.close != null);
        if (!candles.length) return;
        const current = candles[candles.length - 1].close;
        const priceAt = (daysAgo) => {
          const target = Date.now() - daysAgo * 86_400_000;
          // nearest candle at or before target
          const idx = candles.findLastIndex(c => c.date.getTime() <= target);
          return idx >= 0 ? candles[idx].close : null;
        };
        const pct = (past) => past != null ? ((current - past) / past) * 100 : null;
        const w52High = result.meta.fiftyTwoWeekHigh ?? Math.max(...candles.map(c => c.close));
        const w52Low  = result.meta.fiftyTwoWeekLow  ?? Math.min(...candles.map(c => c.close));
        const rangePos = w52High > w52Low
          ? Math.round(((current - w52Low) / (w52High - w52Low)) * 100)
          : 50;
        setPriceData({
          symbol: raw.resolvedSymbol ?? result.meta.symbol ?? stock.isin,
          currency: result.meta.currency,
          current,
          w52High, w52Low, rangePos,
          dayHigh: result.meta.regularMarketDayHigh,
          dayLow:  result.meta.regularMarketDayLow,
          returns: [
            { label: '1W', pct: pct(priceAt(7)),   price: priceAt(7)   },
            { label: '1M', pct: pct(priceAt(30)),  price: priceAt(30)  },
            { label: '3M', pct: pct(priceAt(91)),  price: priceAt(91)  },
            { label: '6M', pct: pct(priceAt(182)), price: priceAt(182) },
            { label: '1Y', pct: pct(priceAt(365)), price: priceAt(365) },
          ],
        });
      })
      .catch(e => { console.error('[price]', e?.response?.data ?? e?.message); setPriceError(true); })
      .finally(() => setPriceLoading(false));
  }, [stock?.isin]);

  // Close on Escape
  useEffect(() => {
    if (!stock) return;
    const handler = (e) => { if (e.key === 'Escape') closeStockDialog(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [stock, closeStockDialog]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = stock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [stock]);

  // Process tracker → analytics
  const processed = useMemo(() => {
    if (!tracker?.length) return null;
    const months     = [...new Set(tracker.map(r => r.report_month))].sort();
    const latest     = months[months.length - 1];
    const sixAgo     = months[Math.max(0, months.length - 7)];
    const totalFunds = 57; // reasonable estimate; exact count not needed for display

    const monthStats = months.map(m => {
      const holders = tracker.filter(r => r.report_month === m);
      const avg     = holders.reduce((s, r) => s + r.pct_nav, 0) / holders.length;
      return { month: m, fund_count: holders.length, avg_pct: +avg.toFixed(2) };
    });

    const latestHolders = tracker.filter(r => r.report_month === latest);
    const pastHolders   = tracker.filter(r => r.report_month === sixAgo);
    const currentAvg    = latestHolders.length ? latestHolders.reduce((s,r)=>s+r.pct_nav,0)/latestHolders.length : 0;
    const pastAvg       = pastHolders.length   ? pastHolders.reduce((s,r)=>s+r.pct_nav,0)/pastHolders.length   : 0;
    const delta6m       = +(currentAvg - pastAvg).toFixed(4);
    const peakCount     = Math.max(...monthStats.map(s => s.fund_count));

    // Conviction score (0–100)
    const adoptionPts = Math.min(35, (latestHolders.length / Math.max(totalFunds, 1)) * 100 * 0.35);
    const trendPts    = pastHolders.length === 0 && latestHolders.length > 0 ? 20
      : delta6m > 0.5 ? 30 : delta6m > 0.1 ? 22 : delta6m >= -0.1 ? 15
      : delta6m >= -0.5 ? 8 : 2;
    const sustainMonths = monthStats.filter(s => s.fund_count >= 2).length;
    const sustainPts    = (sustainMonths / months.length) * 20;
    const peakPts       = peakCount > 0 ? (latestHolders.length / peakCount) * 15 : 0;
    const score         = Math.round(adoptionPts + trendPts + sustainPts + peakPts);

    const fundIds = [...new Map(tracker.map(r => [r.fund_id, r.fund_name])).keys()];
    const fundBreakdown = fundIds.map(fid => {
      const rows            = tracker.filter(r => r.fund_id === fid).sort((a,b) => a.report_month.localeCompare(b.report_month));
      const fundLatestMonth = rows[0]?.fund_latest_month ?? latest;
      const lastHeldMonth   = rows[rows.length - 1].report_month;
      const is_current      = lastHeldMonth === fundLatestMonth;
      const latRow          = is_current ? rows[rows.length - 1] : null;
      const pstRow          = rows.find(r => r.report_month === sixAgo);
      return {
        fund_id:           fid,
        fund_name:         rows[0].fund_name,
        current_pct:       latRow?.pct_nav ?? null,
        delta:             (latRow && pstRow) ? +(latRow.pct_nav - pstRow.pct_nav).toFixed(4) : null,
        first_month:       rows[0].report_month,
        last_month:        lastHeldMonth,
        fund_latest_month: fundLatestMonth,
        is_current,
      };
    }).sort((a, b) => (b.current_pct ?? -1) - (a.current_pct ?? -1));

    return { months, monthStats, latest, currentCount: latestHolders.length,
      peakCount, currentAvg, delta6m, score, fundBreakdown };
  }, [tracker]);

  const colors = useMemo(() =>
    processed ? new Map(processed.fundBreakdown.map((f,i) => [f.fund_id, COLORS[i % COLORS.length]])) : new Map()
  , [processed]);

  const shortNames = useMemo(() =>
    processed ? buildShortNames(processed.fundBreakdown.map(f => f.fund_name)) : new Map()
  , [processed]);

  const scoreMeta = !processed ? null
    : processed.score >= 70 ? { label: 'Strong',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' }
    : processed.score >= 40 ? { label: 'Building', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     bar: 'bg-amber-400'   }
    :                          { label: 'Fading',   color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         bar: 'bg-red-400'     };

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[160px]">
        <p className="font-semibold mb-1.5 text-slate-300">{fmtMonth(label)}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-300">{p.name}</span>
            </div>
            <span className="font-bold tabular-nums">
              {p.dataKey === 'fund_count' ? p.value : `${fmt(p.value, 2)}%`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!stock) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeStockDialog}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-8 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={closeStockDialog}
            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 space-y-5">
            {/* Loading */}
            {loading && (
              <div className="space-y-4 pt-4">
                {[...Array(4)].map((_,i) => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
            )}

            {/* Content */}
            {processed && !loading && (
              <>
                {/* Header card */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{stock.stock_name}</h2>
                        <CapBadge cap={stock.market_cap_cat} />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {stock.isin}
                        </span>
                        {stock.industry && (
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${industryBadgeClass(stock.industry)}`}>
                            {stock.industry}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Conviction score */}
                    <div className="flex-shrink-0 text-center">
                      <div className={`inline-flex flex-col items-center px-5 py-3 rounded-2xl border-2 ${scoreMeta.bg}`}>
                        <span className={`text-3xl font-black tabular-nums ${scoreMeta.color}`}>{processed.score}</span>
                        <span className={`text-xs font-bold uppercase tracking-wide ${scoreMeta.color}`}>{scoreMeta.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Conviction Score</p>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1">
                      <span>Fading</span><span>Building</span><span>Strong</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full transition-all ${scoreMeta.bar}`} style={{ width: `${processed.score}%` }} />
                    </div>
                  </div>
                </div>

                {/* 4 stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Funds Holding"
                    value={processed.currentCount}
                    sub={`peak ${processed.peakCount}`}
                  />
                  <StatCard
                    label="Avg Allocation"
                    value={`${fmt(processed.currentAvg, 2)}%`}
                    sub="across current holders"
                  />
                  <StatCard
                    label="6M Allocation Δ"
                    value={
                      <span className={`flex items-center gap-1 ${processed.delta6m > 0.05 ? 'text-emerald-600' : processed.delta6m < -0.05 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {processed.delta6m > 0.05 ? <ArrowUp className="w-4 h-4" />
                          : processed.delta6m < -0.05 ? <ArrowDown className="w-4 h-4" />
                          : <Minus className="w-4 h-4 text-slate-400" />}
                        {processed.delta6m > 0 ? '+' : ''}{fmt(processed.delta6m, 2)}%
                      </span>
                    }
                    sub="avg allocation change"
                  />
                  <StatCard
                    label="Months Tracked"
                    value={processed.months.length}
                    sub={`since ${fmtMonth(processed.months[0])}`}
                  />
                </div>

                {/* Price section — ticker style */}
                {(priceData || priceLoading || priceError) && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                    {priceLoading && !priceData && (
                      <div className="flex items-center gap-4 p-4">
                        <div className="h-9 w-28 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
                        <div className="h-6 flex-1 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                      </div>
                    )}
                    {priceError && !priceData && (
                      <div className="flex items-center gap-2 px-5 py-3 text-xs text-slate-400 dark:text-slate-500">
                        <span>Market price unavailable</span>
                      </div>
                    )}
                    {priceData && (
                      <div className="flex items-stretch divide-x divide-slate-100 dark:divide-slate-700">
                        {/* Price block */}
                        <div className="px-5 py-4 flex-shrink-0">
                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{priceData.symbol}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">₹{fmt(priceData.current, 2)}</p>
                        </div>

                        {/* Period returns */}
                        {priceData.returns.map(({ label, pct }) => (
                          <div key={label} className="flex-1 px-4 py-4 text-center">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                            <p className={`text-sm font-bold tabular-nums ${
                              pct == null ? 'text-slate-300 dark:text-slate-600'
                              : pct > 0   ? 'text-emerald-600 dark:text-emerald-400'
                              :             'text-red-500 dark:text-red-400'
                            }`}>
                              {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                            </p>
                          </div>
                        ))}

                        {/* 52W low / high */}
                        <div className="flex-shrink-0 flex items-center divide-x divide-slate-100 dark:divide-slate-700">
                          <div className="px-4 py-4 text-center">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">52W Low</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">₹{fmt(priceData.w52Low, 0)}</p>
                          </div>
                          <div className="px-4 py-4 text-center">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">52W High</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">₹{fmt(priceData.w52High, 0)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chart + Fund breakdown */}
                <div className="grid grid-cols-5 gap-4">
                  {/* Adoption trend chart */}
                  <div className="col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Adoption Trend</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">
                      Fund count (purple) and avg allocation % (amber) over time
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={processed.monthStats} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tickFormatter={fmtMonth}
                          tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                          interval={Math.max(0, Math.floor(processed.months.length / 7))} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false} tickLine={false} width={28}
                          domain={[0, Math.max(processed.peakCount + 1, 4)]} allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line yAxisId="left" dataKey="fund_count" name="Funds Holding"
                          stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line yAxisId="right" dataKey="avg_pct" name="Avg Alloc %"
                          stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 3"
                          activeDot={{ r: 4, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex items-center gap-5 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 inline-block rounded-full" style={{ height: 3, backgroundColor: '#8b5cf6' }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Funds Holding</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 inline-block rounded-full" style={{ height: 2, backgroundColor: '#f59e0b' }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Avg Allocation %</span>
                      </div>
                    </div>
                  </div>

                  {/* Fund breakdown */}
                  <FundBreakdown
                    fundBreakdown={processed.fundBreakdown}
                    colors={colors}
                    shortNames={shortNames}
                    showExited={showExited}
                    setShowExited={setShowExited}
                  />
                </div>

                {/* Sector peers */}
                {peers?.length > 0 && stock.industry && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Sector Peers — {stock.industry}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">
                      Other stocks in the same sector · click to analyse
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {peers.map((p, i) => (
                        <button
                          key={p.isin}
                          onClick={() => openStockDialog({ isin: p.isin, stock_name: p.stock_name, market_cap_cat: p.market_cap_cat, industry: stock.industry })}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-left transition-colors group"
                        >
                          <span className="text-xs font-bold text-slate-300 group-hover:text-violet-400 w-5 flex-shrink-0">#{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{p.stock_name}</p>
                              <CapBadge cap={p.market_cap_cat} />
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{p.isin.slice(0,12)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-violet-700">{p.fund_count} fund{p.fund_count!==1?'s':''}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{fmt(p.avg_pct,2)}% avg</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function FundBreakdown({ fundBreakdown, colors, showExited, setShowExited }) {
  const activeFunds = fundBreakdown.filter(f => f.is_current);
  const exitedFunds = fundBreakdown.filter(f => !f.is_current);

  const renderRow = (f) => {
    const latestDate = new Date(f.fund_latest_month);
    const weeksDiff  = (new Date() - latestDate) / (1000 * 60 * 60 * 24 * 7);
    const isStale    = weeksDiff > 8;
    return (
      <div key={f.fund_id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.get(f.fund_id) }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={f.fund_name}>{f.fund_name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">since {fmtMonth(f.first_month)}</p>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(f.current_pct, 2)}%</p>
          {f.delta != null && (
            <p className={`text-xs font-semibold tabular-nums ${f.delta > 0.01 ? 'text-emerald-600' : f.delta < -0.01 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {f.delta > 0 ? '+' : ''}{fmt(f.delta, 2)}%
            </p>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isStale ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
            {isStale ? '⚠ ' : ''}{fmtMonth(f.fund_latest_month)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fund Breakdown</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {activeFunds.length} active · {exitedFunds.length} exited
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ maxHeight: 260 }}>
        {activeFunds.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No funds currently hold this stock</p>
        )}
        {activeFunds.map(renderRow)}
        {exitedFunds.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowExited(v => !v)}
              className="w-full text-left text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1.5 px-2 flex items-center gap-1.5 transition-colors"
            >
              <span className={`transition-transform ${showExited ? 'rotate-90' : ''}`}>▶</span>
              {showExited ? 'Hide' : 'Show'} {exitedFunds.length} exited fund{exitedFunds.length !== 1 ? 's' : ''}
            </button>
            {showExited && (
              <div className="space-y-1.5 mt-1">
                {exitedFunds.map(f => (
                  <div key={f.fund_id} className="flex items-center gap-2.5 p-2.5 rounded-xl opacity-45">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.get(f.fund_id) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={f.fund_name}>{f.fund_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">exited after {fmtMonth(f.last_month)}</p>
                    </div>
                    <span className="text-xs text-red-400 font-medium flex-shrink-0">Exited</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
