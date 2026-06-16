import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, GitCompare, FileDown, RefreshCw, Printer } from 'lucide-react';
import { getFund, getFundExtractions, getHoldings, getHoldingsSummary, getStockTrend, getFundNav } from '../api/client.js';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useFeatureFlags, canUseFeature, isFeatureEnabled } from '../context/FeatureFlagsContext.jsx';
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
  const { flags, overrides } = useFeatureFlags();
  const { isPro }            = useSubscription();
  const canNav          = canUseFeature(flags, overrides, isPro, 'nav_history');
  const canTrend        = canUseFeature(flags, overrides, isPro, 'stock_trend');
  const canRolling      = canUseFeature(flags, overrides, isPro, 'rolling_returns');
  const rollingEnabled  = isFeatureEnabled(flags, overrides, 'rolling_returns');
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
          ? <NavHistoryPanel navData={navData} canRolling={canRolling} rollingEnabled={rollingEnabled} />
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
  { key: '1m',  label: '1M',  days: 30 },
  { key: '3m',  label: '3M',  days: 90 },
  { key: '6m',  label: '6M',  days: 180 },
  { key: '1y',  label: '1Y',  days: 365 },
  { key: '3y',  label: '3Y',  days: 365 * 3 },
  { key: '5y',  label: '5Y',  days: 365 * 5 },
  { key: 'all', label: 'All', days: null },
];

const RETURN_PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 91 },
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
  { label: '3Y', days: 1095 },
  { label: '5Y', days: 1825 },
];

