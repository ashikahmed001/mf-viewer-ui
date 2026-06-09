import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useFeatureFlags, canUseFeature } from '../context/FeatureFlagsContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  LineChart, Line, Legend,
  AreaChart, Area,
  Treemap,
} from 'recharts';
import {
  Layers, TrendingUp, Award, Filter, Grid3x3, ChevronRight,
  X, ChevronDown, Check, Gem, BarChart2, Clock, ArrowLeftRight, Search,
  Sparkles, Activity, RotateCcw, Telescope, Gauge, Blend, Brain,
  TrendingDown, ArrowUp, ArrowDown, Minus, Info,
} from 'lucide-react';
import {
  getCrossFundAnalysis, getOverlapMatrix, getOverlapTrend,
  getSectorDrift, getHiddenGems, getEntryExitTimeline,
  getMonthlyDiff, stockSearch, getStockTracker,
  getFunds, getFundExtractions,
  getAllFundsNewEntries, getFundChurnRates, getSectorRotationCalendar,
  getStockDiscoveryChain, getConcentrationScores, getBlendedHoldings,
  getStockPeers,
} from '../api/client.js';
import { getIndustryColor, industryBadgeClass } from '../utils/industryColors.js';
import CapBadge from '../components/CapBadge.jsx';

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

// Build short fund names by finding words common to most fund names and stripping them.
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

// Heatmap cell color based on overlap %
function overlapColor(pct) {
  if (pct === null) return { bg: 'bg-slate-100',   text: 'text-slate-400 dark:text-slate-500',   border: 'border-slate-200 dark:border-slate-700',   ring: 'ring-slate-400',   shadow: 'shadow-slate-100' };
  if (pct >= 60)   return { bg: 'bg-red-100',      text: 'text-red-800',     border: 'border-red-300',     ring: 'ring-red-400',     shadow: 'shadow-red-100' };
  if (pct >= 40)   return { bg: 'bg-orange-100',   text: 'text-orange-800',  border: 'border-orange-300',  ring: 'ring-orange-400',  shadow: 'shadow-orange-100' };
  if (pct >= 20)   return { bg: 'bg-yellow-50',    text: 'text-yellow-800',  border: 'border-yellow-300',  ring: 'ring-yellow-400',  shadow: 'shadow-yellow-100' };
  if (pct >= 5)    return { bg: 'bg-indigo-50',      text: 'text-indigo-700',    border: 'border-indigo-200',    ring: 'ring-indigo-400',    shadow: 'shadow-blue-100' };
  return             { bg: 'bg-emerald-50',   text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-400', shadow: 'shadow-emerald-100' };
}

// Distinct palette for sector areas
const SECTOR_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#e11d48','#22c55e','#eab308',
];

// ─── Shared StatCard ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">{icon} {label}</div>
      <div className="font-bold text-slate-800 dark:text-slate-200 text-lg">{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

// ─── Tab info tooltip ─────────────────────────────────────────────────────────

function InfoTooltip({ desc, tip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center" onClick={e => e.stopPropagation()}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-violet-600 transition-colors focus:outline-none"
        tabIndex={-1}
        aria-label="Info"
      >
        <Info className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3.5 text-left pointer-events-none"
          style={{ minWidth: 220 }}
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #e2e8f0' }} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 mt-[-1px]"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid white' }} />

          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 leading-snug">{desc}</p>
          {tip && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800 my-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">What to look for</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{tip}</p>
            </>
          )}
        </div>
      )}
    </span>
  );
}

// ─── Multi-select fund dropdown ───────────────────────────────────────────────

