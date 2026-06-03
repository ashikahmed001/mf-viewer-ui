import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, GitCompare, FileDown, RefreshCw, Printer } from 'lucide-react';
import { getFund, getFundExtractions, getHoldings, getHoldingsSummary, getStockTrend, getFundNav } from '../api/client.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFeatureFlags, canUseFeature } from '../context/FeatureFlagsContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import UpgradePrompt from '../components/UpgradePrompt.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import ExtractionMetaBar from '../components/ExtractionMetaBar.jsx';
import HoldingsTable from '../components/HoldingsTable.jsx';
import IndustryPieChart from '../components/IndustryPieChart.jsx';
import TopHoldingsBarChart from '../components/TopHoldingsBarChart.jsx';
import TrendLineChart from '../components/TrendLineChart.jsx';
import { getIndustryColor } from '../utils/industryColors.js';

export default function FundDetail() {
  const { id } = useParams();
  const [fund, setFund] = useState(null);
  const [extractions, setExtractions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [holdingsData, setHoldingsData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [trendStock, setTrendStock] = useState(null);
  const [trendIndustry, setTrendIndustry] = useState(null);
  const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' | 'charts'
  const [navData, setNavData]     = useState(null);
  const { flags }  = useFeatureFlags();
  const { isPro }  = useSubscription();
  const canNav     = canUseFeature(flags, isPro, 'nav_history');
  const canTrend   = canUseFeature(flags, isPro, 'stock_trend');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Holdings filter state
  const [sort, setSort] = useState('pct_nav');
  const [order, setOrder] = useState('desc');
  const [industry, setIndustry] = useState('');
  const [search, setSearch] = useState('');

  // Detect if pct_nav is stored as a fraction (0.065) vs a percentage (6.5).
  // A real fund's total pct_nav across all holdings should be ~99-100.
  // If total < 2, values are fractions and we multiply by 100 for display.
  const [scale, setScale] = useState(1);

  // Load fund + extractions
  useEffect(() => {
    Promise.all([getFund(id), getFundExtractions(id)])
      .then(([f, exts]) => {
        setFund(f);
        setExtractions(exts);
        if (exts.length) setSelectedId(String(exts[0].id));
      })
      .catch(e => setError(e.message));
  }, [id]);

  // Load holdings when extraction changes
  const loadHoldings = useCallback(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      getHoldings(selectedId, { sort, order, industry: industry || undefined, search: search || undefined }),
      getHoldingsSummary(selectedId),
    ])
      .then(([hData, sData]) => {
        setHoldingsData(hData);
        setSummary(sData);
        // Auto-detect scale: if total pct_nav < 2, values are fractions (0.065 = 6.5%)
        const total = sData?.totals?.total_pct_nav ?? 0;
        setScale(total > 0 && total < 2 ? 100 : 1);
        setTrendData([]);
        setTrendStock(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId, sort, order, industry, search]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // Load NAV immediately when fund page loads (fund-level data, not extraction-specific)
  useEffect(() => {
    if (navData === null && canNav) {
      getFundNav(id).then(setNavData).catch(() => setNavData({ mapped: false }));
    }
  }, [id, navData, canNav]);

  // Trend click
  function handleStockTrend(isin, stockName, industry) {
    getStockTrend(id, isin).then(data => {
      setTrendData(data);
      setTrendStock(stockName);
      setTrendIndustry(industry || null);
      setActiveTab('charts');
    });
  }

  // CSV Export
  function exportCSV() {
    if (!holdingsData?.holdings?.length) return;
    const headers = ['Stock Name', 'ISIN', 'Industry', 'Rating', 'Quantity', 'Market Value', '% NAV'];
    const rows = holdingsData.holdings.map(h =>
      [h.stock_name, h.isin, h.industry || '', h.rating || '', h.quantity ?? '', h.market_value ?? '', h.pct_nav ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fund?.name ?? 'holdings'}_${holdingsData.extraction?.report_month ?? ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
      <p className="font-semibold">Error loading fund</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );

  const extraction = holdingsData?.extraction ?? null;

  return (
    <div>
      {/* Back */}
      <Link to="/funds" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Funds
      </Link>

      {/* Fund Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          {fund ? (
            <>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{fund.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{fund.extraction_count} available month{fund.extraction_count !== 1 ? 's' : ''}</p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="skeleton h-6 w-64" />
              <div className="skeleton h-4 w-32" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/funds/${id}/compare`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600
                       bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <GitCompare className="w-4 h-4" /> Compare Months
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600
                       bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* ── NAV History — fund-level, always shown ───────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">NAV History</h2>
          <span className="h-px flex-1 bg-slate-200" />
          {!canNav && <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">Pro</span>}
        </div>
        {canNav
          ? <NavHistoryPanel navData={navData} />
          : <UpgradePrompt feature="NAV history charts" />
        }
      </div>

      {/* ── Per-extraction data ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monthly Portfolio</h2>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Month Selector */}
      <div className="mb-6 max-w-full sm:max-w-sm">
        <MonthSelector extractions={extractions} value={selectedId} onChange={v => { setSelectedId(v); setIndustry(''); setSearch(''); }} />
      </div>

      {/* No extractions */}
      {!loading && extractions.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500 dark:text-slate-400">No data available</p>
          <p className="text-sm mt-1">No monthly extractions have been processed for this fund</p>
        </div>
      )}

      {selectedId && (
        <>
          {/* Extraction meta */}
          <div className="mb-6">
            {extraction ? (
              <ExtractionMetaBar extraction={extraction} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
              </div>
            )}
          </div>

          {/* Summary cards */}
          {summary?.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <SummaryCard label="Total Holdings" value={summary.totals.holding_count?.toLocaleString()} />
              <SummaryCard label="Total Market Value (L)" value={`₹${Number(summary.totals.total_market_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
              <SummaryCard label="Total % NAV" value={`${(Number(summary.totals.total_pct_nav || 0) * scale).toFixed(2)}%`} />
            </div>
          )}

          {/* Tabs — only extraction-scoped views */}
          <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-700 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
            <TabBtn active={activeTab === 'holdings'} onClick={() => setActiveTab('holdings')}>Holdings Table</TabBtn>
            <TabBtn active={activeTab === 'charts'} onClick={() => setActiveTab('charts')}>Charts & Analytics</TabBtn>
          </div>

          {/* Holdings tab */}
          {activeTab === 'holdings' && (
            <div>
              <div className="flex justify-end mb-3">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600
                             bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <FileDown className="w-4 h-4" /> Export CSV
                </button>
              </div>
              <HoldingsTable
                holdings={holdingsData?.holdings ?? []}
                industries={holdingsData?.industries ?? []}
                sort={sort} order={order} industry={industry} search={search}
                onSort={(s, o) => { setSort(s); setOrder(o); }}
                onIndustry={setIndustry}
                onSearch={setSearch}
                loading={loading}
                scale={scale}
              />
            </div>
          )}

          {/* Charts tab */}
          {activeTab === 'charts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Industry Allocation">
                <IndustryPieChart data={summary?.industryBreakdown ?? []} scale={scale} />
              </ChartCard>
              <ChartCard title="Top 10 Holdings by % NAV">
                <TopHoldingsBarChart data={summary?.top10 ?? []} scale={scale} />
              </ChartCard>
              <ChartCard title="Stock % NAV Trend" className="lg:col-span-2">
                {!canTrend ? (
                  <UpgradePrompt feature="Stock % NAV trend charts" />
                ) : trendData.length > 0 ? (
                  <TrendLineChart data={trendData} stockName={trendStock} industry={trendIndustry} scale={scale} />
                ) : (
                  <div className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                    Click a stock below to see its % NAV trend across months
                  </div>
                )}
              </ChartCard>
              {/* All holdings clickable for trend */}
              {canTrend && (holdingsData?.holdings ?? []).length > 0 && (
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Click to view trend:</p>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{holdingsData.holdings.length} holdings</span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                    {holdingsData.holdings.map(h => (
                      <button
                        key={h.isin}
                        onClick={() => handleStockTrend(h.isin, h.stock_name, h.industry)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium whitespace-nowrap`}
                        style={trendStock === h.stock_name ? {
                          backgroundColor: getIndustryColor(h.industry).hex,
                          borderColor: getIndustryColor(h.industry).hex,
                          color: 'white',
                        } : {}}
                      >
                        {h.stock_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const NAV_RANGES = [
  { key: '1m',  label: '1M',       days: 30 },
  { key: '3m',  label: '3M',       days: 90 },
  { key: '6m',  label: '6M',       days: 180 },
  { key: '1y',  label: '1Y',       days: 365 },
  { key: '3y',  label: '3Y',       days: 365 * 3 },
  { key: '5y',  label: '5Y',       days: 365 * 5 },
  { key: 'all', label: 'All',      days: null },
];

function NavHistoryPanel({ navData }) {
  const [range, setRange] = useState('1y');

  if (!navData) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!navData.mapped || !navData.history?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center text-slate-400 dark:text-slate-500">
        <svg viewBox="0 0 200 140" className="mx-auto mb-4 w-40 h-28 opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Chart frame */}
          <rect x="16" y="16" width="168" height="100" rx="8" className="fill-slate-100 dark:fill-slate-700" />
          {/* Grid lines */}
          <line x1="30" y1="90" x2="170" y2="90" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="30" y1="70" x2="170" y2="70" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="30" y1="50" x2="170" y2="50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="4 3" />
          {/* Wobbly question-mark line instead of a real chart */}
          <path d="M30 80 Q50 40 70 75 Q90 110 110 60 Q130 20 150 55 Q165 75 170 70"
            stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
          {/* Question mark dot */}
          <circle cx="100" cy="108" r="3.5" fill="#a78bfa" opacity="0.7" />
          {/* Question mark arc */}
          <path d="M94 94 Q94 85 100 83 Q108 80 108 88 Q108 95 100 97" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
        <p className="font-medium text-slate-500 dark:text-slate-400 mb-1">No NAV data available</p>
        <p className="text-sm">This fund hasn't been mapped or synced yet. Go to Admin → NAV Mapping to set it up.</p>
      </div>
    );
  }

  const all = navData.history.map(r => {
    const [d, m, y] = r.nav_date.split('-');
    return { date: r.nav_date, nav: r.nav, ts: new Date(`${y}-${m}-${d}`).getTime() };
  }).sort((a, b) => a.ts - b.ts);

  const selectedRange = NAV_RANGES.find(r => r.key === range);
  const cutoff  = selectedRange.days ? Date.now() - selectedRange.days * 86400 * 1000 : 0;
  const filtered = selectedRange.days ? all.filter(p => p.ts >= cutoff) : all;

  const step   = Math.max(1, Math.floor(filtered.length / 300));
  const points = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);

  const latest     = all[all.length - 1];
  const oldest     = all[0];
  const rangeStart = points[0];

  const navValues = points.map(p => p.nav);
  const minNav    = Math.min(...navValues);
  const maxNav    = Math.max(...navValues);

  const rangeReturn = rangeStart ? ((latest.nav - rangeStart.nav) / rangeStart.nav * 100) : 0;
  const isPos       = rangeReturn >= 0;

  const allTimeReturn = ((latest.nav - oldest.nav) / oldest.nav * 100).toFixed(2);
  const allTimePos    = parseFloat(allTimeReturn) >= 0;

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtNav(n) {
    return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtPct(n) {
    return `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
  }
  function xTickFmt(ts) {
    const d = new Date(ts);
    if (selectedRange.days && selectedRange.days <= 90)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 shadow-lg">
        <p className="font-bold text-violet-600">{fmtNav(d.nav)}</p>
        <p className="text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(d.ts)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: scheme + key stats */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">AMFI Scheme</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{navData.scheme_name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{navData.scheme_code}</p>
          </div>
          <div className="flex items-center gap-6 text-center flex-wrap">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Latest NAV</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtNav(latest.nav)}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(latest.ts)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                {selectedRange.key === 'all' ? 'All-time return' : `${selectedRange.label} return`}
              </p>
              <p className={`text-xl font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {fmtPct(rangeReturn)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {rangeStart ? `since ${fmtDate(rangeStart.ts)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">High / Low</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {fmtNav(maxNav)} / {fmtNav(minNav)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">in selected range</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">NAV History</h3>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
            {NAV_RANGES.map(r => {
              const days = r.days;
              const hasData = !days || all.some(p => p.ts >= Date.now() - days * 86400 * 1000);
              return (
                <button
                  key={r.key}
                  onClick={() => hasData && setRange(r.key)}
                  disabled={!hasData}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    range === r.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : hasData
                      ? 'text-slate-400 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-600'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 300}>
          <LineChart data={points} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={xTickFmt}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[minNav * 0.98, maxNav * 1.02]}
              tickFormatter={v => `₹${v.toFixed(0)}`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="nav"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-right mt-2">
          {points.length.toLocaleString()} data points · all-time return{' '}
          <span className={allTimePos ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}>
            {fmtPct(parseFloat(allTimeReturn))}
          </span>
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="font-bold text-slate-800 dark:text-slate-200 text-lg">{value}</div>
    </div>
  );
}