function NavHistoryPanel({ navData, canRolling, rollingEnabled }) {
  const [range,         setRange]         = useState('1y');
  const [rollingWindow, setRollingWindow] = useState('1y');

  // ── ALL: full sorted NAV history — must be a hook so it sits above early returns
  const all = useMemo(() => {
    if (!navData?.history?.length) return [];
    return navData.history.map(r => {
      const [d, m, y] = r.nav_date.split('-');
      return { date: r.nav_date, nav: r.nav, ts: new Date(`${y}-${m}-${d}`).getTime() };
    }).sort((a, b) => a.ts - b.ts);
  }, [navData]);

  // ── Rolling returns: point-in-time for each standard period ────────────────
  // Use Date.now() as the look-back anchor so these match the header's "1Y return"
  // (which also uses Date.now()). The latest available NAV is still used as the
  // price endpoint — the difference is only in where we look for the start NAV.
  const rollingReturns = useMemo(() => {
    if (!all.length) return [];
    const latest   = all[all.length - 1];
    const nowTs    = Date.now();
    return RETURN_PERIODS.map(({ label, days }) => {
      const targetTs = nowTs - days * 86400 * 1000;
      // Search forward: first NAV on or after targetTs — same logic as the header's
      // rangeStart so both 1Y figures use identical start prices.
      let past = null;
      for (let i = 0; i < all.length - 1; i++) {
        if (all[i].ts >= targetTs) { past = all[i]; break; }
      }
      if (!past) return { label, days, ret: null, cagr: null, sinceTs: null };
      const ret  = (latest.nav / past.nav - 1) * 100;
      const yrs  = days / 365;
      const cagr = yrs >= 1 ? (Math.pow(latest.nav / past.nav, 1 / yrs) - 1) * 100 : null;
      return { label, days, ret, cagr, sinceTs: past.ts };
    });
  }, [all]);

  // ── Rolling return time-series (O(n) two-pointer) ─────────────────────────
  const rollingSeries = useMemo(() => {
    if (all.length < 60) return [];
    const MS_1Y = 365 * 86400 * 1000;
    const MS_3Y = 1095 * 86400 * 1000;
    const result = [];
    let p1 = 0, p3 = 0;
    for (let i = 1; i < all.length; i++) {
      const cur = all[i];
      while (p1 + 1 < i && all[p1 + 1].ts <= cur.ts - MS_1Y) p1++;
      while (p3 + 1 < i && all[p3 + 1].ts <= cur.ts - MS_3Y) p3++;
      const ret1y = all[p1].ts <= cur.ts - MS_1Y
        ? parseFloat(((cur.nav / all[p1].nav - 1) * 100).toFixed(2)) : null;
      const ret3y = all[p3].ts <= cur.ts - MS_3Y
        ? parseFloat(((cur.nav / all[p3].nav - 1) * 100).toFixed(2)) : null;
      if (ret1y !== null || ret3y !== null) result.push({ ts: cur.ts, ret1y, ret3y });
    }
    const step = Math.max(1, Math.floor(result.length / 300));
    return result.filter((_, i) => i % step === 0 || i === result.length - 1);
  }, [all]);

  // Early returns AFTER all hooks ───────────────────────────────────────────
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
        <svg viewBox="0 0 680 220" className="mx-auto mb-5 w-full max-w-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="140" y="20" width="400" height="160" rx="16" fill="#EEEDFE" className="dark:fill-slate-700" />
          <line x1="170" y1="150" x2="510" y2="150" stroke="#AFA9EC" strokeWidth="1" strokeDasharray="5 4"/>
          <line x1="170" y1="110" x2="510" y2="110" stroke="#AFA9EC" strokeWidth="1" strokeDasharray="5 4"/>
          <line x1="170" y1="70" x2="510" y2="70" stroke="#AFA9EC" strokeWidth="1" strokeDasharray="5 4"/>
          <circle cx="195" cy="155" r="4" fill="#534AB7"/>
          <circle cx="250" cy="120" r="4" fill="#534AB7"/>
          <circle cx="300" cy="138" r="3" fill="#534AB7"/>
          <circle cx="355" cy="95" r="5" fill="#534AB7"/>
          <circle cx="405" cy="115" r="3.5" fill="#534AB7"/>
          <circle cx="460" cy="72" r="4.5" fill="#534AB7"/>
          <circle cx="505" cy="95" r="3" fill="#534AB7"/>
          <line x1="195" y1="155" x2="250" y2="120" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <line x1="250" y1="120" x2="300" y2="138" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <line x1="300" y1="138" x2="355" y2="95" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <line x1="355" y1="95" x2="405" y2="115" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <line x1="405" y1="115" x2="460" y2="72" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <line x1="460" y1="72" x2="505" y2="95" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
          <circle cx="165" cy="65" r="2" fill="#AFA9EC" opacity="0.5"/>
          <circle cx="220" cy="45" r="1.5" fill="#AFA9EC" opacity="0.4"/>
          <circle cx="430" cy="50" r="2" fill="#AFA9EC" opacity="0.5"/>
          <circle cx="530" cy="140" r="1.5" fill="#AFA9EC" opacity="0.4"/>
          <circle cx="175" cy="105" r="1.5" fill="#AFA9EC" opacity="0.35"/>
          <path d="M355 95 Q355 70 355 58" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.4" strokeLinecap="round"/>
          <path d="M348 62 L355 58 L362 62" stroke="#7F77DD" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <p className="font-medium text-slate-500 dark:text-slate-400 mb-1">No NAV data available</p>
        <p className="text-sm">This fund hasn't been mapped or synced yet. Go to Admin → NAV Mapping to set it up.</p>
      </div>
    );
  }

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

  function xTickRolling(ts) {
    const d = new Date(ts);
    const mon = d.toLocaleDateString('en-IN', { month: 'short' });
    const yr  = String(d.getFullYear()).slice(-2);
    return `${mon} '${yr}`;
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

  function RollingTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value;
    const ts  = payload[0]?.payload?.ts;
    if (val == null) return null;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3 py-2 shadow-lg">
        <p className={`font-bold ${val >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}%
        </p>
        <p className="text-slate-400 dark:text-slate-500 mt-0.5">{ts ? fmtDate(ts) : ''}</p>
      </div>
    );
  }

  const rollingKey    = rollingWindow === '1y' ? 'ret1y' : 'ret3y';
  const rollingValues = rollingSeries.map(p => p[rollingKey]).filter(v => v != null);
  const rollingMin    = rollingValues.length ? Math.min(...rollingValues) : -20;
  const rollingMax    = rollingValues.length ? Math.max(...rollingValues) : 60;

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

      {/* ── Rolling returns — hidden when disabled, pro-gated when enabled ──── */}
      {rollingEnabled && canRolling ? (
        <>
          {/* Returns card — HM-2A violet spectrum */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Point-in-time returns</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {rollingReturns.map(({ label, ret, cagr, sinceTs }) => {
                const isNull = ret === null;
                const isNeg  = !isNull && ret < 0;

                // Violet spectrum: lighter for short periods, darker for long.
                // Negative returns always get the rose treatment.
                const PALETTE = {
                  '1M': { bg: '#ede9fe', bgDark: '#2e1065', text: '#5b21b6', textDark: '#c4b5fd', sub: '#7c3aed',  subDark: '#a78bfa' },
                  '3M': { bg: '#ddd6fe', bgDark: '#3b0764', text: '#4c1d95', textDark: '#ddd6fe', sub: '#5b21b6',  subDark: '#c4b5fd' },
                  '6M': { bg: '#c4b5fd', bgDark: '#4c1d95', text: '#3b0764', textDark: '#ede9fe', sub: '#4c1d95',  subDark: '#ddd6fe' },
                  '1Y': { bg: '#c4b5fd', bgDark: '#4c1d95', text: '#3b0764', textDark: '#ede9fe', sub: '#4c1d95',  subDark: '#ddd6fe' },
                  '3Y': { bg: '#8b5cf6', bgDark: '#6d28d9', text: '#ffffff', textDark: '#ffffff', sub: '#ffffff',  subDark: '#e9d5ff', dark: true },
                  '5Y': { bg: '#6d28d9', bgDark: '#5b21b6', text: '#ffffff', textDark: '#ffffff', sub: '#ffffff',  subDark: '#e9d5ff', dark: true },
                };
                const c = isNeg ? null : (PALETTE[label] ?? PALETTE['1M']);

                const sinceStr = sinceTs
                  ? (() => {
                      const d = new Date(sinceTs);
                      const mon = d.toLocaleDateString('en-IN', { month: 'short' });
                      const yr  = String(d.getFullYear()).slice(-2);
                      return `${mon} '${yr}`;
                    })()
                  : null;

                return (
                  <div
                    key={label}
                    className="rounded-xl py-4 px-2 text-center flex flex-col gap-1.5"
                    style={isNull
                      ? { background: 'var(--color-bg-secondary, #f8fafc)' }
                      : isNeg
                        ? { background: '#fee2e2' }
                        : { background: c.bg }
                    }
                  >
                    {/* Period label */}
                    <p className="text-[11px] font-semibold leading-none"
                       style={{ color: isNull ? '#94a3b8' : isNeg ? '#991b1b' : c.text }}>
                      {label}
                    </p>

                    {/* Return value */}
                    <p className="text-xl font-bold leading-none"
                       style={{ color: isNull ? '#cbd5e1' : isNeg ? '#991b1b' : c.text }}>
                      {isNull ? '—' : `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%`}
                    </p>

                    {/* CAGR (1Y+) or since date (short periods) */}
                    {!isNull && (
                      <p className="text-[10px] leading-none"
                         style={{ color: isNeg ? '#b91c1c' : c.sub, opacity: c?.dark ? 0.8 : 0.7 }}>
                        {cagr !== null
                          ? `${ret >= 0 ? '+' : ''}${cagr.toFixed(1)}% p.a.`
                          : sinceStr ? `since ${sinceStr}` : ''}
                      </p>
                    )}
                    {/* Since date for multi-year (below CAGR) */}
                    {!isNull && cagr !== null && sinceStr && (
                      <p className="text-[10px] leading-none"
                         style={{ color: isNeg ? '#b91c1c' : c.sub, opacity: c?.dark ? 0.6 : 0.5 }}>
                        since {sinceStr}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rolling return chart card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            {/* Header row */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rolling return</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {rollingWindow === '1y' ? '1-year' : '3-year'} trailing return at every point in history
                </p>
              </div>
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg flex-shrink-0 ml-4">
                {['1y', '3y'].map(w => (
                  <button
                    key={w}
                    onClick={() => setRollingWindow(w)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      rollingWindow === w
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {rollingSeries.length < 10 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">
                Not enough data for rolling analysis
              </p>
            ) : (
              <>
                {/* Summary stats row */}
                {(() => {
                  const vals = rollingValues;
                  if (!vals.length) return null;
                  const pctPos = Math.round(vals.filter(v => v >= 0).length / vals.length * 100);
                  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
                  return (
                    <div className="flex gap-4 mt-3 mb-4 text-xs">
                      <span className="text-slate-400 dark:text-slate-500">
                        Positive periods:{' '}
                        <span className={`font-semibold ${pctPos >= 70 ? 'text-emerald-500' : pctPos >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {pctPos}%
                        </span>
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        Avg return:{' '}
                        <span className={`font-semibold ${avg >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {avg >= 0 ? '+' : ''}{avg.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  );
                })()}

                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={rollingSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rollingFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} className="dark:stroke-slate-700" />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={xTickRolling}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={60}
                    />
                    <YAxis
                      domain={[Math.min(rollingMin * 1.1, -5), Math.max(rollingMax * 1.1, 5)]}
                      tickFormatter={v => `${v.toFixed(0)}%`}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#cbd5e1"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{ value: '0%', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8', dy: -4 }}
                    />
                    <Tooltip content={<RollingTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={rollingKey}
                      stroke="#8b5cf6"
                      fill="url(#rollingFill)"
                      dot={false}
                      strokeWidth={1.5}
                      activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </>
      ) : rollingEnabled ? (
        <UpgradePrompt feature="rolling returns analysis" />
      ) : null}
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