function FundMultiSelect({ funds, selected, onChange, shortNames }) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.size === funds.length;

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size > 0) onChange(next);
  }

  function toggleAll() {
    onChange(allSelected
      ? new Set(funds.slice(0, 2).map(f => f.fund_id))
      : new Set(funds.map(f => f.fund_id)));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-violet-300 hover:text-violet-700 transition-colors"
      >
        <Filter className="w-4 h-4" />
        {selected.size === funds.length ? 'All funds' : `${selected.size} of ${funds.length} funds`}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-72 py-2 max-h-96 overflow-y-auto">
            <button
              onClick={toggleAll}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors border-b border-slate-100 dark:border-slate-800"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                allSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
              }`}>
                {allSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {allSelected ? 'Deselect all' : 'Select all'}
              </span>
            </button>

            {funds.map(f => (
              <button
                key={f.fund_id}
                onClick={() => toggle(f.fund_id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  selected.has(f.fund_id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                }`}>
                  {selected.has(f.fund_id) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{f.fund_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtMonth(f.report_month)}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Single-select fund searchbox ────────────────────────────────────────────

function FundSelect({ funds, value, onChange, shortNames, placeholder = 'Search fund…' }) {
  const selected    = funds.find(f => f.fund_id === value);
  const displayName = selected ? (shortNames?.get(selected.fund_name) ?? selected.fund_name) : '';

  const [query,    setQuery]    = useState(displayName);
  const [dropOpen, setDropOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  // Keep query in sync when value changes externally
  useEffect(() => {
    setQuery(selected ? (shortNames?.get(selected.fund_name) ?? selected.fund_name) : '');
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropOpen(false);
        // Reset query to selected name on blur-away
        setQuery(selected ? (shortNames?.get(selected.fund_name) ?? selected.fund_name) : '');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [selected, shortNames]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return funds;
    return funds.filter(f =>
      f.fund_name.toLowerCase().includes(q) ||
      (shortNames?.get(f.fund_name) ?? '').toLowerCase().includes(q)
    );
  }, [funds, query, shortNames]);

  function select(f) {
    onChange(f.fund_id);
    setQuery(shortNames?.get(f.fund_name) ?? f.fund_name);
    setDropOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl shadow-sm transition-all min-w-[220px] ${dropOpen ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'}`}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
          onFocus={() => { setQuery(''); setDropOpen(true); }}
          placeholder={placeholder}
          className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent outline-none placeholder:text-slate-400 dark:text-slate-500 min-w-0"
        />
        {selected && !dropOpen ? (
          <button onMouseDown={e => { e.preventDefault(); onChange(null); setQuery(''); setDropOpen(true); inputRef.current?.focus(); }}
            className="text-slate-300 hover:text-slate-500 dark:text-slate-400 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
        )}
      </div>

      {dropOpen && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-[360px] py-1.5 max-h-72 overflow-y-auto">
          {results.map(f => (
            <button
              key={f.fund_id}
              onMouseDown={e => { e.preventDefault(); select(f); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors ${f.fund_id === value ? 'bg-violet-50' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug truncate">{f.fund_name}</p>
                {f.report_month && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtMonth(f.report_month)}</p>}
              </div>
              {f.fund_id === value && <Check className="w-4 h-4 text-violet-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Overlap Trend tab ────────────────────────────────────────────────────────

function OverlapTrend({ matrixFunds, shortNames }) {
  const [fundAId, setFundAId] = useState(null);
  const [fundBId, setFundBId] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Auto-select first two funds on mount
  useEffect(() => {
    if (matrixFunds.length >= 2 && !fundAId && !fundBId) {
      setFundAId(matrixFunds[0].fund_id);
      setFundBId(matrixFunds[1].fund_id);
    }
  }, [matrixFunds]);

  useEffect(() => {
    if (!fundAId || !fundBId || fundAId === fundBId) { setTrendData(null); return; }
    setLoading(true);
    setError(null);
    setSelectedMonth(null);
    getOverlapTrend(fundAId, fundBId)
      .then(setTrendData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fundAId, fundBId]);

  const fundA = matrixFunds.find(f => f.fund_id === fundAId);
  const fundB = matrixFunds.find(f => f.fund_id === fundBId);

  const chartData = (trendData || []).map(d => ({
    ...d,
    label: fmtMonth(d.month),
  }));

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isSelected = selectedMonth?.month === payload.month;
    return (
      <circle
        cx={cx} cy={cy} r={isSelected ? 7 : 5}
        fill={isSelected ? '#7c3aed' : '#6366f1'}
        stroke="white" strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelectedMonth(isSelected ? null : payload)}
      />
    );
  };

  const monthSel = trendData?.find(d => d.month === selectedMonth?.month);

  return (
    <div>
      {/* Fund selectors */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Compare two funds over time</p>
        <div className="flex items-center gap-3 flex-wrap">
          <FundSelect
            funds={matrixFunds}
            value={fundAId}
            onChange={id => { setFundAId(id); if (id === fundBId) setFundBId(null); }}
            shortNames={shortNames}
            placeholder="Fund A…"
          />
          <span className="text-slate-400 dark:text-slate-500 font-bold text-lg">×</span>
          <FundSelect
            funds={matrixFunds.filter(f => f.fund_id !== fundAId)}
            value={fundBId}
            onChange={setFundBId}
            shortNames={shortNames}
            placeholder="Fund B…"
          />
          {trendData && (
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{trendData.length} common month{trendData.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {fundAId === fundBId && fundAId && (
        <div className="text-sm text-slate-500 dark:text-slate-400 p-4">Please select two different funds.</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {trendData && trendData.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          No overlapping months found for these two funds.
        </div>
      )}

      {trendData && trendData.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
              label="Latest overlap"
              value={`${fmt(trendData[trendData.length - 1].overlap_pct)}%`}
              sub={fmtMonth(trendData[trendData.length - 1].month)}
            />
            <StatCard
              icon={<span className="text-base">🔴</span>}
              label="Peak overlap"
              value={`${fmt(Math.max(...trendData.map(d => d.overlap_pct)))}%`}
              sub={fmtMonth(trendData.reduce((m, d) => d.overlap_pct > m.overlap_pct ? d : m).month)}
            />
            <StatCard
              icon={<span className="text-base">🟢</span>}
              label="Lowest overlap"
              value={`${fmt(Math.min(...trendData.map(d => d.overlap_pct)))}%`}
              sub={fmtMonth(trendData.reduce((m, d) => d.overlap_pct < m.overlap_pct ? d : m).month)}
            />
          </div>

          {/* Line chart */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Overlap % Over Time</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">Click any point to see shared stocks</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {shortNames.get(fundA?.fund_name)} × {shortNames.get(fundB?.fund_name)}
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} width={48}
                  domain={[0, dataMax => Math.min(100, Math.ceil(dataMax / 10) * 10 + 10)]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 text-sm">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{d.label}</p>
                        <p className="text-violet-700 font-bold">{fmt(d.overlap_pct)}% avg overlap</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {shortNames.get(fundA?.fund_name)}: {fmt(d.overlap_pct_a)}%
                          {' · '}
                          {shortNames.get(fundB?.fund_name)}: {fmt(d.overlap_pct_b)}%
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{d.shared_count} shared stocks</p>
                        <p className="text-xs text-violet-400 mt-1">Click to drill down</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone" dataKey="overlap_pct" stroke="#6366f1" strokeWidth={2.5}
                  dot={<CustomDot />} activeDot={false}
                  name="Avg overlap %"
                />
                <Line
                  type="monotone" dataKey="overlap_pct_a" stroke="#a5b4fc" strokeWidth={1.5}
                  strokeDasharray="4 3" dot={false}
                  name={`${shortNames.get(fundA?.fund_name)} %`}
                />
                <Line
                  type="monotone" dataKey="overlap_pct_b" stroke="#c4b5fd" strokeWidth={1.5}
                  strokeDasharray="4 3" dot={false}
                  name={`${shortNames.get(fundB?.fund_name)} %`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Drill-down for selected month */}
          {monthSel && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {shortNames.get(fundA?.fund_name)} × {shortNames.get(fundB?.fund_name)}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                      {fmtMonth(monthSel.month)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`font-bold px-2 py-0.5 rounded border ${overlapColor(monthSel.overlap_pct).bg} ${overlapColor(monthSel.overlap_pct).text} ${overlapColor(monthSel.overlap_pct).border}`}>
                      {fmt(monthSel.overlap_pct)}% overlap
                    </span>
                    <span>{monthSel.shared_count} shared stocks</span>
                  </div>
                </div>
                <button onClick={() => setSelectedMonth(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Three-column layout: unique A | shared | unique B */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">

                {/* Unique to Fund A */}
                <div>
                  <div className="px-4 py-2.5 bg-indigo-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-700">Only in {shortNames.get(fundA?.fund_name)}</p>
                    <span className="text-xs text-indigo-400">{monthSel.unique_a?.length ?? 0}</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {(monthSel.unique_a ?? []).map(h => (
                      <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                          <CapBadge cap={h.market_cap_cat} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {h.industry
                            ? <span className={`inline-flex items-center px-1 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                            : <span />}
                          <span className="text-xs font-bold text-indigo-600 tabular-nums">{fmt(h.pct, 2)}%</span>
                        </div>
                      </div>
                    ))}
                    {(monthSel.unique_a ?? []).length === 0 && (
                      <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">No unique stocks</p>
                    )}
                  </div>
                </div>

                {/* Shared */}
                <div>
                  <div className="px-4 py-2.5 bg-violet-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-xs font-semibold text-violet-700">Shared holdings</p>
                    <span className="text-xs text-violet-400">{monthSel.shared_count}</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {monthSel.shared_holdings.map(h => (
                      <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                          <CapBadge cap={h.market_cap_cat} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {h.industry
                            ? <span className={`inline-flex items-center px-1 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                            : <span />}
                          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            <span className="text-indigo-500 font-semibold">{fmt(h.pct_a, 2)}%</span>
                            {' · '}
                            <span className="text-emerald-500 font-semibold">{fmt(h.pct_b, 2)}%</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {monthSel.shared_holdings.length === 0 && (
                      <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">No shared stocks</p>
                    )}
                  </div>
                </div>

                {/* Unique to Fund B */}
                <div>
                  <div className="px-4 py-2.5 bg-emerald-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-700">Only in {shortNames.get(fundB?.fund_name)}</p>
                    <span className="text-xs text-emerald-400">{monthSel.unique_b?.length ?? 0}</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {(monthSel.unique_b ?? []).map(h => (
                      <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                          <CapBadge cap={h.market_cap_cat} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {h.industry
                            ? <span className={`inline-flex items-center px-1 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                            : <span />}
                          <span className="text-xs font-bold text-emerald-600 tabular-nums">{fmt(h.pct, 2)}%</span>
                        </div>
                      </div>
                    ))}
                    {(monthSel.unique_b ?? []).length === 0 && (
                      <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">No unique stocks</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sector Drift — Heatmap sub-chart ────────────────────────────────────────

function SectorHeatmap({ data, topN }) {
  const industries = data.industries.slice(0, topN);

  // Max pct across all visible cells for color scaling
  const maxPct = Math.max(
    ...data.series.flatMap(row => industries.map(ind => row[ind] || 0)),
    1
  );

  // Interpolate slate-50 → violet-700 based on intensity 0–1
  function cellStyle(pct) {
    if (!pct) return { backgroundColor: '#f8fafc', color: '#cbd5e1' };
    const t = Math.pow(pct / maxPct, 0.6); // gamma compress so low values still show
    const r = Math.round(248 + t * (109 - 248));
    const g = Math.round(250 + t * ( 40 - 250));
    const b = Math.round(252 + t * (217 - 252));
    return {
      backgroundColor: `rgb(${r},${g},${b})`,
      color: t > 0.55 ? '#fff' : '#3b0764',
    };
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Allocation Heatmap</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 dark:text-slate-500">Low</span>
          {[0.05,0.2,0.4,0.65,0.85,1].map(t => {
            const r = Math.round(248 + t * (109 - 248));
            const g = Math.round(250 + t * ( 40 - 250));
            const b = Math.round(252 + t * (217 - 252));
            return <span key={t} className="w-5 h-3 rounded-sm inline-block" style={{ backgroundColor: `rgb(${r},${g},${b})` }} />;
          })}
          <span className="text-xs text-slate-400 dark:text-slate-500">High</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Each cell = % of NAV — colour intensity = relative weight</p>
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="w-32 pb-1" />
            {data.months.map(m => (
              <th key={m} className="pb-1 min-w-[56px]">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtMonth(m)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {industries.map((ind, i) => (
            <tr key={ind}>
              <td className="pr-2 py-0.5 text-right">
                <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={ind}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                  {ind}
                </span>
              </td>
              {data.months.map(m => {
                const val = data.series.find(s => s.month === m)?.[ind] ?? 0;
                return (
                  <td key={m} className="min-w-[56px]">
                    <div
                      className="rounded-md px-1.5 py-1.5 text-center tabular-nums font-semibold transition-transform hover:scale-105 cursor-default"
                      style={cellStyle(val)}
                      title={`${ind} · ${fmtMonth(m)}: ${fmt(val)}%`}
                    >
                      {val > 0 ? `${fmt(val)}%` : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sector Drift — Bump chart sub-chart ─────────────────────────────────────

function SectorBumpChart({ data, topN }) {
  const [hovered, setHovered] = useState(null);

  const industries = data.industries.slice(0, topN);
  const months     = data.months;

  if (months.length < 2) return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm mb-6">
      Need at least 2 months of data to show rank changes.
    </div>
  );

  // Layout constants
  const PAD_L   = 132;   // left: sector name labels
  const PAD_R   = 136;   // right: sector name labels
  const PAD_TOP = 16;
  const PAD_BOT = 32;    // x-axis
  const ROW_H   = 46;    // vertical space per rank slot
  // Scale inner width with number of months so lines don't crowd
  const INNER_W = Math.max(600, Math.min(months.length * 22, 1200));
  const SVG_W   = PAD_L + INNER_W + PAD_R;
  const SVG_H   = PAD_TOP + topN * ROW_H + PAD_BOT;

  // Rank table: rankAt[monthIdx][ind] = 0-based rank
  const rankAt = months.map(month => {
    const row    = data.series.find(s => s.month === month) ?? {};
    const sorted = [...industries].sort((a, b) => (row[b] || 0) - (row[a] || 0));
    const ranks  = {};
    industries.forEach(ind => { ranks[ind] = sorted.indexOf(ind); });
    return ranks;
  });

  // Coordinate helpers
  const xOf = i => PAD_L + (i / (months.length - 1)) * INNER_W;
  const yOf = rank => PAD_TOP + rank * ROW_H + ROW_H / 2;

  // Build cubic bezier path for one industry across all months
  // S-curves when rank changes, flat when rank stays the same
  function makePath(ind) {
    let d = `M ${xOf(0)} ${yOf(rankAt[0][ind])}`;
    for (let i = 0; i < months.length - 1; i++) {
      const x1 = xOf(i),     y1 = yOf(rankAt[i][ind]);
      const x2 = xOf(i + 1), y2 = yOf(rankAt[i + 1][ind]);
      const dx = (x2 - x1) * 0.45;
      d += ` C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    }
    return d;
  }

  // X-axis label step: aim for ~10–14 labels max
  const labelStep = Math.max(1, Math.ceil(months.length / 12));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Rank Over Time</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">#1 = largest allocation · hover to highlight</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        Lines crossing = sectors swapping rank · S-curve = gradual shift · flat = stable position
      </p>
      <div className="overflow-x-auto">
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block' }}>

          {/* Horizontal rank guide lines */}
          {industries.map((_, rank) => (
            <line key={rank}
              x1={PAD_L} y1={yOf(rank)} x2={PAD_L + INNER_W} y2={yOf(rank)}
              stroke="#f1f5f9" strokeWidth={1}
            />
          ))}

          {/* Rank labels on Y-axis */}
          {industries.map((_, rank) => (
            <text key={rank}
              x={PAD_L - 6} y={yOf(rank) + 4}
              textAnchor="end" fontSize={11} fill="#cbd5e1" fontWeight={600}
            >
              #{rank + 1}
            </text>
          ))}

          {/* Lines — dimmed when another is hovered */}
          {industries.map((ind, i) => {
            const color    = SECTOR_COLORS[i % SECTOR_COLORS.length];
            const isActive = hovered === null || hovered === ind;
            return (
              <path
                key={ind}
                d={makePath(ind)}
                fill="none"
                stroke={color}
                strokeWidth={hovered === ind ? 3.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isActive ? 0.9 : 0.12}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s, stroke-width 0.15s' }}
                onMouseEnter={() => setHovered(ind)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{ind}</title>
              </path>
            );
          })}

          {/* Dots at first month only */}
          {industries.map((ind, i) => {
            const color    = SECTOR_COLORS[i % SECTOR_COLORS.length];
            const isActive = hovered === null || hovered === ind;
            return (
              <circle key={`s-${ind}`}
                cx={xOf(0)} cy={yOf(rankAt[0][ind])} r={4}
                fill={color} stroke="white" strokeWidth={1.5}
                opacity={isActive ? 1 : 0.12}
                style={{ transition: 'opacity 0.15s' }}
              />
            );
          })}

          {/* Dots at last month */}
          {industries.map((ind, i) => {
            const color    = SECTOR_COLORS[i % SECTOR_COLORS.length];
            const isActive = hovered === null || hovered === ind;
            return (
              <circle key={`e-${ind}`}
                cx={xOf(months.length - 1)} cy={yOf(rankAt[months.length - 1][ind])} r={4}
                fill={color} stroke="white" strokeWidth={1.5}
                opacity={isActive ? 1 : 0.12}
                style={{ transition: 'opacity 0.15s' }}
              />
            );
          })}

          {/* Left labels — positioned at each sector's rank in first month */}
          {industries.map((ind, i) => {
            const color    = SECTOR_COLORS[i % SECTOR_COLORS.length];
            const rank0    = rankAt[0][ind];
            const isActive = hovered === null || hovered === ind;
            const short    = ind.length > 17 ? ind.slice(0, 15) + '…' : ind;
            return (
              <text key={`lbl-l-${ind}`}
                x={PAD_L - 14} y={yOf(rank0) + 4}
                textAnchor="end" fontSize={10.5} fontWeight={hovered === ind ? 700 : 500}
                fill={color}
                opacity={isActive ? 1 : 0.2}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHovered(ind)}
                onMouseLeave={() => setHovered(null)}
              >
                {short}
              </text>
            );
          })}

          {/* Right labels — positioned at each sector's rank in last month */}
          {industries.map((ind, i) => {
            const color    = SECTOR_COLORS[i % SECTOR_COLORS.length];
            const rankLast = rankAt[months.length - 1][ind];
            const isActive = hovered === null || hovered === ind;
            const short    = ind.length > 17 ? ind.slice(0, 15) + '…' : ind;
            return (
              <text key={`lbl-r-${ind}`}
                x={PAD_L + INNER_W + 14} y={yOf(rankLast) + 4}
                textAnchor="start" fontSize={10.5} fontWeight={hovered === ind ? 700 : 500}
                fill={color}
                opacity={isActive ? 1 : 0.2}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHovered(ind)}
                onMouseLeave={() => setHovered(null)}
              >
                {short}
              </text>
            );
          })}

          {/* X-axis month labels */}
          {months.map((m, i) => {
            if (i % labelStep !== 0 && i !== months.length - 1) return null;
            return (
              <text key={m}
                x={xOf(i)} y={SVG_H - 6}
                textAnchor="middle" fontSize={10} fill="#94a3b8"
              >
                {fmtMonth(m)}
              </text>
            );
          })}

          {/* Vertical tick marks at label positions */}
          {months.map((m, i) => {
            if (i % labelStep !== 0 && i !== months.length - 1) return null;
            return (
              <line key={`tick-${m}`}
                x1={xOf(i)} y1={PAD_TOP + topN * ROW_H}
                x2={xOf(i)} y2={PAD_TOP + topN * ROW_H + 5}
                stroke="#e2e8f0" strokeWidth={1}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend: hovered sector detail */}
      {hovered && (
        <div className="mt-3 flex items-center gap-3 flex-wrap px-1">
          {months.map((m, i) => {
            const rank = rankAt[i]?.[hovered];
            const row  = data.series.find(s => s.month === m) ?? {};
            const pct  = row[hovered] ?? 0;
            const indIdx = industries.indexOf(hovered);
            const color  = SECTOR_COLORS[indIdx % SECTOR_COLORS.length];
            return (
              <span key={m} className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 dark:text-slate-500">{fmtMonth(m)}</span>{' '}
                <span className="font-bold" style={{ color }}>#{rank + 1}</span>{' '}
                <span className="text-slate-500 dark:text-slate-400">({fmt(pct)}%)</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sector Drift tab ─────────────────────────────────────────────────────────

function SectorDrift({ allFunds }) {
  const shortNames = buildShortNames(allFunds.map(f => f.name));
  const [fundId, setFundId]       = useState(allFunds[0]?.id ?? null);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [topN, setTopN]           = useState(8);
  const [chartType, setChartType] = useState('area'); // 'area' | 'bump'

  // Build fund list in the shape FundSelect expects
  const fundList = allFunds.map(f => ({ fund_id: f.id, fund_name: f.name, report_month: null }));

  useEffect(() => {
    if (!fundId) return;
    setLoading(true); setError(null);
    getSectorDrift(fundId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fundId]);

  // Visible industries + "Other" bucket for area chart
  const chartData = data ? data.series.map(row => {
    const topIndustries = data.industries.slice(0, topN);
    const otherSum = data.industries.slice(topN).reduce((s, ind) => s + (row[ind] || 0), 0);
    const entry = { month: fmtMonth(row.month) };
    for (const ind of topIndustries) entry[ind] = row[ind] || 0;
    if (data.industries.length > topN) entry['Other'] = parseFloat(otherSum.toFixed(2));
    return entry;
  }) : [];

  const visibleIndustries = data
    ? [...data.industries.slice(0, topN), ...(data.industries.length > topN ? ['Other'] : [])]
    : [];

  const AreaTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a, b) => b.value - a.value).filter(p => p.value > 0);
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 text-xs max-w-[220px]">
        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
        {sorted.map(p => (
          <div key={p.dataKey} className="flex justify-between gap-3 py-0.5">
            <span style={{ color: p.fill }} className="truncate max-w-[130px]">{p.dataKey}</span>
            <span className="font-semibold tabular-nums">{fmt(p.value)}%</span>
          </div>
        ))}
      </div>
    );
  };

  const chartTypes = [
    { id: 'area', label: 'Stacked Area' },
    { id: 'bump', label: 'Rank Chart' },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">How has this fund's sector allocation shifted?</p>
        <div className="flex items-center gap-4 flex-wrap">
          <FundSelect
            funds={fundList}
            value={fundId}
            onChange={setFundId}
            shortNames={shortNames}
            placeholder="Select fund…"
          />
          {/* Chart type selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            {chartTypes.map(ct => (
              <button key={ct.id} onClick={() => setChartType(ct.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  chartType === ct.id
                    ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                }`}>{ct.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400">Top sectors:</span>
            {[5, 8, 12].map(n => (
              <button key={n} onClick={() => setTopN(n)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  topN === n
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300'
                }`}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="skeleton h-80 rounded-2xl" />}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {data && (
        <>
          {data.series.length < 2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm mb-4">
              Only {data.series.length} month{data.series.length !== 1 ? 's' : ''} of data — trend will be more meaningful with more history.
            </div>
          )}

          {/* Chart */}
          {chartType === 'area' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Allocation Over Time</h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">{data.months.length} month{data.months.length !== 1 ? 's' : ''} · stacked % of NAV</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{allFunds.find(f => f.id === fundId)?.name}</p>
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<AreaTooltip />} />
                  {visibleIndustries.map((ind, i) => (
                    <Area key={ind} type="monotone" dataKey={ind} stackId="1"
                      stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                      fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                      fillOpacity={0.8} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
                    formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartType === 'bump' && <SectorBumpChart data={data} topN={topN} />}

          {/* Month-by-month table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Sector Breakdown by Month</h2>
            <table className="text-xs min-w-max">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase w-28">Sector</th>
                  {data.months.map(m => (
                    <th key={m} className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">
                      {fmtMonth(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.industries.slice(0, topN + 2).map((ind, i) => (
                  <tr key={ind} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={ind}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      {ind}
                    </td>
                    {data.months.map(m => {
                      const val = data.series.find(s => s.month === m)?.[ind] ?? 0;
                      return (
                        <td key={m} className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {val > 0 ? `${fmt(val)}%` : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Hidden Gems tab ──────────────────────────────────────────────────────────

function HiddenGems() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [minPct, setMinPct]   = useState(0.5);
  const [sortBy, setSortBy]   = useState('pct');

  useEffect(() => {
    getHiddenGems()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;
  if (!data)   return null;

  const filtered = data
    .filter(d => d.pct >= minPct)
    .sort((a, b) => sortBy === 'pct' ? b.pct - a.pct : a.stock_name?.localeCompare(b.stock_name));

  // Group by fund for the summary strip — track latest report_month for sorting
  const byFund = new Map();
  for (const d of filtered) {
    if (!byFund.has(d.fund_id)) byFund.set(d.fund_id, { fund_name: d.fund_name, count: 0, latest_month: '' });
    const entry = byFund.get(d.fund_id);
    entry.count++;
    if ((d.report_month || '') > entry.latest_month) entry.latest_month = d.report_month || '';
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
          Stocks held exclusively by one fund — unique high-conviction bets, not consensus picks.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Min allocation:</span>
            {[0.25, 0.5, 1, 2].map(t => (
              <button key={t} onClick={() => setMinPct(t)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  minPct === t
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300'
                }`}>{t}%</button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400">Sort:</span>
            <button onClick={() => setSortBy('pct')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                sortBy === 'pct' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300'
              }`}>By allocation</button>
            <button onClick={() => setSortBy('name')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                sortBy === 'name' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300'
              }`}>By name</button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Gem className="w-4 h-4 text-violet-500" />}
          label="Unique positions" value={filtered.length}
          sub={`≥ ${minPct}% NAV`}
        />
        <StatCard
          icon={<Layers className="w-4 h-4 text-indigo-500" />}
          label="Funds with gems" value={byFund.size}
          sub="each holding exclusive stocks"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          label="Largest gem"
          value={filtered[0] ? `${fmt(filtered[0].pct)}%` : '—'}
          sub={filtered[0]?.stock_name}
        />
        <StatCard
          icon={<Award className="w-4 h-4 text-amber-500" />}
          label="Most exclusive fund"
          value={[...byFund.values()].sort((a, b) => b.count - a.count)[0]?.count ?? 0}
          sub={[...byFund.entries()].sort((a, b) => b[1].count - a[1].count)[0]?.[1].fund_name?.split(' ').slice(0, 3).join(' ')}
        />
      </div>

      {/* Per-fund breakdown */}
      {[...byFund.entries()]
        .sort((a, b) => b[1].latest_month.localeCompare(a[1].latest_month) || b[1].count - a[1].count)
        .map(([fundId, info]) => {
        const gems = filtered.filter(d => d.fund_id === fundId);
        return (
          <div key={fundId} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{info.fund_name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{gems.length} exclusive position{gems.length !== 1 ? 's' : ''} · {fmtMonth(gems[0]?.report_month)}</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                {fmt(gems.reduce((s, g) => s + g.pct, 0))}% total NAV
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Stock</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Industry</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">% NAV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {gems.map((g, i) => {
                    const color = getIndustryColor(g.industry).hex;
                    return (
                      <tr key={g.isin} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-800 dark:text-slate-200">{g.stock_name}</p>
                            <CapBadge cap={g.market_cap_cat} />
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{g.isin}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          {g.industry
                            ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(g.industry)}`}>{g.industry}</span>
                            : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-sm" style={{ color }}>
                          {fmt(g.pct, 4)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          No exclusive positions ≥ {minPct}% found. Try lowering the threshold.
        </div>
      )}
    </div>
  );
}

// ─── Entry / Exit Timeline ───────────────────────────────────────────────────

function findSegments(sortedMonths) {
  if (!sortedMonths.length) return [];
  const segs = [];
  let segStart = sortedMonths[0], segPrev = sortedMonths[0];
  for (let i = 1; i < sortedMonths.length; i++) {
    const [py, pm] = segPrev.split('-').map(Number);
    const [cy, cm] = sortedMonths[i].split('-').map(Number);
    if ((cy * 12 + cm) - (py * 12 + pm) <= 1) {
      segPrev = sortedMonths[i];
    } else {
      segs.push({ start: segStart, end: segPrev });
      segStart = segPrev = sortedMonths[i];
    }
  }
  segs.push({ start: segStart, end: segPrev });
  return segs;
}

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am) + 1;
}

function EntryExitTimeline({ allFunds }) {
  const [fundId,   setFundId]   = useState(allFunds[0]?.id ?? null);
  const [raw,      setRaw]      = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [sortBy,   setSortBy]   = useState('status');
  const [minPct,   setMinPct]   = useState(0.5);
  const [hovered,    setHovered]    = useState(null); // { isin, stock, seg }
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 });
  const [chartWidth, setChartWidth] = useState(1100);
  const containerRef = useRef(null);

  const shortNames = useMemo(() => buildShortNames(allFunds.map(f => f.name)), [allFunds]);
  const fundList   = allFunds.map(f => ({ fund_id: f.id, fund_name: f.name, report_month: null }));

  useEffect(() => {
    if (!fundId) return;
    setLoading(true); setError(null); setRaw(null);
    getEntryExitTimeline(fundId)
      .then(setRaw)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fundId]);

  // ── process raw rows into per-stock segments ──────────────────────────────
  const processed = useMemo(() => {
    if (!raw?.length) return null;
    const allMonths = [...new Set(raw.map(r => r.report_month))].sort();
    const latestMonth = allMonths[allMonths.length - 1];

    const byIsin = new Map();
    for (const row of raw) {
      if (!byIsin.has(row.isin)) {
        byIsin.set(row.isin, {
          isin:       row.isin,
          stock_name: row.stock_name,
          industry:   row.industry || 'Other',
          months:     [],
          pctMap:     new Map(),
        });
      }
      const s = byIsin.get(row.isin);
      s.months.push(row.report_month);
      s.pctMap.set(row.report_month, row.pct_nav);
    }

    const stocks = [...byIsin.values()].map(s => {
      s.months.sort();
      const segments = findSegments(s.months);
      const allPcts  = s.months.map(m => s.pctMap.get(m));
      const avgPct   = allPcts.reduce((a, b) => a + b, 0) / allPcts.length;
      const maxPct   = Math.max(...allPcts);
      const current  = s.months[s.months.length - 1] === latestMonth;
      return {
        ...s,
        segments,
        avgPct,
        maxPct,
        current,
        firstSeen: s.months[0],
        lastSeen:  s.months[s.months.length - 1],
        isReentry: segments.length > 1,
      };
    });

    return { stocks, allMonths, latestMonth };
  }, [raw]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    if (!processed) return [];
    let s = processed.stocks.filter(s => s.avgPct >= minPct);
    if (filter === 'current') s = s.filter(s => s.current);
    if (filter === 'exited')  s = s.filter(s => !s.current);
    if (filter === 'reentry') s = s.filter(s => s.isReentry);
    return [...s].sort((a, b) => {
      if (sortBy === 'status') {
        if (a.current !== b.current) return a.current ? -1 : 1;
        return b.lastSeen.localeCompare(a.lastSeen);
      }
      if (sortBy === 'firstSeen') return a.firstSeen.localeCompare(b.firstSeen);
      if (sortBy === 'pct')       return b.avgPct - a.avgPct;
      if (sortBy === 'name')      return a.stock_name.localeCompare(b.stock_name);
      return 0;
    });
  }, [processed, filter, sortBy, minPct]);

  const stats = useMemo(() => {
    if (!processed) return null;
    const all = processed.stocks.filter(s => s.avgPct >= minPct);
    return {
      total:     all.length,
      current:   all.filter(s => s.current).length,
      exited:    all.filter(s => !s.current).length,
      reentries: all.filter(s => s.isReentry).length,
    };
  }, [processed, minPct]);

  // Keep chart width in sync with container — must come after processed useMemo
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setChartWidth(el.offsetWidth);
    const ro = new ResizeObserver(entries => setChartWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [processed]); // re-run when Gantt mounts/unmounts with data

  // ── Gantt layout constants ────────────────────────────────────────────────
  const PAD_L = 188, PAD_T = 54, PAD_B = 24, PAD_R = 20;
  const ROW_H = 26, BAR_H = 14;

  const allMonths = processed?.allMonths ?? [];
  const monthIdx  = useMemo(() => new Map(allMonths.map((m, i) => [m, i])), [allMonths]);

  // Fixed chart width = full container width; COL_W fills it evenly
  const containerW = chartWidth;
  const svgW  = containerW;
  const COL_W = allMonths.length > 0
    ? Math.max(14, Math.floor((svgW - PAD_L - PAD_R) / allMonths.length))
    : 22;
  const svgH  = PAD_T + visible.length * ROW_H + PAD_B;
  const xOf   = m => PAD_L + (monthIdx.get(m) ?? 0) * COL_W;

  // Separator: index of last current row when sorted by status
  const sepIdx = sortBy === 'status'
    ? visible.findLastIndex(s => s.current)
    : -1;

  // Tooltip: fixed-position using raw clientX/clientY so scroll doesn't drift it
  const TIP_W  = 240;
  const TIP_H  = 195; // estimated tooltip height
  const tipX   = mousePos.x + 14 + TIP_W > window.innerWidth ? mousePos.x - TIP_W - 14 : mousePos.x + 14;
  const tipAbove = mousePos.y > TIP_H + 20;
  const tipStyle = tipAbove
    ? { top: mousePos.y, transform: 'translateY(-100%) translateY(-8px)' }
    : { top: mousePos.y + 20 };

  if (loading) return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
  );

  return (
    <div>
      {/* Fund picker */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FundSelect funds={fundList} value={fundId} onChange={id => { setFundId(id); setHovered(null); }}
          shortNames={shortNames} />
        {stats && (
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            {stats.total} stocks · {stats.current} current · {stats.exited} exited · {stats.reentries} re-entries
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
          {[
            { id: 'all',     label: 'All' },
            { id: 'current', label: 'Current' },
            { id: 'exited',  label: 'Exited' },
            { id: 'reentry', label: 'Re-entries' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f.id ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Sort:</span>
          {[
            { id: 'status',    label: 'Status' },
            { id: 'firstSeen', label: 'First seen' },
            { id: 'pct',       label: 'Allocation' },
            { id: 'name',      label: 'Name' },
          ].map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === s.id ? 'bg-violet-100 text-violet-700 font-semibold' : 'hover:bg-slate-100'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Min pct */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-auto">
          <span className="font-medium">Min % NAV:</span>
          {[0.1, 0.5, 1, 2].map(p => (
            <button key={p} onClick={() => setMinPct(p)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                minPct === p ? 'bg-violet-100 text-violet-700 font-semibold' : 'hover:bg-slate-100'
              }`}>
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Gantt */}
      {!processed ? (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Select a fund to see its holding timeline
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
          No stocks match the current filter. Try lowering the Min % NAV.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div ref={containerRef} className="relative overflow-auto" style={{ maxHeight: 640 }}
            onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}>

            <svg width={svgW} height={svgH} style={{ display: 'block' }}>

              {/* ── Month axis ── */}
              {allMonths.map((m, i) => {
                const x = PAD_L + i * COL_W + COL_W / 2;
                const quarterly = i % 3 === 0;
                return (
                  <g key={m}>
                    <line x1={x} y1={PAD_T - (quarterly ? 14 : 6)} x2={x} y2={PAD_T - 2}
                      stroke="#e2e8f0" strokeWidth={1} />
                    {quarterly && (
                      <text x={x} y={PAD_T - 18} textAnchor="middle"
                        fill="#94a3b8" fontSize={10} fontFamily="system-ui,sans-serif">
                        {fmtMonth(m)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Axis baseline ── */}
              <line x1={PAD_L} y1={PAD_T - 2} x2={svgW - PAD_R} y2={PAD_T - 2}
                stroke="#e2e8f0" strokeWidth={1} />

              {/* ── "Now" line ── */}
              {processed.latestMonth && (() => {
                const nx = xOf(processed.latestMonth) + COL_W;
                return (
                  <g>
                    <line x1={nx} y1={PAD_T - 2} x2={nx} y2={svgH - PAD_B}
                      stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" />
                    <text x={nx} y={PAD_T - 18} textAnchor="middle"
                      fill="#a78bfa" fontSize={9} fontWeight={600} fontFamily="system-ui,sans-serif">
                      NOW
                    </text>
                  </g>
                );
              })()}

              {/* ── Horizontal zebra ── */}
              {visible.map((_, si) => si % 2 === 0 && (
                <rect key={si} x={0} y={PAD_T + si * ROW_H}
                  width={svgW} height={ROW_H} fill="#f8fafc" />
              ))}

              {/* ── Current / Exited separator ── */}
              {sepIdx >= 0 && sepIdx < visible.length - 1 && (
                <g>
                  <line x1={0} y1={PAD_T + (sepIdx + 1) * ROW_H}
                    x2={svgW} y2={PAD_T + (sepIdx + 1) * ROW_H}
                    stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="6 4" />
                  <text x={PAD_L - 8} y={PAD_T + (sepIdx + 1) * ROW_H + 10}
                    textAnchor="end" fill="#a78bfa" fontSize={9}
                    fontWeight={600} fontFamily="system-ui,sans-serif">
                    EXITED ↓
                  </text>
                </g>
              )}

              {/* ── Stock rows ── */}
              {visible.map((stock, si) => {
                const y      = PAD_T + si * ROW_H;
                const barY   = y + (ROW_H - BAR_H) / 2;
                const color  = getIndustryColor(stock.industry).hex;
                const isHov  = hovered?.isin === stock.isin;
                const nameLabel = stock.stock_name.length > 24
                  ? stock.stock_name.slice(0, 23) + '…'
                  : stock.stock_name;

                return (
                  <g key={stock.isin}>
                    {/* Row hover highlight */}
                    {isHov && (
                      <rect x={0} y={y} width={svgW} height={ROW_H}
                        fill="rgba(139,92,246,0.07)" />
                    )}

                    {/* Stock name */}
                    <text x={PAD_L - 10} y={y + ROW_H / 2}
                      textAnchor="end" dominantBaseline="middle"
                      fill={stock.current ? '#1e293b' : '#94a3b8'}
                      fontSize={11} fontWeight={stock.current ? 600 : 400}
                      fontFamily="system-ui,sans-serif">
                      {nameLabel}
                    </text>

                    {/* Holding segments */}
                    {stock.segments.map((seg, gi) => {
                      const x1     = xOf(seg.start);
                      const x2     = xOf(seg.end) + COL_W;
                      const w      = Math.max(x2 - x1, COL_W);
                      const isLast = gi === stock.segments.length - 1;
                      const ended  = isLast ? !stock.current : true;
                      const nMonths = monthsBetween(seg.start, seg.end);
                      // avg pct for this segment's months
                      const segPcts = stock.months
                        .filter(m => m >= seg.start && m <= seg.end)
                        .map(m => stock.pctMap.get(m));
                      const segAvg = segPcts.length
                        ? segPcts.reduce((a, b) => a + b, 0) / segPcts.length : 0;

                      return (
                        <g key={gi}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHovered({ isin: stock.isin, stock, seg, segAvg, nMonths, ended })}
                          onMouseLeave={() => setHovered(h => h?.isin === stock.isin ? null : h)}>
                          {/* Bar */}
                          <rect x={x1} y={barY} width={w} height={BAR_H}
                            rx={BAR_H / 2} ry={BAR_H / 2}
                            fill={color}
                            fillOpacity={ended ? 0.35 : (isHov ? 1 : 0.82)}
                            style={{ transition: 'fill-opacity 0.1s' }}
                          />
                          {/* Entry dot */}
                          <circle cx={x1 + BAR_H / 2} cy={barY + BAR_H / 2} r={3.5}
                            fill={color} fillOpacity={ended ? 0.55 : 1}
                            stroke="white" strokeWidth={1.2} />
                          {/* Exit dot (if segment ended) */}
                          {ended && (
                            <circle cx={x2 - BAR_H / 2} cy={barY + BAR_H / 2} r={3.5}
                              fill="white" stroke={color} strokeWidth={1.8}
                              fillOpacity={0.9} />
                          )}
                        </g>
                      );
                    })}

                    {/* Re-entry count badge */}
                    {stock.isReentry && (
                      <text x={PAD_L - 10} y={y + ROW_H / 2 + 1}
                        textAnchor="end" dominantBaseline="middle"
                        fill="#f59e0b" fontSize={8}
                        fontFamily="system-ui,sans-serif">
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* ── Floating tooltip ── */}
            {hovered && (() => {
              const { stock, seg, segAvg, nMonths, ended } = hovered;
              return (
                <div className="pointer-events-none fixed z-50 rounded-xl shadow-2xl text-xs"
                  style={{
                    left:      tipX,
                    ...tipStyle,
                    minWidth:  210,
                    maxWidth:  260,
                    background: 'rgba(15,23,42,0.96)',
                    border:    '1px solid rgba(255,255,255,0.08)',
                    padding:   '10px 13px',
                  }}>
                  <p className="font-semibold text-white text-[13px] leading-snug mb-0.5">
                    {stock.stock_name}
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-[11px] mb-2.5">{stock.industry}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400 dark:text-slate-500">Period</span>
                      <span className="text-white font-medium">
                        {fmtMonth(seg.start)} → {fmtMonth(seg.end)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400 dark:text-slate-500">Duration</span>
                      <span className="text-white font-medium">{nMonths} month{nMonths !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400 dark:text-slate-500">Avg % NAV</span>
                      <span className="text-white font-medium">{fmt(segAvg)}%</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400 dark:text-slate-500">Status</span>
                      <span className={`font-semibold ${ended ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {stock.isReentry && ended ? 'Exited (was re-entry)' : ended ? 'Exited' : 'Currently held'}
                      </span>
                    </div>
                    {stock.isReentry && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500">Segments</span>
                        <span className="text-amber-400 font-medium">{stock.segments.length} periods</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <svg width={28} height={12}>
                <rect x={0} y={1} width={20} height={10} rx={5} fill="#6366f1" fillOpacity={0.82} />
                <circle cx={5} cy={6} r={3.5} fill="#6366f1" stroke="white" strokeWidth={1.2} />
              </svg>
              Currently held
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={28} height={12}>
                <rect x={0} y={1} width={20} height={10} rx={5} fill="#6366f1" fillOpacity={0.35} />
                <circle cx={5}  cy={6} r={3.5} fill="#6366f1" fillOpacity={0.55} stroke="white" strokeWidth={1.2} />
                <circle cx={15} cy={6} r={3.5} fill="white" stroke="#6366f1" strokeWidth={1.8} />
              </svg>
              Exited
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={10} height={12}>
                <line x1={5} y1={0} x2={5} y2={12} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="3 2" />
              </svg>
              Latest month
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={28} height={12}>
                <rect x={0} y={1} width={8} height={10} rx={4} fill="#6366f1" fillOpacity={0.82} />
                <rect x={12} y={1} width={16} height={10} rx={5} fill="#6366f1" fillOpacity={0.82} />
              </svg>
              Re-entry (gap = exit + return)
            </div>
            <span className="ml-auto text-slate-400 dark:text-slate-500">{visible.length} stocks shown</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Monthly Diff ─────────────────────────────────────────────────────────────

const DIFF_COLORS = {
  new:       { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', label: 'New entry',  icon: '●' },
  exit:      { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',     label: 'Exited',     icon: '○' },
  increased: { bg: 'bg-indigo-50',    border: 'border-indigo-100',    text: 'text-indigo-700',    badge: 'bg-indigo-100 text-indigo-700',   label: 'Increased',  icon: '▲' },
  decreased: { bg: 'bg-orange-50',  border: 'border-orange-100',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700', label: 'Decreased', icon: '▼' },
  unchanged: { bg: '',              border: 'border-slate-100',   text: 'text-slate-400 dark:text-slate-500',   badge: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400', label: 'Unchanged',  icon: '—' },
};

function MonthlyDiff({ allFunds }) {
  const [fundId,      setFundId]     = useState(allFunds[0]?.id ?? null);
  const [extractions, setExtractions] = useState([]);
  const [monthA,      setMonthA]     = useState(null);
  const [monthB,      setMonthB]     = useState(null);
  const [raw,         setRaw]        = useState(null);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState(null);
  const [filter,      setFilter]     = useState('all');
  const [threshold,   setThreshold]  = useState(0.3);

  const shortNames = useMemo(() => buildShortNames(allFunds.map(f => f.name)), [allFunds]);
  const fundList   = allFunds.map(f => ({ fund_id: f.id, fund_name: f.name, report_month: null }));

  // Load extraction months when fund changes
  useEffect(() => {
    if (!fundId) return;
    getFundExtractions(fundId).then(exts => {
      const sorted = [...exts].sort((a, b) => b.report_month.localeCompare(a.report_month));
      setExtractions(sorted);
      setMonthB(sorted[0]?.report_month ?? null);
      setMonthA(sorted[1]?.report_month ?? null);
      setRaw(null);
    });
  }, [fundId]);

  // Fetch diff data
  useEffect(() => {
    if (!fundId || !monthA || !monthB || monthA === monthB) return;
    setLoading(true); setError(null);
    getMonthlyDiff(fundId, monthA, monthB)
      .then(setRaw)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fundId, monthA, monthB]);

  // Compute categorised diff
  const diff = useMemo(() => {
    if (!raw) return null;
    const mapA = new Map(), mapB = new Map();
    for (const row of raw) {
      if (row.report_month === monthA) mapA.set(row.isin, row);
      else                             mapB.set(row.isin, row);
    }
    const allIsins = new Set([...mapA.keys(), ...mapB.keys()]);
    const rows = [];
    for (const isin of allIsins) {
      const a = mapA.get(isin), b = mapB.get(isin);
      const pctA = a?.pct_nav ?? 0;
      const pctB = b?.pct_nav ?? 0;
      const delta = +(pctB - pctA).toFixed(4);
      let type;
      if (!a)           type = 'new';
      else if (!b)      type = 'exit';
      else if (delta >=  threshold) type = 'increased';
      else if (delta <= -threshold) type = 'decreased';
      else              type = 'unchanged';
      rows.push({ isin, stock_name: (b ?? a).stock_name, industry: (b ?? a).industry,
                  pctA, pctB, delta, type });
    }
    return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [raw, monthA, monthB, threshold]);

  const counts = useMemo(() => {
    if (!diff) return null;
    return { new: 0, exit: 0, increased: 0, decreased: 0, unchanged: 0,
      ...Object.fromEntries(['new','exit','increased','decreased','unchanged']
        .map(t => [t, diff.filter(r => r.type === t).length])) };
  }, [diff]);

  const visible = useMemo(() => {
    if (!diff) return [];
    if (filter === 'all') return diff.filter(r => r.type !== 'unchanged');
    return diff.filter(r => r.type === filter);
  }, [diff, filter]);

  const selectCls = 'px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-violet-300 focus:outline-none focus:border-violet-400 cursor-pointer text-slate-700 dark:text-slate-300';

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FundSelect funds={fundList} value={fundId} onChange={id => setFundId(id)} shortNames={shortNames} />
        <div className="flex items-center gap-2">
          <select value={monthA ?? ''} onChange={e => setMonthA(e.target.value)} className={selectCls}>
            {extractions.map(e => (
              <option key={e.report_month} value={e.report_month}>{fmtMonth(e.report_month)}</option>
            ))}
          </select>
          <ArrowLeftRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <select value={monthB ?? ''} onChange={e => setMonthB(e.target.value)} className={selectCls}>
            {extractions.map(e => (
              <option key={e.report_month} value={e.report_month}>{fmtMonth(e.report_month)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-auto">
          <span className="font-medium">Min change:</span>
          {[0.1, 0.3, 0.5, 1].map(t => (
            <button key={t} onClick={() => setThreshold(t)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${threshold === t ? 'bg-violet-100 text-violet-700 font-semibold' : 'hover:bg-slate-100'}`}>
              {t}%
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="skeleton h-40 rounded-2xl" />}
      {error   && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {counts && (
        <>
          {/* Summary pills */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {[
              { id: 'all',       label: `All  (${counts.new + counts.exit + counts.increased + counts.decreased})` },
              { id: 'new',       label: `New  ${counts.new}` },
              { id: 'exit',      label: `Exited  ${counts.exit}` },
              { id: 'increased', label: `Increased  ${counts.increased}` },
              { id: 'decreased', label: `Decreased  ${counts.decreased}` },
              { id: 'unchanged', label: `Flat  ${counts.unchanged}` },
            ].map(f => {
              const c = f.id === 'all' ? null : DIFF_COLORS[f.id];
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    filter === f.id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : c ? `${c.bg} ${c.border} ${c.text}` : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-violet-300'
                  }`}>
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-28">Change</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{fmtMonth(monthA)}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{fmtMonth(monthB)}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visible.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No changes to show</td></tr>
                )}
                {visible.map(row => {
                  const c = DIFF_COLORS[row.type];
                  return (
                    <tr key={row.isin} className={`${c.bg} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${c.badge}`}>
                          {c.icon} {c.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{row.stock_name}</p>
                          <CapBadge cap={row.market_cap_cat} />
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{row.industry}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {row.pctA > 0 ? `${fmt(row.pctA)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                        {row.pctB > 0 ? `${fmt(row.pctB)}%` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-bold ${c.text}`}>
                        {row.type === 'new'  ? `+${fmt(row.pctB)}%` :
                         row.type === 'exit' ? `−${fmt(row.pctA)}%` :
                         `${row.delta > 0 ? '+' : ''}${fmt(row.delta)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!raw && !loading && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center text-slate-400 dark:text-slate-500 text-sm">
          Select a fund and two months to compare
        </div>
      )}
    </div>
  );
}

// ─── Stock Tracker ─────────────────────────────────────────────────────────────

const TRACKER_COLORS = [
  '#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#ef4444','#22c55e','#eab308',
];

function StockTracker({ allFunds }) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [raw,       setRaw]       = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [chartFilter, setChartFilter] = useState('significant'); // 'active' | 'significant' | 'all'
  const searchRef   = useRef(null);
  const skipSearch  = useRef(false);   // set true after a selection to suppress the next debounce

  const shortNames = useMemo(() => buildShortNames(allFunds.map(f => f.name)), [allFunds]);

  // Debounced search
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      stockSearch(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch tracker data when stock selected
  useEffect(() => {
    if (!selected) return;
    setLoading(true); setRaw(null);
    getStockTracker(selected.isin)
      .then(setRaw)
      .catch(() => setRaw([]))
      .finally(() => setLoading(false));
  }, [selected]);

  // Process into chart-ready structure
  const processed = useMemo(() => {
    if (!raw?.length) return null;
    const allMonths  = [...new Set(raw.map(r => r.report_month))].sort();
    const latestMonth = allMonths[allMonths.length - 1];
    const fundIds    = [...new Set(raw.map(r => r.fund_id))];

    // Build short names using only the funds present in this stock's data,
    // so discriminating words aren't stripped as "common".
    const localNames    = [...new Set(raw.map(r => r.fund_name))];
    const localShorts   = buildShortNames(localNames);
    // Post-pass: if two funds still get the same short name, fall back to full name (truncated)
    const shortCount = new Map();
    for (const s of localShorts.values()) shortCount.set(s, (shortCount.get(s) ?? 0) + 1);
    const deduped = new Map();
    for (const [name, s] of localShorts) {
      deduped.set(name, shortCount.get(s) > 1 ? (name.length > 30 ? name.slice(0, 28) + '…' : name) : s);
    }

    const fundMeta   = new Map(raw.map(r => [r.fund_id, { name: r.fund_name, short: deduped.get(r.fund_name) ?? r.fund_name }]));

    // Build lookup: fundId → month → pct
    const byFund = new Map();
    for (const row of raw) {
      if (!byFund.has(row.fund_id)) byFund.set(row.fund_id, new Map());
      byFund.get(row.fund_id).set(row.report_month, row.pct_nav);
    }

    // Chart data: one entry per month
    const chartData = allMonths.map(month => {
      const obj = { month };
      for (const fid of fundIds) {
        obj[`f${fid}`] = byFund.get(fid)?.get(month) ?? null;
      }
      return obj;
    });

    // Current holders in latest month (sorted by pct desc)
    const currentHolders = fundIds
      .map(fid => ({ fund_id: fid, ...fundMeta.get(fid), pct: byFund.get(fid)?.get(latestMonth) ?? null }))
      .filter(f => f.pct != null)
      .sort((a, b) => b.pct - a.pct);

    const exited = fundIds
      .map(fid => ({ fund_id: fid, ...fundMeta.get(fid), pct: byFund.get(fid)?.get(latestMonth) ?? null,
                     lastSeen: [...(byFund.get(fid)?.keys() ?? [])].sort().pop() }))
      .filter(f => f.pct == null)
      .sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));

    const maxPct = Math.max(...raw.map(r => r.pct_nav), 0.01);

    return { allMonths, fundIds, fundMeta, byFund, chartData, currentHolders, exited, latestMonth, maxPct };
  }, [raw, shortNames]);

  // Which funds to show lines for
  const visibleFundIds = useMemo(() => {
    if (!processed) return [];
    if (chartFilter === 'active')  return processed.currentHolders.map(h => h.fund_id);
    if (chartFilter === 'all')     return processed.fundIds;
    // 'significant': current holders + any fund with avg pct > 0.5%
    const avgByFund = new Map(processed.fundIds.map(fid => {
      const vals = [...(processed.byFund.get(fid)?.values() ?? [])];
      return [fid, vals.reduce((a, b) => a + b, 0) / (vals.length || 1)];
    }));
    return processed.fundIds.filter(fid =>
      processed.currentHolders.some(h => h.fund_id === fid) || (avgByFund.get(fid) ?? 0) >= 0.5
    );
  }, [processed, chartFilter]);

  const colorMap = useMemo(() =>
    new Map(visibleFundIds.map((fid, i) => [fid, TRACKER_COLORS[i % TRACKER_COLORS.length]])),
  [visibleFundIds]);

  // Custom tooltip
  const TrackerTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pts = payload.filter(p => p.value != null).sort((a, b) => b.value - a.value);
    if (!pts.length) return null;
    return (
      <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
        <p className="font-semibold mb-1.5 text-slate-300">{fmtMonth(label)}</p>
        {pts.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-300 truncate" style={{ maxWidth: 140 }}>{p.name}</span>
            </div>
            <span className="font-bold tabular-nums">{fmt(p.value)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Search box */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stock name or ISIN…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white dark:bg-slate-800"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">Searching…</span>
        )}

        {/* Dropdown results */}
        {results.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setResults([])} />
            <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-h-72 overflow-y-auto py-1">
              {results.map(r => (
                <button key={r.isin} onClick={() => { skipSearch.current = true; setSelected(r); setQuery(r.stock_name); setResults([]); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{r.stock_name}</p>
                      <CapBadge cap={r.market_cap_cat} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{r.industry} · {r.isin}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 flex-shrink-0">
                    {r.fund_count} fund{r.fund_count !== 1 ? 's' : ''} ever
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {loading && <div className="skeleton h-64 rounded-2xl" />}

      {processed && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">{selected?.stock_name}</h2>
                <CapBadge cap={selected?.market_cap_cat} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{selected?.industry} · {selected?.isin}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {processed.currentHolders.length} fund{processed.currentHolders.length !== 1 ? 's' : ''} currently holding
              </span>
              {processed.exited.length > 0 && (
                <span>· {processed.exited.length} exited · <span className="text-slate-400 dark:text-slate-500">{processed.currentHolders.length + processed.exited.length} total ever</span></span>
              )}
              {/* Chart filter segmented control */}
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 ml-2">
                {[
                  { id: 'active',      label: 'Active only' },
                  { id: 'significant', label: 'Significant' },
                  { id: 'all',         label: 'All funds'   },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setChartFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      chartFilter === opt.id
                        ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">% NAV allocation over time per fund</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={processed.chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={fmtMonth}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  interval={Math.floor(processed.allMonths.length / 8)} />
                <YAxis tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<TrackerTooltip />} />
                {visibleFundIds.map(fid => (
                  <Line key={fid} dataKey={`f${fid}`} connectNulls={false}
                    name={processed.fundMeta.get(fid)?.short ?? ''}
                    stroke={colorMap.get(fid)} strokeWidth={2}
                    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
              {visibleFundIds.map(fid => {
                const meta = processed.fundMeta.get(fid);
                const isCurrent = processed.currentHolders.some(h => h.fund_id === fid);
                return (
                  <div key={fid} className="flex items-center gap-1.5 min-w-0" title={meta?.name}>
                    <span className="w-3 flex-shrink-0" style={{ height: 2, backgroundColor: colorMap.get(fid), display: 'inline-block', borderRadius: 2, verticalAlign: 'middle', marginBottom: 1 }} />
                    <span className={`text-xs truncate max-w-[160px] ${isCurrent ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      {meta?.short ?? meta?.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current holders + exited side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Currently holding · {fmtMonth(processed.latestMonth)}
                </p>
              </div>
              {processed.currentHolders.length === 0
                ? <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500">No fund holds this stock now</p>
                : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {processed.currentHolders.map((h, i) => (
                      <div key={h.fund_id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorMap.get(h.fund_id) ?? '#6366f1' }} />
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={h.name}>{h.name}</span>
                        <span className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-200">{fmt(h.pct)}%</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Exited · {processed.exited.length} fund{processed.exited.length !== 1 ? 's' : ''}
                </p>
              </div>
              {processed.exited.length === 0
                ? <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500">All funds still holding</p>
                : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-64 overflow-y-auto">
                    {processed.exited.map(h => (
                      <div key={h.fund_id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate flex-1" title={h.name}>{h.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">last {fmtMonth(h.lastSeen)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </>
      )}

      {!selected && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <svg width="220" height="200" viewBox="0 0 100 91" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes cal-cell1 { 0%,100%{opacity:0.4} 50%{opacity:1} }
                @keyframes cal-cell2 { 0%,100%{opacity:0.4} 50%{opacity:1} }
                @keyframes cal-cell3 { 0%,100%{opacity:0.4} 50%{opacity:1} }
                @keyframes cal-arrow { 0%,100%{transform:translateX(0)} 50%{transform:translateX(3px)} }
                .cal-r1a { animation:cal-cell1 2.4s ease-in-out infinite 0s; }
                .cal-r1b { animation:cal-cell1 2.4s ease-in-out infinite 0.3s; }
                .cal-r2a { animation:cal-cell2 2.4s ease-in-out infinite 0.6s; }
                .cal-r2b { animation:cal-cell2 2.4s ease-in-out infinite 0.9s; }
                .cal-r3a { animation:cal-cell3 2.4s ease-in-out infinite 1.2s; }
                .cal-r3b { animation:cal-cell3 2.4s ease-in-out infinite 1.5s; }
                .cal-arrow { transform-origin:84px 80px; animation:cal-arrow 1.8s ease-in-out infinite; }
              `}</style>
            </defs>
            {/* Calendar card */}
            <rect x="8" y="12" width="84" height="70" rx="7" fill="white" stroke="#EEEDFE" strokeWidth="1.4"/>
            <rect x="8" y="12" width="84" height="18" rx="7" fill="#EEEDFE"/>
            <rect x="8" y="22" width="84" height="8" fill="#EEEDFE"/>
            <rect x="24" y="8" width="8" height="10" rx="3" fill="#AFA9EC"/>
            <rect x="68" y="8" width="8" height="10" rx="3" fill="#AFA9EC"/>
            {/* Row 1 */}
            <rect x="16" y="36" width="14" height="10" rx="3" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="0.8"/>
            <rect x="34" y="36" width="14" height="10" rx="3" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="0.8"/>
            <rect className="cal-r1a" x="52" y="36" width="14" height="10" rx="3" fill="#7F77DD"/>
            <rect className="cal-r1b" x="70" y="36" width="14" height="10" rx="3" fill="#534AB7"/>
            {/* Row 2 */}
            <rect x="16" y="50" width="14" height="10" rx="3" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="0.8"/>
            <rect className="cal-r2a" x="34" y="50" width="14" height="10" rx="3" fill="#1D9E75"/>
            <rect className="cal-r2b" x="52" y="50" width="14" height="10" rx="3" fill="#1D9E75"/>
            <rect x="70" y="50" width="14" height="10" rx="3" fill="#1D9E75"/>
            {/* Row 3 */}
            <rect x="16" y="64" width="14" height="10" rx="3" fill="#FFF3CE" stroke="#BA7517" strokeWidth="0.8"/>
            <rect x="34" y="64" width="14" height="10" rx="3" fill="#FFF3CE" stroke="#BA7517" strokeWidth="0.8"/>
            <rect className="cal-r3a" x="52" y="64" width="14" height="10" rx="3" fill="#BA7517"/>
            <rect className="cal-r3b" x="70" y="64" width="14" height="10" rx="3" fill="#FAC775"/>
            {/* Animated arrow */}
            <g className="cal-arrow">
              <path d="M82 76 L86 80 L82 84" stroke="#AFA9EC" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <ellipse cx="50" cy="88" rx="36" ry="4" fill="#D3D1C7" opacity="0.2"/>
            <circle cx="4" cy="8" r="2" fill="#FAC775"/>
            <circle cx="96" cy="6" r="1.8" fill="#CECBF6"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">Fund Allocation Over Time</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Search for a stock above to see how all funds have allocated to it over time.</p>
        </div>
      )}
    </div>
  );
}

// ─── Overlap Matrix tab ───────────────────────────────────────────────────────

function OverlapMatrix() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null); // { pair, rowId, colId }
  const [activeFunds, setActiveFunds] = useState(null); // Set of fund_ids; null = all

  useEffect(() => {
    getOverlapMatrix()
      .then(d => {
        setData(d);
        setActiveFunds(new Set(d.funds.slice(0, 4).map(f => f.fund_id)));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
  );
  if (!data || !activeFunds) return null;

  const { funds, pairs } = data;
  const shortNames = buildShortNames(funds.map(f => f.fund_name));
  const visibleFunds = funds.filter(f => activeFunds.has(f.fund_id));
  const visiblePairs = pairs.filter(p => activeFunds.has(p.fund_a_id) && activeFunds.has(p.fund_b_id));

  const pairMap = new Map();
  for (const p of visiblePairs) {
    pairMap.set(`${p.fund_a_id}:${p.fund_b_id}`, p);
    pairMap.set(`${p.fund_b_id}:${p.fund_a_id}`, p);
  }

  const maxOverlap = visiblePairs.length ? visiblePairs.reduce((m, p) => p.overlap_pct > m.overlap_pct ? p : m, visiblePairs[0]) : null;
  const minOverlap = visiblePairs.length ? visiblePairs.reduce((m, p) => p.overlap_pct < m.overlap_pct ? p : m, visiblePairs[0]) : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="grid grid-cols-3 gap-4 flex-1 min-w-0">
          <StatCard icon={<Grid3x3 className="w-4 h-4 text-violet-500" />}
            label="Pairs shown" value={visiblePairs.length}
            sub={`${visibleFunds.length} of ${funds.length} funds selected`} />
          <StatCard icon={<span className="text-base">🔴</span>}
            label="Highest overlap"
            value={maxOverlap ? `${fmt(maxOverlap.overlap_pct)}%` : '—'}
            sub={maxOverlap ? `${shortNames.get(maxOverlap.fund_a_name)} × ${shortNames.get(maxOverlap.fund_b_name)}` : ''} />
          <StatCard icon={<span className="text-base">🟢</span>}
            label="Lowest overlap"
            value={minOverlap ? `${fmt(minOverlap.overlap_pct)}%` : '—'}
            sub={minOverlap ? `${shortNames.get(minOverlap.fund_a_name)} × ${shortNames.get(minOverlap.fund_b_name)}` : ''} />
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <FundMultiSelect
          funds={funds}
          selected={activeFunds}
          onChange={s => { setActiveFunds(s); setSelected(null); }}
          shortNames={shortNames}
        />
        <div className="flex items-center gap-2 ml-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overlap:</span>
          {[
            { label: '< 5%',   cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
            { label: '5–20%',  cls: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
            { label: '20–40%', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
            { label: '40–60%', cls: 'bg-orange-100 border-orange-200 text-orange-800' },
            { label: '60%+',   cls: 'bg-red-100 border-red-200 text-red-800' },
          ].map(({ label, cls }) => (
            <span key={label} className={`text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>{label}</span>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">NAV-Weighted Overlap Heatmap</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">Based on latest available month per fund</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Each cell = % of both portfolios duplicated — click to see shared stocks.</p>
        <table className="border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-36" />
              {visibleFunds.map(f => (
                <th key={f.fund_id} className="w-28 pb-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight px-1" title={f.fund_name}>
                    {shortNames.get(f.fund_name)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-normal mt-0.5">{fmtMonth(f.report_month)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFunds.map(fRow => (
              <tr key={fRow.fund_id}>
                <td className="pr-3 py-0.5">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 text-right" title={fRow.fund_name}>
                    {shortNames.get(fRow.fund_name)}
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">{fmtMonth(fRow.report_month)}</div>
                  </div>
                </td>
                {visibleFunds.map(fCol => {
                  if (fRow.fund_id === fCol.fund_id) return (
                    <td key={fCol.fund_id} className="w-28 h-14">
                      <div className="w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      </div>
                    </td>
                  );
                  const pair = pairMap.get(`${fRow.fund_id}:${fCol.fund_id}`);
                  if (!pair) return <td key={fCol.fund_id} />;
                  const c = overlapColor(pair.overlap_pct);
                  const isSel = selected?.rowId === fRow.fund_id && selected?.colId === fCol.fund_id;
                  return (
                    <td key={fCol.fund_id} className="w-28 h-14">
                      <button
                        onClick={() => setSelected(isSel ? null : { pair, rowId: fRow.fund_id, colId: fCol.fund_id })}
                        className={`w-full h-12 rounded-xl border px-3 text-sm font-bold tabular-nums transition-all
                          ${c.bg} ${c.text} ${c.border}
                          ${isSel
                            ? `ring-2 ${c.ring} ring-offset-1 scale-105`
                            : 'hover:scale-105'
                          }`}
                        title={`${fRow.fund_name} × ${fCol.fund_name}\n${pair.overlap_pct}% overlap · ${pair.shared_count} stocks`}
                      >
                        {fmt(pair.overlap_pct)}%
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down */}
      {selected && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{selected.pair.fund_a_name}</span>
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    {fmtMonth(funds.find(f => f.fund_id === selected.pair.fund_a_id)?.report_month)}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{selected.pair.fund_b_name}</span>
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    {fmtMonth(funds.find(f => f.fund_id === selected.pair.fund_b_id)?.report_month)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${overlapColor(selected.pair.overlap_pct).bg} ${overlapColor(selected.pair.overlap_pct).text} ${overlapColor(selected.pair.overlap_pct).border}`}>
                  {fmt(selected.pair.overlap_pct)}% overlap
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{selected.pair.shared_count} shared stocks</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {fmt(selected.pair.overlap_pct_a)}% of {shortNames.get(selected.pair.fund_a_name)} ·{' '}
                  {fmt(selected.pair.overlap_pct_b)}% of {shortNames.get(selected.pair.fund_b_name)}
                </span>
              </div>
            </div>
            <button onClick={() => setSelected(null)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Three-column layout: unique A | shared | unique B */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">

            {/* Unique to Fund A */}
            <div>
              <div className="px-4 py-2.5 bg-indigo-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-700">Only in {shortNames.get(selected.pair.fund_a_name)}</p>
                <span className="text-xs text-indigo-400">{selected.pair.unique_a?.length ?? 0}</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {(selected.pair.unique_a ?? []).map(h => (
                  <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      {h.industry
                        ? <span className={`inline-flex items-center px-1 py-0.5 rounded border font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                        : <span />}
                      <span className="text-xs font-bold text-indigo-600 tabular-nums flex-shrink-0">{fmt(h.pct, 2)}%</span>
                    </div>
                  </div>
                ))}
                {(selected.pair.unique_a ?? []).length === 0 && (
                  <p className="px-4 py-6 text-xs text-slate-400 dark:text-slate-500 text-center">No unique stocks</p>
                )}
              </div>
            </div>

            {/* Shared */}
            <div>
              <div className="px-4 py-2.5 bg-violet-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-violet-700">Shared holdings</p>
                <span className="text-xs text-violet-400">{selected.pair.shared_count}</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {selected.pair.shared_holdings.map(h => (
                  <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      {h.industry
                        ? <span className={`inline-flex items-center px-1 py-0.5 rounded border font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                        : <span />}
                      <span className="text-xs tabular-nums flex-shrink-0">
                        <span className="text-indigo-500 font-semibold">{fmt(h.pct_a, 2)}%</span>
                        <span className="text-slate-300 mx-0.5">·</span>
                        <span className="text-emerald-500 font-semibold">{fmt(h.pct_b, 2)}%</span>
                      </span>
                    </div>
                  </div>
                ))}
                {selected.pair.shared_holdings.length === 0 && (
                  <p className="px-4 py-6 text-xs text-slate-400 dark:text-slate-500 text-center">No shared stocks</p>
                )}
              </div>
            </div>

            {/* Unique to Fund B */}
            <div>
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-700">Only in {shortNames.get(selected.pair.fund_b_name)}</p>
                <span className="text-xs text-emerald-400">{selected.pair.unique_b?.length ?? 0}</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {(selected.pair.unique_b ?? []).map(h => (
                  <div key={h.isin} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{h.stock_name}</p>
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      {h.industry
                        ? <span className={`inline-flex items-center px-1 py-0.5 rounded border font-medium ${industryBadgeClass(h.industry)}`} style={{ fontSize: 10 }}>{h.industry}</span>
                        : <span />}
                      <span className="text-xs font-bold text-emerald-600 tabular-nums flex-shrink-0">{fmt(h.pct, 2)}%</span>
                    </div>
                  </div>
                ))}
                {(selected.pair.unique_b ?? []).length === 0 && (
                  <p className="px-4 py-6 text-xs text-slate-400 dark:text-slate-500 text-center">No unique stocks</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Ranked pairs table */}
      {!selected && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">All Pairs — Ranked by Overlap</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fund A</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fund B</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Overlap %</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Shared stocks</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Weighted NAV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {[...visiblePairs].sort((a, b) => b.overlap_pct - a.overlap_pct).map((p, i) => {
                  const c = overlapColor(p.overlap_pct);
                  return (
                    <tr key={`${p.fund_a_id}-${p.fund_b_id}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                      onClick={() => setSelected({ pair: p, rowId: p.fund_a_id, colId: p.fund_b_id })}>
                      <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{shortNames.get(p.fund_a_name)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{fmtMonth(funds.find(f => f.fund_id === p.fund_a_id)?.report_month)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{shortNames.get(p.fund_b_name)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{fmtMonth(funds.find(f => f.fund_id === p.fund_b_id)?.report_month)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}>
                          {fmt(p.overlap_pct)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300">{p.shared_count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300">{fmt(p.weighted_overlap, 4)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── High Conviction — shared helpers ────────────────────────────────────────

function fundCountColor(n) {
  if (n >= 4) return '#f43f5e'; // rose-500
  return ['', '#60a5fa', '#a78bfa', '#fb923c'][n] ?? '#60a5fa';
}

// ─── High Conviction — Treemap ────────────────────────────────────────────────

function ConvictionTreemap({ filtered }) {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const treeData = filtered
    .filter(d => (d.total_market_value || 0) > 0)
    .map(d => ({
      name:        d.stock_name,
      size:        d.total_market_value,
      fund_count:  d.fund_count,
      avg_pct_nav: d.avg_pct_nav,
      industry:    d.industry,
      fund_allocs: d.fund_allocs || [],
    }));

  const selectedData = selected ? treeData.find(d => d.name === selected) : null;

  // Content renderer as a function so it closes over latest state
  function renderCell(props) {
    const { x, y, width, height, name, size, fund_count, avg_pct_nav } = props;
    if (!width || !height || width < 4 || height < 4) return null;

    const isHovered  = hovered === name;
    const isSelected = selected === name;
    const isDimmed   = hovered != null && !isHovered && !isSelected;

    const color    = fundCountColor(fund_count);
    const maxChars = Math.max(4, Math.floor(width / 7));
    const label    = name?.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;

    return (
      <g key={name} style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(name)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => setSelected(s => s === name ? null : name)}>
        <rect
          x={x + 1} y={y + 1} width={width - 2} height={height - 2}
          fill={color}
          fillOpacity={isDimmed ? 0.25 : (isHovered || isSelected) ? 1 : 0.82}
          rx={3}
          stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.6)'}
          strokeWidth={isSelected ? 3 : 1.5}
          style={{ transition: 'fill-opacity 0.12s' }}
        />
        {isSelected && (
          <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6}
            fill="none" rx={2} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        )}
        {width > 44 && height > 26 && (
          <text x={x + width / 2} y={y + height / 2 - (width > 64 && height > 42 ? 7 : 0)}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={Math.min(12, Math.floor(width / 6.5))} fontWeight={600}
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {label}
          </text>
        )}
        {width > 64 && height > 42 && (
          <text x={x + width / 2} y={y + height / 2 + 10}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={10} opacity={0.85}
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {fmt(avg_pct_nav)}%
          </text>
        )}
      </g>
    );
  }

  // Tooltip position — flip left if near right edge
  const containerW = containerRef.current?.offsetWidth || 600;
  const tipLeft = mousePos.x + 16 + 230 > containerW
    ? mousePos.x - 246
    : mousePos.x + 16;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conviction Treemap</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">Size = total market value · colour = fund count</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Larger = bigger combined position · hover to preview · click to pin breakdown</p>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {[1, 2, 3, 4].map(n => (
          <span key={n} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: fundCountColor(n) }} />
            {n === 4 ? '4+ funds' : `${n} fund${n > 1 ? 's' : ''}`}
          </span>
        ))}
      </div>

      {/* Chart + floating tooltip */}
      <div ref={containerRef} className="relative"
        onMouseMove={e => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}>
        <ResponsiveContainer width="100%" height={480}>
          <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3}
            stroke="white" content={(props) => renderCell(props)} />
        </ResponsiveContainer>

        {/* Floating tooltip */}
        {hovered && (() => {
          const d = treeData.find(t => t.name === hovered);
          if (!d) return null;
          return (
            <div className="pointer-events-none absolute z-50 rounded-xl shadow-2xl text-xs"
              style={{
                left: tipLeft,
                top: mousePos.y - 8,
                transform: 'translateY(-100%)',
                minWidth: 200,
                maxWidth: 230,
                background: 'rgba(15,23,42,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 12px',
              }}>
              <p className="font-semibold text-white text-[13px] leading-snug mb-0.5">{d.name}</p>
              <p className="text-slate-400 dark:text-slate-500 text-[11px] mb-2.5">{d.industry}</p>
              <div className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400 dark:text-slate-500">Avg allocation</span>
                  <span className="text-white font-medium">{fmt(d.avg_pct_nav)}%</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400 dark:text-slate-500">Funds holding</span>
                  <span className="font-medium" style={{ color: fundCountColor(d.fund_count) }}>
                    {d.fund_count} fund{d.fund_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {d.size > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400 dark:text-slate-500">Market value</span>
                    <span className="text-white font-medium">₹{fmt(d.size)} L</span>
                  </div>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 mt-2.5 text-[10px] border-t border-slate-700 pt-2">
                Click to pin fund-by-fund breakdown ↓
              </p>
            </div>
          );
        })()}
      </div>

      {/* Pinned detail panel */}
      {selectedData && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{selectedData.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedData.industry}</p>
            </div>
            <button onClick={() => setSelected(null)}
              className="ml-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 p-1 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 border-b border-slate-200 dark:border-slate-700">
            {[
              { label: 'Avg Alloc',     value: `${fmt(selectedData.avg_pct_nav)}%` },
              { label: 'Funds Holding', value: `${selectedData.fund_count}`,
                color: fundCountColor(selectedData.fund_count) },
              { label: 'Market Value',  value: `₹${fmt(selectedData.size)} L` },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-base font-bold mt-0.5" style={{ color: color || '#1e293b' }}>{value}</p>
              </div>
            ))}
          </div>

          {selectedData.fund_allocs.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5">Fund-by-fund allocation</p>
              {(() => {
                const maxPct = Math.max(...selectedData.fund_allocs.map(x => x.pct), 0.01);
                return (
                  <div className="space-y-2 font-sans">
                    {[...selectedData.fund_allocs]
                      .sort((a, b) => b.pct - a.pct)
                      .map(a => (
                        <div key={a.name} className="flex items-center gap-2.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex-none w-44"
                            title={a.name}>
                            {a.name}
                          </span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{
                                width: `${(a.pct / maxPct) * 100}%`,
                                backgroundColor: fundCountColor(selectedData.fund_count),
                                transition: 'width 0.3s ease',
                              }} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums flex-none w-10 text-right">
                            {fmt(a.pct)}%
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── High Conviction — Lollipop ───────────────────────────────────────────────

function ConvictionLollipop({ filtered }) {
  const [sortBy, setSortBy] = useState('pct');
  const TOP = 50;

  const sorted = [...filtered]
    .sort((a, b) => {
      if (sortBy === 'funds') return b.fund_count - a.fund_count || b.avg_pct_nav - a.avg_pct_nav;
      if (sortBy === 'value') return (b.total_market_value || 0) - (a.total_market_value || 0);
      return b.avg_pct_nav - a.avg_pct_nav;
    })
    .slice(0, TOP);

  const maxPct = Math.max(...sorted.map(d => d.avg_pct_nav), 1);

  const PAD_L  = 172;
  const PAD_R  = 52;
  const PAD_T  = 8;
  const ROW_H  = 28;
  const INNER_W = 520;
  const SVG_W  = PAD_L + INNER_W + PAD_R;
  const SVG_H  = PAD_T + sorted.length * ROW_H + 8;

  const xOf = pct => (pct / maxPct) * INNER_W;
  const yOf = i   => PAD_T + i * ROW_H + ROW_H / 2;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conviction Lollipop</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">Sort:</span>
          {[['pct', 'Avg %'], ['funds', 'Funds'], ['value', 'Mkt value']].map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)}
              className={`px-2 py-0.5 text-xs font-semibold rounded-md border transition-colors ${
                sortBy === k ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300'
              }`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Bar = avg allocation % · dot colour = # of funds holding · top {TOP}</p>
      <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block' }}>
          {/* Max line */}
          <line x1={PAD_L + INNER_W} y1={PAD_T} x2={PAD_L + INNER_W} y2={SVG_H}
            stroke="#f1f5f9" strokeWidth={1} />
          {sorted.map((d, i) => {
            const color = fundCountColor(d.fund_count);
            const barW  = xOf(d.avg_pct_nav);
            const cy    = yOf(i);
            const label = d.stock_name.length > 22 ? d.stock_name.slice(0, 20) + '…' : d.stock_name;
            return (
              <g key={d.isin}>
                {/* Alternating row bg */}
                <rect x={0} y={PAD_T + i * ROW_H} width={SVG_W} height={ROW_H}
                  fill={i % 2 === 0 ? 'transparent' : '#fafafa'} />
                {/* Stock name */}
                <text x={PAD_L - 10} y={cy + 4} textAnchor="end"
                  fontSize={11} fontWeight={500} fill="#475569" style={{ cursor: 'default' }}>
                  {label}
                </text>
                {/* Track */}
                <line x1={PAD_L} y1={cy} x2={PAD_L + INNER_W} y2={cy}
                  stroke="#f1f5f9" strokeWidth={1} />
                {/* Bar */}
                <line x1={PAD_L} y1={cy} x2={PAD_L + barW} y2={cy}
                  stroke={color} strokeWidth={2.5} strokeOpacity={0.55} strokeLinecap="round" />
                {/* Dot */}
                <circle cx={PAD_L + barW} cy={cy} r={6}
                  fill={color} stroke="white" strokeWidth={2}>
                  <title>{d.stock_name} · {d.fund_count} fund{d.fund_count !== 1 ? 's' : ''} · {fmt(d.avg_pct_nav)}%</title>
                </circle>
                {/* Value label */}
                <text x={PAD_L + barW + 12} y={cy + 4}
                  fontSize={10} fontWeight={600} fill={color}>
                  {fmt(d.avg_pct_nav)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {[1, 2, 3, 4].map(n => (
          <span key={n} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: fundCountColor(n) }} />
            {n === 4 ? '4+ funds' : `${n} fund${n > 1 ? 's' : ''}`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── High Conviction — Stock × Fund Heatmap ───────────────────────────────────

function ConvictionHeatmap({ filtered }) {
  const fundNames = [...new Set(filtered.flatMap(d => (d.fund_allocs || []).map(a => a.name)))].sort();
  const maxPct    = Math.max(...filtered.flatMap(d => (d.fund_allocs || []).map(a => a.pct)), 1);

  function cellStyle(pct) {
    if (!pct) return { backgroundColor: '#f8fafc', color: '#cbd5e1' };
    const t = Math.pow(pct / maxPct, 0.6);
    const r = Math.round(248 + t * (109 - 248));
    const g = Math.round(250 + t * ( 40 - 250));
    const b = Math.round(252 + t * (217 - 252));
    return { backgroundColor: `rgb(${r},${g},${b})`, color: t > 0.55 ? '#fff' : '#3b0764' };
  }

  const shortFundName = fn => fn.split(' ').slice(0, 2).join(' ');

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6 overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Stock × Fund Allocation Heatmap</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Each cell = that fund's exact allocation % · empty = not held</p>
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="w-36 pb-2" />
            {fundNames.map(fn => (
              <th key={fn} className="pb-2 min-w-[68px] text-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap" title={fn}>
                  {shortFundName(fn)}
                </span>
              </th>
            ))}
            <th className="pb-2 min-w-[56px] text-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Avg %</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(d => {
            const allocMap = new Map((d.fund_allocs || []).map(a => [a.name, a.pct]));
            return (
              <tr key={d.isin}>
                <td className="pr-2 py-0.5 text-right max-w-[140px]">
                  <span className="font-medium text-slate-700 dark:text-slate-300 block truncate" title={d.stock_name}>
                    {d.stock_name.length > 19 ? d.stock_name.slice(0, 17) + '…' : d.stock_name}
                  </span>
                </td>
                {fundNames.map(fn => {
                  const pct = allocMap.get(fn) ?? 0;
                  return (
                    <td key={fn} className="min-w-[68px]">
                      <div className="rounded-md px-1.5 py-1.5 text-center tabular-nums font-semibold transition-transform hover:scale-105"
                        style={cellStyle(pct)}
                        title={`${d.stock_name} · ${fn}: ${fmt(pct, 4)}%`}>
                        {pct > 0 ? `${fmt(pct)}%` : '—'}
                      </div>
                    </td>
                  );
                })}
                <td className="min-w-[56px]">
                  <div className="rounded-md px-1.5 py-1.5 text-center tabular-nums font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {fmt(d.avg_pct_nav)}%
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── High Conviction — Connected Dot Plot ────────────────────────────────────

function ConvictionConnectedDot({ filtered }) {
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(700);
  const [hovered,    setHovered]    = useState(null); // { fund, stock, pct, x, y }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setChartWidth(el.offsetWidth);
    const ro = new ResizeObserver(entries => setChartWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const multiHeld    = filtered.filter(d => d.fund_count >= 2 && (d.fund_allocs?.length ?? 0) >= 2);
  const allFundNames = [...new Set(multiHeld.flatMap(d => (d.fund_allocs || []).map(a => a.name)))].sort();
  const fundColorMap = new Map(allFundNames.map((fn, i) => [fn, SECTOR_COLORS[i % SECTOR_COLORS.length]]));
  const maxPct       = Math.max(...multiHeld.flatMap(d => (d.fund_allocs || []).map(a => a.pct)), 1);

  const PAD_L   = 172;
  const PAD_T   = 8;
  const PAD_B   = 28;
  const PAD_R   = 16;
  const ROW_H   = 34;
  const INNER_W = Math.max(chartWidth - PAD_L - PAD_R, 200);
  const SVG_W   = chartWidth;
  const SVG_H   = PAD_T + multiHeld.length * ROW_H + PAD_B;

  const xOf = pct => PAD_L + (pct / maxPct) * INNER_W;
  const yOf = i   => PAD_T + i * ROW_H + ROW_H / 2;

  const tickStep = maxPct <= 5 ? 1 : maxPct <= 15 ? 2 : maxPct <= 30 ? 5 : 10;
  const ticks = [];
  for (let v = 0; v <= Math.ceil(maxPct); v += tickStep) ticks.push(v);

  // Tooltip sizing
  const TIP_W = 220;
  const TIP_H = 68;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conviction Spread</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">Only stocks held by 2+ funds</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        Each row is one stock. Every <span className="font-medium">colored dot</span> is a fund's % NAV allocation.
        The <span className="font-medium">grey line</span> spans the range between the lowest and highest believer.
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        <span className="text-emerald-600 font-medium">Short line</span> = consensus pick (all funds hold similar %) ·
        <span className="text-orange-500 font-medium"> Long line</span> = split conviction (one fund is far more bullish than others)
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        {allFundNames.map(fn => (
          <span key={fn} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400" title={fn}>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fundColorMap.get(fn) }} />
            <span className="truncate max-w-[130px]">{fn.split(' ').slice(0, 3).join(' ')}</span>
          </span>
        ))}
      </div>

      <div ref={containerRef} className="relative">
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block' }}>
          {/* Vertical grid lines */}
          {ticks.map(v => (
            <line key={v} x1={xOf(v)} y1={PAD_T} x2={xOf(v)} y2={PAD_T + multiHeld.length * ROW_H}
              stroke="#f1f5f9" strokeWidth={1} />
          ))}

          {multiHeld.map((d, i) => {
            const cy     = yOf(i);
            const allocs = d.fund_allocs || [];
            const pcts   = allocs.map(a => a.pct);
            const minP   = Math.min(...pcts);
            const maxP   = Math.max(...pcts);
            return (
              <g key={d.isin}>
                {/* Zebra row */}
                <rect x={0} y={PAD_T + i * ROW_H} width={SVG_W} height={ROW_H}
                  fill={i % 2 === 0 ? 'transparent' : '#fafafa'} />
                {/* Stock name */}
                <text x={PAD_L - 10} y={cy + 4} textAnchor="end"
                  fontSize={11} fontWeight={500} fill="#475569">
                  {d.stock_name.length > 22 ? d.stock_name.slice(0, 20) + '…' : d.stock_name}
                </text>
                {/* Connecting range line */}
                <line x1={xOf(minP)} y1={cy} x2={xOf(maxP)} y2={cy}
                  stroke="#cbd5e1" strokeWidth={2.5} strokeLinecap="round" />
                {/* One dot per fund */}
                {allocs.map(a => {
                  const color = fundColorMap.get(a.name) ?? '#94a3b8';
                  const isHov = hovered?.fund === a.name && hovered?.isin === d.isin;
                  return (
                    <circle key={a.name}
                      cx={xOf(a.pct)} cy={cy}
                      r={isHov ? 9 : 7}
                      fill={color} stroke="white" strokeWidth={isHov ? 2.5 : 2}
                      style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                      onMouseEnter={e => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) setHovered({ fund: a.name, isin: d.isin, stock: d.stock_name, pct: a.pct, color, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onMouseMove={e => setHovered(h => h ? { ...h, x: e.clientX, y: e.clientY } : h)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis tick labels */}
          {ticks.map(v => (
            <text key={v} x={xOf(v)} y={SVG_H - 6}
              textAnchor="middle" fontSize={10} fill="#94a3b8">{v}%</text>
          ))}
        </svg>

        {/* Floating tooltip */}
        {hovered && (() => {
          const tipX  = hovered.x + 14 + TIP_W > window.innerWidth ? hovered.x - TIP_W - 14 : hovered.x + 14;
          const tipY  = hovered.y + 20 + TIP_H > window.innerHeight ? hovered.y - TIP_H - 8 : hovered.y + 14;
          return (
            <div className="pointer-events-none fixed z-50 rounded-xl shadow-2xl text-xs"
              style={{ left: tipX, top: tipY, minWidth: TIP_W,
                background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 13px' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hovered.color }} />
                <span className="font-semibold text-white text-[12px] leading-snug truncate">{hovered.fund}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{hovered.stock}</span>
                <span className="text-white font-bold tabular-nums">{fmt(hovered.pct)}% NAV</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── High Conviction tab ──────────────────────────────────────────────────────

function BubbleDot(props) {
  const { cx, cy, payload, maxValue } = props;
  if (!cx || !cy) return null;
  const color = getIndustryColor(payload.industry).hex;
  const r = 8 + 32 * Math.sqrt((payload.total_market_value || 0) / (maxValue || 1));
  return (
    <circle cx={cx} cy={cy} r={Math.min(r, 48)}
      fill={color} fillOpacity={0.75} stroke="white" strokeWidth={1.5} />
  );
}

function BubbleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = getIndustryColor(d.industry).hex;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 text-sm max-w-[260px] z-50">
      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
        <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{d.stock_name}</p>
        <CapBadge cap={d.market_cap_cat} />
      </div>
      {d.industry && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium mb-2 ${industryBadgeClass(d.industry)}`}>
          {d.industry}
        </span>
      )}
      <div className="space-y-1 mt-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Funds holding</span>
          <span className="font-bold" style={{ color }}>{d.fund_count}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Avg allocation</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">{fmt(d.avg_pct_nav)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Total value (L)</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">₹{fmt(d.total_market_value)}</span>
        </div>
      </div>
      {d.fund_names?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Held by:</p>
          {d.fund_names.map((fn, i) => (
            <p key={i} className="text-xs text-slate-600 dark:text-slate-400 truncate" title={fn}>• {fn}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function HighConviction() {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [minFunds, setMinFunds]   = useState(1);
  const [chartType, setChartType] = useState('bubble');

  useEffect(() => {
    getCrossFundAnalysis()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered  = data.filter(d => d.fund_count >= minFunds);
  const maxFunds  = Math.max(...data.map(d => d.fund_count), 1);
  const maxValue  = Math.max(...filtered.map(d => d.total_market_value || 0), 1);
  const multiHeld = data.filter(d => d.fund_count >= 2).length;
  const highConv  = data.filter(d => d.fund_count === maxFunds);

  const CustomShape = useCallback((props) => <BubbleDot {...props} maxValue={maxValue} />, [maxValue]);

  const chartTypes = [
    { id: 'bubble',    label: 'Bubble' },
    { id: 'treemap',   label: 'Treemap' },
    { id: 'lollipop',  label: 'Lollipop' },
    { id: 'connected', label: 'Conviction Spread' },
  ];

  return (
    <div>
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
            label="Unique Stocks" value={data.length.toLocaleString()} />
          <StatCard icon={<Layers className="w-4 h-4 text-violet-500" />}
            label="Held by 2+ Funds" value={multiHeld.toLocaleString()} />
          <StatCard icon={<Award className="w-4 h-4 text-amber-500" />}
            label="Max Fund Overlap" value={`${maxFunds} fund${maxFunds !== 1 ? 's' : ''}`}
            sub={highConv.slice(0, 2).map(d => d.stock_name).join(', ')} />
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>}
      {loading && <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>}

      {!loading && !error && (
        <>
          {/* Controls */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                <Filter className="w-4 h-4" /> Min funds:
              </span>
              {[1, 2, 3, 4, 5].filter(n => n <= maxFunds).map(n => (
                <button key={n} onClick={() => setMinFunds(n)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                    minFunds === n
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:text-violet-600'
                  }`}>
                  {n}+ {n === 1 ? '(all)' : `fund${n > 1 ? 's' : ''}`}
                </button>
              ))}
              {/* Chart type pill toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1 ml-auto">
                {chartTypes.map(ct => (
                  <button key={ct.id} onClick={() => setChartType(ct.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      chartType === ct.id
                        ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                    }`}>{ct.label}</button>
                ))}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{filtered.length} stock{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Chart */}
          {chartType === 'bubble' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conviction Bubble Chart</h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">Bubble size = total market value (₹ L)</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">X = number of funds holding · Y = average allocation %</p>
              <ResponsiveContainer width="100%" height={480}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="fund_count" type="number" name="Funds"
                    label={{ value: 'Number of funds holding', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickCount={maxFunds + 1} domain={[0.5, maxFunds + 0.5]}
                    axisLine={false} tickLine={false} />
                  <YAxis dataKey="avg_pct_nav" type="number" name="Avg % NAV"
                    tickFormatter={v => `${v}%`}
                    label={{ value: 'Avg allocation %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                  <ZAxis dataKey="total_market_value" range={[0, 1]} />
                  <Tooltip content={<BubbleTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  {maxFunds >= 2 && (
                    <ReferenceLine x={1.5} stroke="#e2e8f0" strokeDasharray="4 4"
                      label={{ value: 'High conviction →', position: 'insideTopRight', fontSize: 10, fill: '#c4b5fd' }} />
                  )}
                  <Scatter data={filtered} shape={CustomShape} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartType === 'treemap'   && <ConvictionTreemap     filtered={filtered} />}
          {chartType === 'lollipop'  && <ConvictionLollipop    filtered={filtered} />}
          {chartType === 'connected' && <ConvictionConnectedDot filtered={filtered} />}

          {/* Detail table — always shown below the chart */}
          {filtered.filter(d => d.fund_count >= 2).length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                Multi-Fund Holdings — {filtered.filter(d => d.fund_count >= 2).length} stocks
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Stock</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Industry</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Funds</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Avg Alloc %</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Value (L)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Held by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filtered.filter(d => d.fund_count >= 2).map(d => {
                      const color = getIndustryColor(d.industry).hex;
                      return (
                        <tr key={d.isin} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-slate-800 dark:text-slate-200">{d.stock_name}</p>
                              <CapBadge cap={d.market_cap_cat} />
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{d.isin}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            {d.industry
                              ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(d.industry)}`}>{d.industry}</span>
                              : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold"
                              style={{ backgroundColor: fundCountColor(d.fund_count) }}>
                              {d.fund_count}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color }}>{fmt(d.avg_pct_nav)}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">₹{fmt(d.total_market_value)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {d.fund_names.map((fn, i) => (
                                <span key={i} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={fn}>
                                  {fn.split(' ').slice(0, 3).join(' ')}…
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── All-Funds New Entries ────────────────────────────────────────────────────

function NewEntries() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [minFunds, setMinFunds] = useState(1);

  useEffect(() => {
    getAllFundsNewEntries()
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data
      .filter(r => r.fund_count >= minFunds)
      .map(r => ({
        ...r,
        funds: (r.fund_details || '').split(';;').filter(Boolean).map(s => {
          const [name, pct] = s.split('|');
          return { name, pct: parseFloat(pct) };
        }),
      }));
  }, [data, minFunds]);

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;

  const multiRows = rows.filter(r => r.fund_count >= 2);
  const soloRows  = rows.filter(r => r.fund_count === 1);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
          label="New entries this month" value={data?.length ?? 0} sub="across all funds" />
        <StatCard icon={<span className="text-base">🤝</span>}
          label="Multi-fund new entries" value={multiRows.length} sub="2+ funds entered simultaneously" />
        <StatCard icon={<span className="text-base">🌱</span>}
          label="Solo new entries" value={soloRows.length} sub="only 1 fund entered" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Show entries by min funds:</span>
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => setMinFunds(n)}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${minFunds === n ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}>
            {n}+
          </button>
        ))}
      </div>

      {rows.length === 0
        ? <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No new entries found for this filter</div>
        : (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Industry</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Funds entered</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fund · Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(r => (
                  <tr key={r.isin} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{r.stock_name}</p>
                        <CapBadge cap={r.market_cap_cat} />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{r.isin}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${industryBadgeClass(r.industry)}`}>{r.industry || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        r.fund_count >= 3 ? 'bg-emerald-100 text-emerald-700' :
                        r.fund_count === 2 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>{r.fund_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.funds.map(f => (
                          <span key={f.name} className="text-xs bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-0.5 text-slate-600 dark:text-slate-400" title={f.name}>
                            {f.name.split(' ').slice(0, 3).join(' ')} · <span className="font-semibold">{fmt(f.pct)}%</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ─── Fund Churn / Turnover ────────────────────────────────────────────────────

function FundChurn({ allFunds }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [selected, setSelected] = useState(new Set()); // selected fund_ids

  useEffect(() => {
    getFundChurnRates()
      .then(d => { setData(d); setSelected(new Set([...new Set(d.map(r => r.fund_id))].slice(0, 5))); })
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const { funds, byFund, allMonths, avgByFund } = useMemo(() => {
    if (!data?.length) return { funds: [], byFund: new Map(), allMonths: [], avgByFund: new Map() };
    const funds     = [...new Map(data.map(r => [r.fund_id, r.fund_name])).entries()].map(([id, name]) => ({ id, name }));
    const byFund    = new Map();
    for (const r of data) {
      if (!byFund.has(r.fund_id)) byFund.set(r.fund_id, new Map());
      byFund.get(r.fund_id).set(r.report_month, r);
    }
    const allMonths = [...new Set(data.map(r => r.report_month))].sort();
    const avgByFund = new Map(funds.map(f => {
      const rows = byFund.get(f.id);
      const vals = rows ? [...rows.values()].map(r => r.turnover_pct).filter(v => v != null) : [];
      return [f.id, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0];
    }));
    return { funds, byFund, allMonths, avgByFund };
  }, [data]);

  const shortNames = useMemo(() => buildShortNames(funds.map(f => f.name)), [funds]);
  const colors     = useMemo(() => new Map(funds.map((f, i) => [f.id, TRACKER_COLORS[i % TRACKER_COLORS.length]])), [funds]);

  const chartData = useMemo(() =>
    allMonths.map(m => {
      const obj = { month: m };
      for (const f of funds) if (selected.has(f.id)) obj[`f${f.id}`] = byFund.get(f.id)?.get(m)?.turnover_pct ?? null;
      return obj;
    }), [allMonths, funds, byFund, selected]);

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;

  const ChurnTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pts = payload.filter(p => p.value != null).sort((a, b) => b.value - a.value);
    return (
      <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
        <p className="font-semibold mb-1.5 text-slate-300">{fmtMonth(label)}</p>
        {pts.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-300 truncate" style={{ maxWidth: 140 }}>{p.name}</span>
            </div>
            <span className="font-bold tabular-nums">{fmt(p.value, 1)}%</span>
          </div>
        ))}
      </div>
    );
  };

  // Sorted by avg turnover desc for the bar chart
  const sortedFunds = [...funds].sort((a, b) => (avgByFund.get(b.id) ?? 0) - (avgByFund.get(a.id) ?? 0));
  const maxAvg = Math.max(...sortedFunds.map(f => avgByFund.get(f.id) ?? 0), 1);

  const visibleFunds = sortedFunds.filter(f => selected.has(f.id));

  return (
    <div className="space-y-5">
      {/* Fund picker */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Select Funds to Compare</h2>
        <ConcentrationFundPicker
          funds={sortedFunds}
          selected={selected}
          setSelected={setSelected}
          colors={colors}
          shortNames={shortNames}
        />
        {selected.size === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">No funds selected — search above to add funds to the chart.</p>
        )}
      </div>

      {/* Trend chart */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monthly Turnover Rate</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">% of holdings that changed vs previous month · higher = more active management</p>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{selected.size} fund{selected.size !== 1 ? 's' : ''} shown</span>
        </div>
        {selected.size === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-16">Select funds above to see the chart</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(allMonths.length / 8))} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChurnTooltip />} />
              {funds.filter(f => selected.has(f.id)).map(f => (
                <Line key={f.id} dataKey={`f${f.id}`} name={shortNames.get(f.name) ?? f.name}
                  stroke={colors.get(f.id)} strokeWidth={2} dot={false} connectNulls={false}
                  activeDot={{ r: 4, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Average turnover bars — only selected funds */}
      {visibleFunds.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Average Turnover by Fund</h2>
          <div className="space-y-2">
            {visibleFunds.map(f => {
              const avg   = avgByFund.get(f.id) ?? 0;
              const color = colors.get(f.id);
              return (
                <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-44 truncate" title={f.name}>{shortNames.get(f.name) ?? f.name}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${(avg / maxAvg) * 100}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-14 text-right text-slate-700 dark:text-slate-300">{fmt(avg, 1)}% avg</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sector Rotation Calendar ─────────────────────────────────────────────────

function SectorRotationCalendar() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [mode,    setMode]    = useState('absolute'); // 'absolute' | 'delta'

  useEffect(() => {
    getSectorRotationCalendar()
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const { months, sectors, grid } = useMemo(() => {
    if (!data?.length) return { months: [], sectors: [], grid: new Map() };
    const months  = [...new Set(data.map(r => r.report_month))].sort();
    const sectors = [...new Set(data.map(r => r.industry))].sort();
    // grid: sector → month → avg_pct
    const grid = new Map();
    for (const r of data) {
      if (!grid.has(r.industry)) grid.set(r.industry, new Map());
      grid.get(r.industry).set(r.report_month, r.avg_pct);
    }
    return { months, sectors, grid };
  }, [data]);

  // For delta mode, compute change from previous month
  const getValue = (sector, month, i) => {
    const abs = grid.get(sector)?.get(month) ?? null;
    if (mode === 'absolute' || i === 0) return abs;
    const prev = grid.get(sector)?.get(months[i - 1]) ?? null;
    if (abs == null || prev == null) return null;
    return +(abs - prev).toFixed(2);
  };

  const allValues = useMemo(() => {
    if (!months.length) return [];
    return sectors.flatMap((s, _) => months.map((m, i) => getValue(s, m, i))).filter(v => v != null);
  }, [sectors, months, grid, mode]);

  const maxAbs  = Math.max(...allValues.map(Math.abs), 0.01);

  function cellColor(val) {
    if (val == null) return { bg: '#f8fafc', text: '#94a3b8' };
    if (mode === 'absolute') {
      const t = Math.min(val / maxAbs, 1);
      const r = Math.round(239 - t * (239 - 99));
      const g = Math.round(246 - t * (246 - 102));
      const b = Math.round(255 - t * (255 - 241));
      return { bg: `rgb(${r},${g},${b})`, text: t > 0.6 ? '#3730a3' : '#475569' };
    } else {
      if (val > 0) {
        const t = Math.min(val / maxAbs, 1);
        return { bg: `rgba(16,185,129,${0.1 + t * 0.7})`, text: '#065f46' };
      } else {
        const t = Math.min(-val / maxAbs, 1);
        return { bg: `rgba(239,68,68,${0.1 + t * 0.7})`, text: '#7f1d1d' };
      }
    }
  }

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;

  // Show last 18 months to keep table manageable
  const visMonths = months.slice(-18);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Rotation Calendar</h2>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {[{ id: 'absolute', label: 'Allocation %' }, { id: 'delta', label: 'Month-on-Month Δ' }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${mode === m.id ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        {mode === 'absolute' ? 'Average % NAV allocated to each sector across all funds' : 'Change in avg allocation vs previous month · green = funds added to sector · red = reduced'}
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse" style={{ minWidth: visMonths.length * 52 + 180 }}>
          <thead>
            <tr>
              <th className="text-left pr-3 pb-2 text-slate-500 dark:text-slate-400 font-semibold sticky left-0 bg-white dark:bg-slate-800 z-10 w-44">Sector</th>
              {visMonths.map(m => (
                <th key={m} className="pb-2 text-center text-slate-400 dark:text-slate-500 font-medium w-12"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 60 }}>
                  {fmtMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map(sector => (
              <tr key={sector} className="border-t border-slate-50">
                <td className="pr-3 py-1 text-slate-600 dark:text-slate-400 font-medium sticky left-0 bg-white dark:bg-slate-800 z-10 truncate max-w-[170px]" title={sector}>{sector}</td>
                {visMonths.map((m, i) => {
                  const val = getValue(sector, m, months.indexOf(m));
                  const { bg, text } = cellColor(val);
                  return (
                    <td key={m} className="py-0.5 px-0.5">
                      <div className="w-11 h-8 rounded flex items-center justify-center font-medium tabular-nums"
                        style={{ backgroundColor: bg, color: text }}
                        title={`${sector} · ${fmtMonth(m)}: ${val != null ? fmt(val, 2) + '%' : '—'}`}>
                        {val != null ? (mode === 'delta' && val > 0 ? '+' : '') + fmt(val, 1) : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stock Discovery Chain ────────────────────────────────────────────────────

function StockDiscovery() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [minGrowth, setMinGrowth] = useState(3); // min peak_funds to show
  const [sortBy,    setSortBy]    = useState('peak'); // 'peak' | 'velocity' | 'recent'

  useEffect(() => {
    getStockDiscoveryChain()
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const stocks = useMemo(() => {
    if (!data?.length) return [];
    // Group by isin
    const byIsin = new Map();
    for (const r of data) {
      if (!byIsin.has(r.isin)) byIsin.set(r.isin, { isin: r.isin, stock_name: r.stock_name, industry: r.industry, peak_funds: r.peak_funds, first_month: r.first_month, timeline: [] });
      byIsin.get(r.isin).timeline.push({ month: r.report_month, fund_count: r.fund_count, avg_pct: r.avg_pct });
    }
    return [...byIsin.values()]
      .filter(s => s.peak_funds >= minGrowth)
      .map(s => {
        const tl = s.timeline.sort((a, b) => a.month.localeCompare(b.month));
        const first1 = tl.find(t => t.fund_count >= 1)?.month;
        const firstPeak = tl.find(t => t.fund_count === s.peak_funds)?.month;
        const velocity = first1 && firstPeak
          ? (() => { const [y1, m1] = first1.split('-').map(Number); const [y2, m2] = firstPeak.split('-').map(Number); return (y2 * 12 + m2) - (y1 * 12 + m1); })()
          : 999;
        const latestFunds = tl[tl.length - 1]?.fund_count ?? 0;
        return { ...s, tl, velocity, latestFunds };
      })
      .sort((a, b) => {
        if (sortBy === 'peak')     return b.peak_funds - a.peak_funds;
        if (sortBy === 'velocity') return a.velocity - b.velocity;
        return b.tl[b.tl.length - 1]?.month.localeCompare(a.tl[a.tl.length - 1]?.month ?? '') ?? 0;
      });
  }, [data, minGrowth, sortBy]);

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;

  const allMonths = data ? [...new Set(data.map(r => r.report_month))].sort() : [];
  const visMonths = allMonths.slice(-18);

  function dotColor(count, peak) {
    if (!count) return '#f1f5f9';
    const t = count / peak;
    if (t >= 0.8) return '#6366f1';
    if (t >= 0.5) return '#a78bfa';
    if (t >= 0.2) return '#c4b5fd';
    return '#ede9fe';
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Min peak funds:</span>
          {[2, 3, 5, 8].map(n => (
            <button key={n} onClick={() => setMinGrowth(n)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${minGrowth === n ? 'bg-violet-100 text-violet-700 font-semibold' : 'hover:bg-slate-100'}`}>{n}+</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-auto">
          <span className="font-medium">Sort:</span>
          {[{ id: 'peak', label: 'Peak funds' }, { id: 'velocity', label: 'Fastest adoption' }, { id: 'recent', label: 'Recent' }].map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${sortBy === s.id ? 'bg-violet-100 text-violet-700 font-semibold' : 'hover:bg-slate-100'}`}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: visMonths.length * 36 + 340 }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 w-48">Stock</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-16">Peak</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-16">Now</th>
                {visMonths.map(m => (
                  <th key={m} className="text-center py-2 font-medium text-slate-400 dark:text-slate-500 w-9"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 52 }}>
                    {fmtMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stocks.slice(0, 60).map(s => {
                const monthMap = new Map(s.tl.map(t => [t.month, t.fund_count]));
                return (
                  <tr key={s.isin} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-2 sticky left-0 bg-white dark:bg-slate-800 z-10">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-[180px]">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={s.stock_name}>{s.stock_name}</p>
                        <CapBadge cap={s.market_cap_cat} />
                      </div>
                      <p className="text-slate-400 dark:text-slate-500 truncate">{s.industry}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="font-bold text-violet-700">{s.peak_funds}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold ${s.latestFunds > 0 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-300'}`}>{s.latestFunds || '—'}</span>
                    </td>
                    {visMonths.map(m => {
                      const cnt = monthMap.get(m) ?? 0;
                      return (
                        <td key={m} className="py-1.5 px-0.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold mx-auto"
                            style={{ backgroundColor: dotColor(cnt, s.peak_funds), color: cnt >= s.peak_funds * 0.8 ? 'white' : '#6d28d9' }}
                            title={`${s.stock_name} · ${fmtMonth(m)}: ${cnt} fund${cnt !== 1 ? 's' : ''}`}>
                            {cnt || ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span>Cell = # funds holding · darker = closer to peak adoption</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {[1, 2, 3, 4].map(n => <div key={n} className="w-5 h-5 rounded flex items-center justify-center text-white font-bold" style={{ backgroundColor: dotColor(n, 4) }}>{n}</div>)}
            <span className="ml-1">funds</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Concentration Fund Picker (searchable multiselect with pills) ─────────────

function ConcentrationFundPicker({ funds, selected, setSelected, colors, shortNames }) {
  const [query,     setQuery]   = useState('');
  const [dropOpen,  setDropOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? funds.filter(f => f.name.toLowerCase().includes(q) || (shortNames.get(f.name) ?? '').toLowerCase().includes(q))
      : funds;
    return list.slice(0, 12);
  }, [funds, query, shortNames]);

  const selectedFunds = useMemo(() => funds.filter(f => selected.has(f.id)), [funds, selected]);

  function toggle(f) {
    setSelected(s => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; });
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input box with pills */}
      <div
        className="flex flex-wrap gap-1.5 p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 min-h-[42px] cursor-text focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400 transition-all"
        onClick={() => { inputRef.current?.focus(); setDropOpen(true); }}
      >
        {selectedFunds.map(f => (
          <span key={f.id}
            className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200 select-none">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors.get(f.id) }} />
            {shortNames.get(f.name) ?? f.name}
            <button
              onMouseDown={e => { e.stopPropagation(); e.preventDefault(); toggle(f); }}
              className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-violet-300 text-violet-500 hover:text-violet-800 transition-colors">
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
          onFocus={() => setDropOpen(true)}
          placeholder={selectedFunds.length === 0 ? 'Search and select funds…' : ''}
          className="flex-1 min-w-[140px] outline-none text-xs text-slate-700 dark:text-slate-300 bg-transparent py-0.5 px-1 placeholder:text-slate-400 dark:text-slate-500"
        />
      </div>

      {/* Dropdown */}
      {dropOpen && results.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {results.map(f => {
            const on = selected.has(f.id);
            return (
              <div key={f.id}
                onMouseDown={e => { e.preventDefault(); toggle(f); setQuery(''); }}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors ${on ? 'bg-violet-50' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.get(f.id) }} />
                <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                {on && <Check className="w-3 h-3 text-violet-600 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Concentration Score ──────────────────────────────────────────────────────

function ConcentrationScore({ allFunds }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [metric,   setMetric]   = useState('hhi'); // 'hhi' | 'top_holding_pct' | 'holding_count'

  useEffect(() => {
    getConcentrationScores()
      .then(d => { setData(d); setSelected(new Set([...new Set(d.map(r => r.fund_id))].slice(0, 5))); })
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const { funds, byFund, allMonths, latestByFund } = useMemo(() => {
    if (!data?.length) return { funds: [], byFund: new Map(), allMonths: [], latestByFund: new Map() };
    const funds     = [...new Map(data.map(r => [r.fund_id, r.fund_name])).entries()].map(([id, name]) => ({ id, name }));
    const byFund    = new Map();
    for (const r of data) {
      if (!byFund.has(r.fund_id)) byFund.set(r.fund_id, new Map());
      byFund.get(r.fund_id).set(r.report_month, r);
    }
    const allMonths = [...new Set(data.map(r => r.report_month))].sort();
    const latest = allMonths[allMonths.length - 1];
    const latestByFund = new Map(funds.map(f => [f.id, byFund.get(f.id)?.get(latest)]));
    return { funds, byFund, allMonths, latestByFund };
  }, [data]);

  const shortNames = useMemo(() => buildShortNames(funds.map(f => f.name)), [funds]);
  const colors     = useMemo(() => new Map(funds.map((f, i) => [f.id, TRACKER_COLORS[i % TRACKER_COLORS.length]])), [funds]);

  const chartData = useMemo(() =>
    allMonths.map(m => {
      const obj = { month: m };
      for (const f of funds) if (selected.has(f.id)) obj[`f${f.id}`] = byFund.get(f.id)?.get(m)?.[metric] ?? null;
      return obj;
    }), [allMonths, funds, byFund, selected, metric]);

  const metricLabel = { hhi: 'HHI Score', top_holding_pct: 'Top Holding %', holding_count: 'Holdings Count' }[metric];
  const metricFmt   = metric === 'holding_count' ? (v) => Math.round(v) : (v) => fmt(v, metric === 'hhi' ? 1 : 2) + (metric === 'top_holding_pct' ? '%' : '');

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>;

  const ConcentrationTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pts = payload.filter(p => p.value != null).sort((a, b) => b.value - a.value);
    return (
      <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
        <p className="font-semibold mb-1.5 text-slate-300">{fmtMonth(label)}</p>
        {pts.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-300 truncate" style={{ maxWidth: 140 }}>{p.name}</span>
            </div>
            <span className="font-bold tabular-nums">{metricFmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Sort by latest HHI desc for the ranking table
  const sortedFunds = [...funds].sort((a, b) => (latestByFund.get(b.id)?.[metric] ?? 0) - (latestByFund.get(a.id)?.[metric] ?? 0));

  return (
    <div>
      {/* Metric selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Metric:</span>
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {[
            { id: 'hhi',             label: 'HHI Concentration' },
            { id: 'top_holding_pct', label: 'Top Holding %' },
            { id: 'holding_count',   label: 'Holdings Count' },
          ].map(m => (
            <button key={m.id} onClick={() => setMetric(m.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${metric === m.id ? 'bg-white dark:bg-slate-800 text-violet-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
          {metric === 'hhi' ? 'Higher HHI = fewer, larger bets. Lower = more diversified.' :
           metric === 'top_holding_pct' ? 'What % of NAV is in the single largest holding.' :
           'Total number of distinct stocks held.'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {sortedFunds.slice(0, 3).map((f, i) => {
          const val = latestByFund.get(f.id)?.[metric];
          return (
            <StatCard key={f.id}
              icon={<span className="text-base">{['🔴','🟡','🟢'][i]}</span>}
              label={['Most concentrated','Mid range','Most diversified'][i]}
              value={val != null ? metricFmt(val) : '—'}
              sub={shortNames.get(f.name) ?? f.name} />
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{metricLabel} Over Time</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Click fund names below to toggle lines</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(allMonths.length / 8))} />
            <YAxis tickFormatter={v => metricFmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<ConcentrationTooltip />} />
            {funds.filter(f => selected.has(f.id)).map(f => (
              <Line key={f.id} dataKey={`f${f.id}`} name={shortNames.get(f.name) ?? f.name}
                stroke={colors.get(f.id)} strokeWidth={2} dot={false} connectNulls={false}
                activeDot={{ r: 4, strokeWidth: 0 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          {funds.filter(f => selected.has(f.id)).map(f => (
            <div key={f.id} className="flex items-center gap-1.5 cursor-pointer"
              onClick={() => setSelected(s => { const n = new Set(s); n.delete(f.id); return n; })}>
              <span className="w-3 flex-shrink-0" style={{ height: 2, backgroundColor: colors.get(f.id), display: 'inline-block', borderRadius: 2, verticalAlign: 'middle' }} />
              <span className="text-xs text-slate-600 dark:text-slate-400">{shortNames.get(f.name) ?? f.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fund selector */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Select Funds to Compare</h2>
        <ConcentrationFundPicker
          funds={sortedFunds}
          selected={selected}
          setSelected={setSelected}
          colors={colors}
          shortNames={shortNames}
        />
        {selected.size === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">No funds selected — search above to add funds to the chart.</p>
        )}
      </div>
    </div>
  );
}

// ─── Stock Intelligence ───────────────────────────────────────────────────────

function StockIntelligence({ allFunds }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [tracker,     setTracker]     = useState(null);
  const [peers,       setPeers]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showExited,  setShowExited]  = useState(false);
  const skipSearch = useRef(false);

  // Debounced search
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      stockSearch(query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch on selection
  useEffect(() => {
    if (!selected) return;
    setLoading(true); setError(null); setTracker(null); setPeers(null);
    Promise.all([
      getStockTracker(selected.isin),
      getStockPeers(selected.isin),
    ]).then(([t, p]) => { setTracker(t); setPeers(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.isin]);

  // Process tracker into analytics
  const processed = useMemo(() => {
    if (!tracker?.length) return null;
    const months    = [...new Set(tracker.map(r => r.report_month))].sort();
    const latest    = months[months.length - 1];
    const sixAgo    = months[Math.max(0, months.length - 7)];
    const totalFunds = allFunds.length;

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

    // Conviction score (0-100)
    const adoptionPts = Math.min(35, (latestHolders.length / Math.max(totalFunds, 1)) * 100 * 0.35);
    const trendPts    = pastHolders.length === 0 && latestHolders.length > 0 ? 20
      : delta6m > 0.5 ? 30 : delta6m > 0.1 ? 22 : delta6m >= -0.1 ? 15
      : delta6m >= -0.5 ? 8 : 2;
    const sustainMonths = monthStats.filter(s => s.fund_count >= 2).length;
    const sustainPts    = (sustainMonths / months.length) * 20;
    const peakPts       = peakCount > 0 ? (latestHolders.length / peakCount) * 15 : 0;
    const score         = Math.round(adoptionPts + trendPts + sustainPts + peakPts);

    // Per-fund breakdown
    const fundIds = [...new Map(tracker.map(r => [r.fund_id, r.fund_name])).keys()];
    const fundBreakdown = fundIds.map(fid => {
      const rows            = tracker.filter(r => r.fund_id === fid).sort((a,b) => a.report_month.localeCompare(b.report_month));
      const fundLatestMonth = rows[0]?.fund_latest_month ?? latest;   // fund's own latest extraction
      const lastHeldMonth   = rows[rows.length - 1].report_month;
      // is_current = the fund's last holding month equals its own latest extraction month
      const is_current      = lastHeldMonth === fundLatestMonth;
      const latRow          = is_current ? rows[rows.length - 1] : null;
      const pstRow          = rows.find(r => r.report_month === sixAgo);
      return {
        fund_id:          fid,
        fund_name:        rows[0].fund_name,
        current_pct:      latRow?.pct_nav ?? null,
        delta:            (latRow && pstRow) ? +(latRow.pct_nav - pstRow.pct_nav).toFixed(4) : null,
        first_month:      rows[0].report_month,
        last_month:       lastHeldMonth,
        fund_latest_month: fundLatestMonth,   // fund's most recent extraction overall
        is_current,
      };
    }).sort((a, b) => (b.current_pct ?? -1) - (a.current_pct ?? -1));

    return { months, monthStats, latest, currentCount: latestHolders.length,
      peakCount, currentAvg, delta6m, score, fundBreakdown, totalFunds };
  }, [tracker, allFunds]);

  const shortNames = useMemo(() =>
    processed ? buildShortNames(processed.fundBreakdown.map(f => f.fund_name)) : new Map()
  , [processed]);
  const colors = useMemo(() =>
    processed ? new Map(processed.fundBreakdown.map((f,i) => [f.fund_id, TRACKER_COLORS[i % TRACKER_COLORS.length]])) : new Map()
  , [processed]);

  const scoreMeta = !processed ? null
    : processed.score >= 70 ? { label: 'Strong Conviction', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' }
    : processed.score >= 40 ? { label: 'Building',          color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     bar: 'bg-amber-400'   }
    :                          { label: 'Fading',            color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         bar: 'bg-red-400'     };

  const IntelTooltip = ({ active, payload, label }) => {
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

  function clearSelection() {
    setSelected(null); setQuery(''); setResults([]);
    setTracker(null); setPeers(null); setError(null);
  }

  return (
    <div className="space-y-5">
      {/* ── Search bar ── */}
      <div className="relative">
        <div className={`flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-800 border rounded-2xl shadow-sm transition-all ${results.length ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 dark:border-slate-700 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200'}`}>
          <Brain className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search for a stock by name or ISIN to generate its intelligence report…"
            className="flex-1 outline-none text-sm text-slate-700 dark:text-slate-300 bg-transparent placeholder:text-slate-400 dark:text-slate-500"
          />
          {(query || selected) && (
            <button onClick={clearSelection} className="text-slate-300 hover:text-slate-500 dark:text-slate-400 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {results.length > 0 && (
          <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
            {results.map(r => (
              <button key={r.isin}
                onMouseDown={() => { skipSearch.current = true; setSelected(r); setQuery(r.stock_name); setResults([]); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-colors border-b border-slate-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.stock_name}</p>
                    <CapBadge cap={r.market_cap_cat} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{r.isin}</p>
                </div>
                {r.industry && (
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0 ${industryBadgeClass(r.industry)}`}>{r.industry}</span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{r.fund_count} fund{r.fund_count!==1?'s':''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!selected && !loading && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <svg width="240" height="211" viewBox="0 0 100 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes chip-node { 0%,100%{opacity:0.5} 50%{opacity:1} }
                @keyframes chip-pin  { 0%,100%{opacity:0.4;transform:scaleX(0.7)} 50%{opacity:1;transform:scaleX(1)} }
                @keyframes chip-data { 0%{opacity:0;transform:translateY(4px)} 40%,60%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-4px)} }
                .cn1 { animation:chip-node 1.8s ease-in-out infinite 0s; }
                .cn2 { animation:chip-node 1.8s ease-in-out infinite 0.2s; }
                .cn3 { animation:chip-node 1.8s ease-in-out infinite 0.4s; }
                .cn4 { animation:chip-node 1.8s ease-in-out infinite 0.6s; }
                .cn5 { animation:chip-node 1.8s ease-in-out infinite 0.8s; }
                .cn6 { animation:chip-node 1.8s ease-in-out infinite 1.0s; }
                .cn7 { animation:chip-node 1.8s ease-in-out infinite 1.2s; }
                .cn8 { animation:chip-node 1.8s ease-in-out infinite 1.4s; }
                .cn9 { animation:chip-node 1.8s ease-in-out infinite 1.6s; }
                .cp1 { transform-origin:23px 28px; animation:chip-pin 2s ease-in-out infinite 0s; }
                .cp2 { transform-origin:23px 34px; animation:chip-pin 2s ease-in-out infinite 0.25s; }
                .cp3 { transform-origin:23px 42px; animation:chip-pin 2s ease-in-out infinite 0.5s; }
                .cp4 { transform-origin:23px 50px; animation:chip-pin 2s ease-in-out infinite 0.75s; }
                .cp5 { transform-origin:23px 58px; animation:chip-pin 2s ease-in-out infinite 1s; }
                .cp6 { transform-origin:77px 28px; animation:chip-pin 2s ease-in-out infinite 0.1s; }
                .cp7 { transform-origin:77px 34px; animation:chip-pin 2s ease-in-out infinite 0.35s; }
                .cp8 { transform-origin:77px 42px; animation:chip-pin 2s ease-in-out infinite 0.6s; }
                .cp9 { transform-origin:77px 50px; animation:chip-pin 2s ease-in-out infinite 0.85s; }
                .cp10{ transform-origin:77px 58px; animation:chip-pin 2s ease-in-out infinite 1.1s; }
                .cd1 { animation:chip-data 2.4s ease-in-out infinite 0s; }
                .cd2 { animation:chip-data 2.4s ease-in-out infinite 0.6s; }
                .cd3 { animation:chip-data 2.4s ease-in-out infinite 1.2s; }
              `}</style>
            </defs>
            {/* CPU chip body */}
            <rect x="28" y="22" width="44" height="40" rx="5" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.5"/>
            <rect x="33" y="27" width="34" height="30" rx="3" fill="#CECBF6" stroke="#AFA9EC" strokeWidth="1"/>
            {/* Inner grid nodes — animated */}
            <circle className="cn1" cx="40" cy="34" r="2.8" fill="#534AB7"/>
            <circle className="cn2" cx="50" cy="34" r="2.8" fill="#534AB7"/>
            <circle className="cn3" cx="60" cy="34" r="2.8" fill="#534AB7"/>
            <circle className="cn4" cx="40" cy="42" r="2.8" fill="#7F77DD"/>
            <circle className="cn5" cx="50" cy="42" r="2.8" fill="#534AB7"/>
            <circle className="cn6" cx="60" cy="42" r="2.8" fill="#7F77DD"/>
            <circle className="cn7" cx="40" cy="50" r="2.8" fill="#534AB7"/>
            <circle className="cn8" cx="50" cy="50" r="2.8" fill="#7F77DD"/>
            <circle className="cn9" cx="60" cy="50" r="2.8" fill="#534AB7"/>
            {/* Grid connections */}
            <line x1="40" y1="34" x2="50" y2="34" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="50" y1="34" x2="60" y2="34" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="40" y1="42" x2="50" y2="42" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="50" y1="42" x2="60" y2="42" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="40" y1="34" x2="40" y2="42" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="50" y1="34" x2="50" y2="42" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="60" y1="34" x2="60" y2="42" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="40" y1="42" x2="40" y2="50" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="50" y1="42" x2="50" y2="50" stroke="#AFA9EC" strokeWidth="0.9"/>
            <line x1="60" y1="42" x2="60" y2="50" stroke="#AFA9EC" strokeWidth="0.9"/>
            {/* Left pins — animated */}
            <line className="cp1" x1="18" y1="28" x2="28" y2="28" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp2" x1="18" y1="34" x2="28" y2="34" stroke="#FAC775" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp3" x1="18" y1="42" x2="28" y2="42" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp4" x1="18" y1="50" x2="28" y2="50" stroke="#E05252" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp5" x1="18" y1="58" x2="28" y2="58" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            {/* Right pins — animated */}
            <line className="cp6" x1="72" y1="28" x2="82" y2="28" stroke="#FAC775" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp7" x1="72" y1="34" x2="82" y2="34" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp8" x1="72" y1="42" x2="82" y2="42" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp9" x1="72" y1="50" x2="82" y2="50" stroke="#E05252" strokeWidth="2" strokeLinecap="round"/>
            <line className="cp10" x1="72" y1="58" x2="82" y2="58" stroke="#AFA9EC" strokeWidth="2" strokeLinecap="round"/>
            {/* Top data streams — animated upward */}
            <line x1="38" y1="22" x2="38" y2="12" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <line x1="50" y1="22" x2="50" y2="8" stroke="#534AB7" strokeWidth="2" strokeLinecap="round"/>
            <line x1="62" y1="22" x2="62" y2="12" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <circle className="cd1" cx="38" cy="10" r="3.2" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.2"/>
            <circle className="cd2" cx="50" cy="6" r="4.2" fill="#EEEDFE" stroke="#534AB7" strokeWidth="1.5"/>
            <circle className="cd2" cx="50" cy="6" r="2" fill="#534AB7"/>
            <circle className="cd3" cx="62" cy="10" r="3.2" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.2"/>
            {/* Bottom data streams */}
            <line x1="38" y1="62" x2="38" y2="72" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <line x1="50" y1="62" x2="50" y2="76" stroke="#534AB7" strokeWidth="2" strokeLinecap="round"/>
            <line x1="62" y1="62" x2="62" y2="72" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
            <ellipse cx="50" cy="82" rx="30" ry="4" fill="#D3D1C7" opacity="0.25"/>
            <circle cx="8" cy="14" r="2.2" fill="#FAC775"/>
            <circle cx="92" cy="12" r="1.8" fill="#CECBF6"/>
            <circle cx="6" cy="60" r="1.5" fill="#5DCAA5"/>
            <circle cx="94" cy="58" r="1.5" fill="#AFA9EC"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">Stock Intelligence Report</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Search for any stock to see its conviction score, fund adoption trend, holding breakdown, and sector peers.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {processed && selected && (
        <>
          {/* ── Header card ── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{selected.stock_name}</h2>
                  <CapBadge cap={selected.market_cap_cat} />
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{selected.isin}</span>
                  {selected.industry && (
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${industryBadgeClass(selected.industry)}`}>{selected.industry}</span>
                  )}
                </div>
              </div>
              {/* Conviction score badge */}
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
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${scoreMeta.bar}`} style={{ width: `${processed.score}%` }} />
              </div>
            </div>
          </div>

          {/* ── 4 stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Funds Holding</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{processed.currentCount}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">of {processed.totalFunds} · peak {processed.peakCount}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Avg Allocation</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{fmt(processed.currentAvg, 2)}%</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">across current holders</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">6M Allocation Δ</p>
              <div className="flex items-center gap-1.5 mt-1">
                {processed.delta6m > 0.05 ? <ArrowUp className="w-5 h-5 text-emerald-500" />
                  : processed.delta6m < -0.05 ? <ArrowDown className="w-5 h-5 text-red-400" />
                  : <Minus className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
                <p className={`text-2xl font-bold tabular-nums ${processed.delta6m > 0.05 ? 'text-emerald-600' : processed.delta6m < -0.05 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {processed.delta6m > 0 ? '+' : ''}{fmt(processed.delta6m, 2)}%
                </p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">avg allocation change</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Months Tracked</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{processed.months.length}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">since {fmtMonth(processed.months[0])}</p>
            </div>
          </div>

          {/* ── Trend chart + Fund breakdown ── */}
          <div className="grid grid-cols-5 gap-4">
            {/* Adoption + allocation trend chart */}
            <div className="col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Adoption Trend</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Fund count (purple) and avg allocation % (amber) over time</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={processed.monthStats} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(processed.months.length / 7))} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    width={28} domain={[0, Math.max(processed.peakCount + 1, 4)]} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<IntelTooltip />} />
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
            {(() => {
              const activeFunds = processed.fundBreakdown.filter(f => f.is_current);
              const exitedFunds = processed.fundBreakdown.filter(f => !f.is_current);
              const renderFundRow = (f) => {
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
                      <span
                        title={`Fund data last updated: ${fmtMonth(f.fund_latest_month)}`}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isStale ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
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
                    {activeFunds.map(renderFundRow)}
                    {exitedFunds.length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => setShowExited(v => !v)}
                          className="w-full text-left text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 py-1.5 px-2 flex items-center gap-1.5 transition-colors">
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
            })()}
          </div>

          {/* ── Sector Peers ── */}
          {peers?.length > 0 && selected.industry && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Peers — {selected.industry}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Other stocks in the same sector ranked by fund adoption in the latest month · click to analyse</p>
              <div className="grid grid-cols-2 gap-2">
                {peers.map((p, i) => (
                  <button key={p.isin}
                    onClick={() => { skipSearch.current = true; setSelected({ isin: p.isin, stock_name: p.stock_name, industry: selected.industry }); setQuery(p.stock_name); }}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-violet-200 hover:bg-violet-50 text-left transition-colors group">
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
  );
}

// ─── Portfolio Blender ────────────────────────────────────────────────────────

const BLEND_COLORS = ['#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function fmtInr(val) {
  if (!val || val <= 0) return null;
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(2)} L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function PortfolioBlender({ allFunds }) {
  const [amounts, setAmounts] = useState({}); // fundId → ₹ amount invested
  const [raw,     setRaw]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fundList   = allFunds.map(f => ({ id: f.id, name: f.name }));
  const shortNames = useMemo(() => buildShortNames(fundList.map(f => f.name)), [fundList]);
  const selected   = fundList.filter(f => (amounts[f.id] ?? 0) > 0);
  const totalInvested = selected.reduce((s, f) => s + (amounts[f.id] ?? 0), 0);

  // Fetch raw holdings whenever selected funds change
  useEffect(() => {
    const ids = selected.map(f => f.id);
    if (!ids.length) { setRaw(null); return; }
    const t = setTimeout(() => {
      setLoading(true); setError(null);
      getBlendedHoldings(ids)
        .then(setRaw).catch(e => setError(e.message)).finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [JSON.stringify(selected.map(f => f.id).sort())]);

  // Total NAV % covered per fund (sum of pct_nav for all holdings of that fund)
  const fundNavCoverage = useMemo(() => {
    if (!raw?.length) return {};
    const coverage = {};
    for (const row of raw) {
      coverage[row.fund_id] = (coverage[row.fund_id] ?? 0) + row.pct_nav;
    }
    return coverage;
  }, [raw]);

  // For each holding, compute: Σ (fund_amount × holding_pct_nav / 100)
  const blended = useMemo(() => {
    if (!raw?.length || !selected.length || totalInvested === 0) return null;
    const byIsin = new Map();
    for (const row of raw) {
      const fundAmt = amounts[row.fund_id] ?? 0;
      if (!fundAmt) continue;
      // rupees in this stock from this fund
      const rupees = fundAmt * (row.pct_nav / 100);
      if (!byIsin.has(row.isin)) {
        byIsin.set(row.isin, { isin: row.isin, stock_name: row.stock_name, industry: row.industry, rupees: 0, funds: [] });
      }
      const entry = byIsin.get(row.isin);
      entry.rupees += rupees;
      entry.funds.push({ name: row.fund_name, fund_amt: fundAmt, pct: row.pct_nav, rupees });
    }
    const rows = [...byIsin.values()].sort((a, b) => b.rupees - a.rupees);
    // Sector breakdown by rupees
    const bySector = new Map();
    for (const r of rows) {
      bySector.set(r.industry, (bySector.get(r.industry) ?? 0) + r.rupees);
    }
    const sectors = [...bySector.entries()].sort((a, b) => b[1] - a[1]).map(([name, rupees]) => ({ name, rupees }));
    return { rows, sectors };
  }, [raw, amounts, totalInvested]);

  function setAmount(fundId, val) {
    setAmounts(a => ({ ...a, [fundId]: Math.max(0, val) }));
  }

  const colorMap = useMemo(() => new Map(selected.map((f, i) => [f.id, BLEND_COLORS[i % BLEND_COLORS.length]])), [selected]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-5">
        {/* Left: fund picker + ₹ amounts */}
        <div className="col-span-1">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">How much are you investing?</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Enter the rupee amount per fund — see exactly how your money is split across holdings.</p>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {fundList.map(f => {
                const amt = amounts[f.id] ?? 0;
                const on  = amt > 0;
                const col = colorMap.get(f.id) ?? '#6366f1';
                return (
                  <div key={f.id} className={`rounded-xl border p-3 transition-colors ${on ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'}`}>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate mb-2" title={f.name}>
                      {shortNames.get(f.name) ?? f.name}
                    </span>
                    <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-violet-400 bg-white dark:bg-slate-700">
                      <span className="px-2 py-1.5 text-xs font-semibold text-slate-400 border-r border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 select-none" style={{ color: on ? col : undefined }}>₹</span>
                      <input
                        type="number"
                        min={0}
                        value={amt || ''}
                        placeholder="0"
                        onChange={e => setAmount(f.id, parseFloat(e.target.value) || 0)}
                        className="flex-1 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none"
                      />
                    </div>
                    {on && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">{fmtInr(amt)}</p>
                        {fundNavCoverage[f.id] != null && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {fundNavCoverage[f.id].toFixed(1)}% NAV tracked
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Total invested summary */}
            <div className={`mt-3 flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
              totalInvested > 0 ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'
            }`}>
              <span>Total invested</span>
              <span className="font-bold">{totalInvested > 0 ? fmtInr(totalInvested) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="col-span-2">
          {loading && <div className="skeleton h-64 rounded-2xl" />}
          {error   && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}
          {!selected.length && !loading && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              Enter an amount for 1+ funds to see where your money goes
            </div>
          )}

          {selected.length > 0 && totalInvested === 0 && !loading && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center text-amber-700 dark:text-amber-400 text-sm">
              Enter a ₹ amount for at least one fund to see your holding breakdown
            </div>
          )}

          {blended && !loading && (
            <>
              {/* Sector breakdown */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sector Allocation</h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500">of {fmtInr(totalInvested)}</span>
                </div>
                <div className="space-y-1.5">
                  {blended.sectors.slice(0, 12).map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-40 truncate">{s.name}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${Math.min((s.rupees / (blended.sectors[0]?.rupees ?? 1)) * 100, 100)}%`, backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300 w-20 text-right">{fmtInr(s.rupees)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unaccounted amount note */}
              {(() => {
                const tracked = blended.rows.reduce((s, r) => s + r.rupees, 0);
                const untracked = totalInvested - tracked;
                const pct = ((untracked / totalInvested) * 100).toFixed(1);
                if (untracked <= 0) return null;
                return (
                  <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="shrink-0 mt-0.5">ℹ️</span>
                    <span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtInr(untracked)} ({pct}%)</span> of your investment is in cash, TREPS, government bonds, or other instruments not tracked in equity holdings — this is normal for mutual funds.
                    </span>
                  </div>
                );
              })()}

              {/* Top holdings */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Where your money goes</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{blended.rows.length} stocks</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
                  {blended.rows.slice(0, 40).map((r, i) => (
                    <div key={r.isin} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <span className="text-xs text-slate-300 w-5 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{r.stock_name}</p>
                          <CapBadge cap={r.market_cap_cat} />
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.industry}</p>
                        {/* Per-fund breakdown */}
                        <div className="flex flex-wrap gap-x-3 mt-0.5">
                          {r.funds.map(f => {
                            const fundId = selected.find(s => s.name === f.name)?.id;
                            const col = colorMap.get(fundId) ?? '#94a3b8';
                            return (
                              <span key={f.name} className="text-[10px]" style={{ color: col }}>
                                {shortNames.get(f.name) ?? f.name}: {fmtInr(f.rupees)} <span className="opacity-60">({fmt(f.pct)}% NAV)</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mr-1 shrink-0">
                        <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${Math.min((r.rupees / (blended.rows[0]?.rupees ?? 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200 w-20 text-right shrink-0">{fmtInr(r.rupees)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// Maps each tab id to its feature flag key (undefined = always visible)
const TAB_FEATURE_KEYS = {
  conviction:     'cross_fund',
  gems:           'hidden_gems',
  rising:         'rising_conviction',
  newentries:     'cross_fund',
  discovery:      'discovery_chain',
  overlap:        'overlap_matrix',
  trend:          'overlap_matrix',
  sector:         'sector_drift',
  rotation:       'sector_rotation',
  churn:          'churn_rates',
  concentration:  'cross_fund',
  intelligence:   'cross_fund',
  timeline:       'entry_exit',
  diff:           'compare_months',
  tracker:        'stock_tracker',
  blender:        'blended_portfolio',
};

export default function CrossFundAnalysis() {
  const [tab, setTab]           = useState('conviction');
  const [matrixData, setMatrixData] = useState(null);   // shared between overlap + trend tabs
  const [allFunds, setAllFunds] = useState([]);
  const { flags, overrides }    = useFeatureFlags();
  const { isPro }               = useSubscription();

  function canShow(tabId) {
    const key = TAB_FEATURE_KEYS[tabId];
    if (!key) return true;
    return canUseFeature(flags, overrides, isPro, key);
  }

  // Fetch matrix data + fund list once; share between tabs
  useEffect(() => {
    getOverlapMatrix().then(setMatrixData).catch(() => {});
    getFunds().then(setAllFunds).catch(() => {});
  }, []);

  const matrixFunds  = matrixData?.funds ?? [];
  const matrixPairs  = matrixData?.pairs ?? [];
  const shortNames   = buildShortNames(matrixFunds.map(f => f.fund_name));

  const TAB_GROUPS = [
    {
      label: 'Holdings',
      tabs: [
        {
          id: 'conviction', label: 'High Conviction', icon: <Award className="w-4 h-4" />,
          desc: 'Stocks held across multiple funds simultaneously',
          tip:  'The more funds hold a stock, the stronger the collective conviction. Look for stocks held by 3+ funds — these are the market\'s highest-agreement ideas. Consistent weighting across funds signals even stronger belief.',
        },
        {
          id: 'gems',       label: 'Hidden Gems',     icon: <Gem className="w-4 h-4" />,
          desc: 'Stocks held exclusively by one fund — unique high-conviction bets',
          tip:  'A high allocation (>2% NAV) in a single fund is a strong signal of manager conviction. Watch if peer funds start buying in — that\'s validation. These are the most differentiated positions in your portfolio.',
        },
        {
          id: 'newentries', label: 'New Entries',     icon: <Sparkles className="w-4 h-4" />,
          desc: 'Stocks added across all your funds in the latest month',
          tip:  'Multiple funds entering the same stock in the same month is a strong buy signal. Check if entries are clustered in one industry — sector rotation often shows up here first, before it\'s widely reported.',
        },
        {
          id: 'discovery',  label: 'Discovery Chain', icon: <Telescope className="w-4 h-4" />,
          desc: 'Which fund first bought a stock before others followed',
          tip:  'Early movers who are consistently followed by peers are the alpha generators in your portfolio. A short time gap between first entry and follow-on buys signals strong institutional conviction in that pick.',
        },
      ],
    },
    {
      label: 'Overlap',
      tabs: [
        {
          id: 'overlap',    label: 'Overlap Matrix',  icon: <Grid3x3 className="w-4 h-4" />,
          desc: 'Pairwise portfolio similarity between all your funds',
          tip:  'Overlap >40% means you\'re paying two expense ratios for very similar exposure. Aim to keep fund pairs under 30% for genuine diversification. Red cells = high redundancy — consider consolidating those funds.',
        },
        {
          id: 'trend',      label: 'Overlap Trend',   icon: <TrendingUp className="w-4 h-4" />,
          desc: 'How the overlap between two specific funds has changed over time',
          tip:  'Rising overlap month-over-month means funds are converging — a sign to review your allocation. Falling overlap is healthy, meaning the pair is becoming more complementary. Click any point to see the shared stocks for that month.',
        },
      ],
    },
    {
      label: 'Sectors',
      tabs: [
        {
          id: 'sector',     label: 'Sector Drift',    icon: <BarChart2 className="w-4 h-4" />,
          desc: 'How a fund\'s sector allocation has shifted month over month',
          tip:  'Sudden sector jumps (>5% NAV in a month) signal active repositioning by the manager. Compare the timing against market events — a good manager anticipates shifts, a reactive one chases them.',
        },
        {
          id: 'rotation',   label: 'Rotation Calendar', icon: <RotateCcw className="w-4 h-4" />,
          desc: 'When sectors rotate in and out of favor across all your funds',
          tip:  'Synchronized sector exits across multiple funds are a strong signal of sector-level risk — when everyone leaves together, the drawdown can be sharp. Divergence means funds have differing views, which is healthy for a portfolio.',
        },
      ],
    },
    {
      label: 'Fund Behaviour',
      tabs: [
        {
          id: 'churn',        label: 'Turnover',          icon: <Activity className="w-4 h-4" />,
          desc: 'How frequently each fund buys and sells its holdings',
          tip:  'High churn (>80%/year) = active trader with higher transaction costs and tax events. Low churn (<20%) = buy-and-hold style. Neither is inherently better — cross-reference turnover with returns to judge if the activity is worth it.',
        },
        {
          id: 'concentration',label: 'Concentration',     icon: <Gauge className="w-4 h-4" />,
          desc: 'How concentrated a fund\'s holdings are in its top positions',
          tip:  'If the top 10 holdings make up >60% of NAV, the fund is highly concentrated. This amplifies both gains and losses. High concentration is fine if you trust the manager\'s conviction — but watch for single-stock blow-up risk.',
        },
      ],
    },
    {
      label: 'Per Stock',
      tabs: [
        {
          id: 'intelligence', label: 'Intelligence',   icon: <Brain className="w-4 h-4" />,
          desc: 'Deep analysis of any stock across all your funds',
          tip:  'Look at the weight trend line — a steadily increasing allocation signals growing conviction. If multiple funds are independently increasing weight in the same stock, that\'s one of the strongest buy signals this tool can surface.',
        },
        {
          id: 'timeline',     label: 'Entry / Exit',   icon: <Clock className="w-4 h-4" />,
          desc: 'Gantt chart of when stocks entered and exited a fund over time',
          tip:  'Re-entries (a stock that was sold and then re-bought) are particularly interesting — the manager reversed course. Long continuous bars = core holdings. Short bars = trading positions. Look for stocks that exit and never return.',
        },
        {
          id: 'diff',         label: 'Monthly Diff',   icon: <ArrowLeftRight className="w-4 h-4" />,
          desc: 'Side-by-side comparison of two months\' holdings for a fund',
          tip:  'Don\'t just look at entries and exits — focus on large weight changes in stocks that stayed. A position dropping from 5% to 2% is a quiet trimming signal. Comparing two months 6+ apart reveals strategic shifts more clearly.',
        },
        {
          id: 'tracker',      label: 'Stock Tracker',  icon: <Search className="w-4 h-4" />,
          desc: 'Track a specific stock\'s weight across all your funds over time',
          tip:  'Convergence — all funds increasing weight simultaneously — is one of the strongest signals this app can surface. Divergence, where some funds buy and others sell, means split opinion. Dig into which fund has the better track record on that stock.',
        },
      ],
    },
    {
      label: 'Tools',
      tabs: [
        {
          id: 'blender',    label: 'Portfolio Blender', icon: <Blend className="w-4 h-4" />,
          desc: 'See exactly where your money goes across multiple funds',
          tip:  'Enter the rupee amount you invest in each fund. Every holding shows how much of your actual money sits in that stock — across all your funds combined. Use the sector breakdown to spot hidden concentrations you\'d miss looking at funds individually.',
        },
      ],
    },
  ];

  // Filter out disabled tabs and empty groups
  const visibleGroups = TAB_GROUPS
    .map(g => ({ ...g, tabs: g.tabs.filter(t => canShow(t.id)) }))
    .filter(g => g.tabs.length > 0);

  const allTabs = visibleGroups.flatMap(g => g.tabs);

  // If current tab was hidden, fall back to first visible tab
  const activeTab = allTabs.find(t => t.id === tab)?.id ?? allTabs[0]?.id ?? tab;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Layers className="w-5 h-5 text-violet-600" />
          Analysis
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Cross-fund holdings analysis and portfolio overlap detection.
        </p>
      </div>

      {/* Two-level nav */}
      {(() => {
        const activeGroup = visibleGroups.find(g => g.tabs.some(t => t.id === activeTab)) ?? visibleGroups[0];
        return (
          <div className="mb-6">
            {/* Category row — underline style, scrollable on mobile */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-0 overflow-x-auto">
              {visibleGroups.map(group => {
                const isActive = group.label === activeGroup.label;
                return (
                  <button key={group.label}
                    onClick={() => setTab(group.tabs[0].id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-violet-600 text-violet-700'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}>
                    {group.label}
                  </button>
                );
              })}
            </div>

            {/* Subtab row — compact pills */}
            <div className="flex gap-1.5 pt-3 flex-wrap">
              {activeGroup.tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === t.id
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-300'
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Active tab description */}
            {(() => {
              const activeTab = allTabs.find(t => t.id === tab);
              if (!activeTab?.desc) return null;
              return (
                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                  <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-semibold">{activeTab.desc}.</span>
                    {activeTab.tip && <span className="text-amber-700"> {activeTab.tip}</span>}
                  </p>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {activeTab === 'conviction'   && <HighConviction />}
      {activeTab === 'overlap'      && <OverlapMatrix />}
      {activeTab === 'trend'        && <OverlapTrend matrixFunds={matrixFunds} shortNames={shortNames} />}
      {activeTab === 'sector'       && <SectorDrift allFunds={allFunds} />}
      {activeTab === 'gems'         && <HiddenGems />}
      {activeTab === 'intelligence' && <StockIntelligence  allFunds={allFunds} />}
      {activeTab === 'timeline'     && <EntryExitTimeline allFunds={allFunds} />}
      {activeTab === 'diff'         && <MonthlyDiff       allFunds={allFunds} />}
      {activeTab === 'tracker'      && <StockTracker      allFunds={allFunds} />}
      {activeTab === 'newentries'   && <NewEntries />}
      {activeTab === 'churn'        && <FundChurn        allFunds={allFunds} />}
      {activeTab === 'rotation'     && <SectorRotationCalendar />}
      {activeTab === 'discovery'    && <StockDiscovery />}
      {activeTab === 'concentration'&& <ConcentrationScore allFunds={allFunds} />}
      {activeTab === 'blender'      && <PortfolioBlender  allFunds={allFunds} />}
    </div>
  );
}
