import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, GitCompare, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { getFund, getFundExtractions, compareFundMonths, getHoldingsSummary, getMultiMonthRange } from '../api/client.js';
import { industryBadgeClass } from '../utils/industryColors.js';

// ─── Month Range Slider ───────────────────────────────────────────────────────
function MonthRangeSlider({ extractions, month1, month2, onMonth1Change, onMonth2Change }) {
  const sorted = useMemo(
    () => [...extractions].sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [extractions]
  );
  const n = sorted.length;

  // Year tick positions — must be computed before any early return (rules of hooks)
  const yearTicks = useMemo(() => {
    if (n < 2) return [];
    const seen = new Set();
    return sorted.map((e, i) => {
      const y = e.report_month.slice(0, 4);
      if (seen.has(y)) return null;
      seen.add(y);
      return { year: y, pct: (i / (n - 1)) * 100 };
    }).filter(Boolean);
  }, [sorted, n]);

  if (n < 2) return null;

  const getIdx = id => { const i = sorted.findIndex(e => String(e.id) === id); return i >= 0 ? i : null; };
  const idx1 = getIdx(month1) ?? 0;
  const idx2 = getIdx(month2) ?? n - 1;

  const pct1 = (idx1 / (n - 1)) * 100;
  const pct2 = (idx2 / (n - 1)) * 100;

  function move1(v) { if (v < idx2) onMonth1Change(String(sorted[v].id)); }
  function move2(v) { if (v > idx1) onMonth2Change(String(sorted[v].id)); }

  const ext1 = sorted[idx1];
  const ext2 = sorted[idx2];
  const monthsInRange = idx2 - idx1 + 1;

  return (
    <div className="px-2">
      {/* Thumb labels */}
      <div className="relative h-7 mb-1">
        {[{pct: pct1, ext: ext1, color: 'blue'}, {pct: pct2, ext: ext2, color: 'violet'}].map(({pct, ext, color}) => (
          <div
            key={color}
            className="absolute -translate-x-1/2 pointer-events-none"
            style={{ left: `${pct}%` }}
          >
            <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap
              ${color === 'blue' ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white'}`}>
              {fmtMonth(ext?.report_month)}
            </span>
          </div>
        ))}
      </div>

      {/* Track */}
      <div className="relative h-5 flex items-center select-none">
        {/* Base track */}
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full" />
        {/* Filled range */}
        <div
          className="absolute h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full pointer-events-none"
          style={{ left: `${pct1}%`, width: `${pct2 - pct1}%` }}
        />
        {/* Lower thumb input */}
        <input
          type="range" min={0} max={n - 1} value={idx1}
          onChange={e => move1(+e.target.value)}
          className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer range-thumb-blue"
          style={{ zIndex: idx1 >= idx2 - 1 ? 5 : 3 }}
        />
        {/* Upper thumb input */}
        <input
          type="range" min={0} max={n - 1} value={idx2}
          onChange={e => move2(+e.target.value)}
          className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer range-thumb-violet"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Year ticks */}
      <div className="relative h-5 mt-1">
        {yearTicks.map(({ year, pct }) => (
          <div
            key={year}
            className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${pct}%` }}
          >
            <div className="w-px h-1.5 bg-slate-300" />
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">{year}</span>
          </div>
        ))}
      </div>

      {/* Span indicator */}
      {idx1 !== idx2 && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          {monthsInRange} month{monthsInRange !== 1 ? 's' : ''} selected
          {monthsInRange > 2 && (
            <span className="ml-2 text-violet-500 font-medium">· timeline mode</span>
          )}
        </p>
      )}

      {/* Thumb styles injected inline */}
      <style>{`
        input[type='range'].range-thumb-blue::-webkit-slider-thumb,
        input[type='range'].range-thumb-violet::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px; width: 18px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          pointer-events: all;
          cursor: grab;
        }
        input[type='range'].range-thumb-blue::-webkit-slider-thumb  { background: #2563eb; }
        input[type='range'].range-thumb-violet::-webkit-slider-thumb { background: #7c3aed; }
        input[type='range'].range-thumb-blue::-moz-range-thumb,
        input[type='range'].range-thumb-violet::-moz-range-thumb {
          height: 18px; width: 18px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          cursor: grab;
        }
        input[type='range'].range-thumb-blue::-moz-range-thumb  { background: #2563eb; }
        input[type='range'].range-thumb-violet::-moz-range-thumb { background: #7c3aed; }
      `}</style>
    </div>
  );
}

// ─── Extraction Calendar ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ExtractionCalendar({ extractions, month1, month2, onMonth1Change, onMonth2Change }) {
  const extByMonth = {};
  for (const e of extractions) extByMonth[e.report_month] = e;

  const years = [...new Set(extractions.map(e => e.report_month.slice(0, 4)))].sort();
  if (!years.length) return null;

  const sel1 = extractions.find(e => String(e.id) === month1)?.report_month;
  const sel2 = extractions.find(e => String(e.id) === month2)?.report_month;

  function inRange(m) {
    if (!sel1 || !sel2) return false;
    const [lo, hi] = sel1 < sel2 ? [sel1, sel2] : [sel2, sel1];
    return m > lo && m < hi;
  }

  function handleClick(ext) {
    const id = String(ext.id);
    if (id === month1) { onMonth1Change(''); return; }
    if (id === month2) { onMonth2Change(''); return; }
    if (!month1) { onMonth1Change(id); return; }
    if (!month2) {
      const existingMonth = extractions.find(e => String(e.id) === month1)?.report_month;
      if (ext.report_month < existingMonth) {
        onMonth2Change(month1);
        onMonth1Change(id);
      } else {
        onMonth2Change(id);
      }
      return;
    }
    const m1 = extractions.find(e => String(e.id) === month1)?.report_month ?? '';
    const m2 = extractions.find(e => String(e.id) === month2)?.report_month ?? '';
    const d1 = Math.abs(ext.report_month.localeCompare(m1));
    const d2 = Math.abs(ext.report_month.localeCompare(m2));
    if (d1 <= d2) onMonth1Change(id); else onMonth2Change(id);
  }

  const confidenceColor = (label) => {
    const l = label?.toLowerCase();
    if (l === 'high')   return 'text-emerald-600';
    if (l === 'medium') return 'text-amber-600';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-1">
      {years.map(year => (
        <div key={year} className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 w-8 shrink-0 text-right">{year}</span>
          <div className="grid grid-cols-12 gap-1 flex-1">
            {MONTHS.map((lbl, idx) => {
              const isoMonth = `${year}-${String(idx + 1).padStart(2, '0')}-01`;
              const ext      = extByMonth[isoMonth];
              const isSel1   = ext && String(ext.id) === month1;
              const isSel2   = ext && String(ext.id) === month2;
              const isRange  = inRange(isoMonth);
              const hasData  = !!ext;

              let cellCls, textCls;
              if (isSel1) {
                cellCls = 'bg-indigo-600 border-indigo-600 shadow-sm';
                textCls = 'text-white font-bold';
              } else if (isSel2) {
                cellCls = 'bg-violet-600 border-violet-600 shadow-sm';
                textCls = 'text-white font-bold';
              } else if (isRange && hasData) {
                cellCls = 'bg-slate-100 border-slate-300';
                textCls = 'text-slate-600 font-medium';
              } else if (isRange) {
                cellCls = 'bg-slate-50 border-slate-200';
                textCls = 'text-slate-300';
              } else if (hasData) {
                cellCls = 'bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer';
                textCls = 'text-slate-700';
              } else {
                cellCls = 'bg-transparent border-transparent';
                textCls = 'text-slate-200';
              }

              return (
                <div
                  key={idx}
                  onClick={() => hasData && handleClick(ext)}
                  title={hasData ? `${lbl} ${year} — ${ext.holding_count} holdings (${ext.confidence_label})` : ''}
                  className={`border rounded text-center py-1.5 transition-colors select-none ${cellCls} ${hasData ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`text-[11px] leading-none ${textCls}`}>{lbl}</div>
                  {hasData && !isSel1 && !isSel2 && (
                    <div className={`text-[9px] mt-0.5 leading-none ${confidenceColor(ext.confidence_label)}`}>
                      {ext.holding_count}
                    </div>
                  )}
                  {(isSel1 || isSel2) && (
                    <div className="text-[9px] mt-0.5 leading-none text-white/80">{ext.holding_count}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 text-xs text-slate-400 ml-10">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block" />Earlier</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-600 inline-block" />Later</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-300 inline-block" />In range</span>
        <span className="flex items-center gap-1.5 ml-auto">Number = holdings count</span>
      </div>
    </div>
  );
}

// ─── Multi-Month Timeline ─────────────────────────────────────────────────────

const NAV_DRIFT_THRESHOLD = 0.3; // % after scale applied

function filteredDrifters(navDrifters, scale) {
  if (!navDrifters) return [];
  return navDrifters.filter(h => Math.abs((h.nav_delta || 0) * scale) >= NAV_DRIFT_THRESHOLD);
}

function TransitionCard({ transition, scale, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const drifters = filteredDrifters(transition.navDrifters, scale);
  const totalChanges = transition.newHoldings.length + transition.exitedHoldings.length + transition.weightChanges.length + drifters.length;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-bold">
              {fmtMonth(transition.fromMonth)}
            </span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
            <span className="px-2.5 py-1 bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-lg text-xs font-bold">
              {fmtMonth(transition.toMonth)}
            </span>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-1.5 ml-2">
            {transition.newHoldings.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                +{transition.newHoldings.length} in
              </span>
            )}
            {transition.exitedHoldings.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
                −{transition.exitedHoldings.length} out
              </span>
            )}
            {transition.weightChanges.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                {transition.weightChanges.length} changed
              </span>
            )}
            {drifters.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                {drifters.length} drifted
              </span>
            )}
            {totalChanges === 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">No changes</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 shrink-0">
          {totalChanges > 0 && (
            <span className="text-xs">{totalChanges} change{totalChanges !== 1 ? 's' : ''}</span>
          )}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && totalChanges > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-700">
            {/* New entries */}
            <div>
              <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/40">
                <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  New Entries
                  <span className="ml-auto bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">{transition.newHoldings.length}</span>
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                {transition.newHoldings.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">None</div>
                ) : transition.newHoldings.map(h => (
                  <MiniHoldingRow key={h.isin} h={h} variant="new" scale={scale} />
                ))}
              </div>
            </div>

            {/* Exits */}
            <div>
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Exits
                  <span className="ml-auto bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">{transition.exitedHoldings.length}</span>
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                {transition.exitedHoldings.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">None</div>
                ) : transition.exitedHoldings.map(h => (
                  <MiniHoldingRow key={h.isin} h={h} variant="exited" scale={scale} />
                ))}
              </div>
            </div>

            {/* Weight changes */}
            <div>
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Minus className="w-3.5 h-3.5" />
                  Weight Changes
                  <span className="ml-auto bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">{transition.weightChanges.length}</span>
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                {transition.weightChanges.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">None</div>
                ) : transition.weightChanges.map(h => (
                  <MiniHoldingRow key={h.isin + h.action} h={h} variant="changed" scale={scale} />
                ))}
              </div>
            </div>

            {/* NAV Drift */}
            <div>
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  NAV Drift
                  <span className="ml-auto bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold">{drifters.length}</span>
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                {drifters.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">None ≥ 0.3%</div>
                ) : drifters.map(h => (
                  <MiniHoldingRow key={h.isin} h={h} variant="drifted" scale={scale} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {open && totalChanges === 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No changes detected between these two months
        </div>
      )}
    </div>
  );
}

function MiniHoldingRow({ h, variant, scale }) {
  const pct     = (h.pct_nav      || 0) * scale;
  const prevPct = (h.prev_pct_nav || 0) * scale;
  const navDeltaScaled = (h.nav_delta || 0) * scale;

  return (
    <div className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug line-clamp-1 flex-1" title={h.stock_name}>
          {h.stock_name}
        </span>
        {variant === 'changed' && (
          <span className={`text-[10px] font-bold shrink-0 ${
            h.action === 'added' ? 'text-green-600' :
            h.action === 'isin_changed' ? 'text-purple-600' :
            'text-orange-600'
          }`}>
            {h.action === 'added' ? '▲' : h.action === 'isin_changed' ? '⟳' : '▼'}
          </span>
        )}
        {variant === 'drifted' && (
          <span className={`text-[10px] font-bold shrink-0 ${navDeltaScaled > 0 ? 'text-amber-600' : 'text-amber-400'}`}>
            {navDeltaScaled > 0 ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400 font-mono">{h.isin}</div>
      {(variant === 'changed' || variant === 'drifted') ? (
        <div className="mt-1 text-[10px] text-slate-500">
          {fmt(prevPct)}% → <span className="font-semibold text-slate-700">{fmt(pct)}%</span>
          <span className={`ml-1 font-semibold ${
            navDeltaScaled > 0 ? 'text-amber-600' : navDeltaScaled < 0 ? 'text-slate-500' : 'text-slate-400'
          }`}>
            ({navDeltaScaled >= 0 ? '+' : ''}{fmt(navDeltaScaled)}%)
          </span>
        </div>
      ) : (
        <div className="mt-1 text-[10px] font-semibold text-slate-600">{fmt(pct)}% NAV</div>
      )}
      {h.industry && (
        <span className={`inline-flex mt-1 items-center px-1 py-0.5 rounded border text-[9px] font-medium ${industryBadgeClass(h.industry)}`}>
          {h.industry}
        </span>
      )}
    </div>
  );
}

function MultiMonthTimeline({ data, scale }) {
  const totalNew     = data.transitions.reduce((s, t) => s + t.newHoldings.length,    0);
  const totalExited  = data.transitions.reduce((s, t) => s + t.exitedHoldings.length, 0);
  const totalChanged = data.transitions.reduce((s, t) => s + t.weightChanges.length,  0);
  const totalDrifted = data.transitions.reduce((s, t) => s + filteredDrifters(t.navDrifters, scale).length, 0);

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        <span className="font-semibold text-slate-700">
          {fmtMonth(data.startMonth)}
        </span>
        <span className="text-slate-400">→</span>
        <span className="font-semibold text-slate-700">
          {fmtMonth(data.endMonth)}
        </span>
        <span className="text-xs text-slate-400 ml-1">
          {data.transitions.length} transition{data.transitions.length !== 1 ? 's' : ''} · {data.extractions.length} months
        </span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {totalNew     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">+{totalNew} total entries</span>}
          {totalExited  > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">−{totalExited} total exits</span>}
          {totalChanged > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{totalChanged} weight changes</span>}
          {totalDrifted > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{totalDrifted} NAV drifts</span>}
        </div>
      </div>

      {/* Transition cards */}
      <div className="space-y-3">
        {data.transitions.map((t, i) => (
          <TransitionCard
            key={`${t.fromMonth}-${t.toMonth}`}
            transition={t}
            scale={scale}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Compare() {
  const { id } = useParams();
  const [fund, setFund] = useState(null);
  const [extractions, setExtractions] = useState([]);
  const [month1, setMonth1] = useState('');
  const [month2, setMonth2] = useState('');
  const [result, setResult] = useState(null);           // 2-month result
  const [timelineResult, setTimelineResult] = useState(null); // multi-month result
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getFund(id), getFundExtractions(id)])
      .then(([f, exts]) => {
        setFund(f);
        setExtractions(exts);
        if (exts.length >= 2) { setMonth1(String(exts[1].id)); setMonth2(String(exts[0].id)); }
        else if (exts.length === 1) setMonth1(String(exts[0].id));
      })
      .catch(e => setError(e.message));
  }, [id]);

  // Sorted extractions between month1 and month2 (inclusive)
  const sortedExts = useMemo(
    () => [...extractions].sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [extractions]
  );

  const extractionsInRange = useMemo(() => {
    if (!month1 || !month2) return [];
    const m1 = extractions.find(e => String(e.id) === month1)?.report_month ?? '';
    const m2 = extractions.find(e => String(e.id) === month2)?.report_month ?? '';
    const [lo, hi] = m1 < m2 ? [m1, m2] : [m2, m1];
    return sortedExts.filter(e => e.report_month >= lo && e.report_month <= hi);
  }, [month1, month2, extractions, sortedExts]);

  const isMultiMonth = extractionsInRange.length > 2;

  function runCompare() {
    if (!month1 || !month2 || month1 === month2) return;
    const ext1 = extractions.find(e => String(e.id) === month1);
    const ext2 = extractions.find(e => String(e.id) === month2);
    if (!ext1 || !ext2) return;

    setLoading(true);
    setResult(null);
    setTimelineResult(null);
    setError(null);

    const [loExt, hiExt] = ext1.report_month < ext2.report_month ? [ext1, ext2] : [ext2, ext1];

    if (isMultiMonth) {
      // Multi-month timeline
      Promise.all([
        getMultiMonthRange(id, loExt.report_month, hiExt.report_month),
        getHoldingsSummary(hiExt.id),
      ])
        .then(([timeline, summary]) => {
          setTimelineResult(timeline);
          const total = summary?.totals?.total_pct_nav ?? 0;
          setScale(total > 0 && total < 2 ? 100 : 1);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      // Classic 2-month comparison
      Promise.all([
        compareFundMonths(id, [loExt.report_month, hiExt.report_month]),
        getHoldingsSummary(hiExt.id),
      ])
        .then(([cmp, summary]) => {
          setResult(cmp);
          const total = summary?.totals?.total_pct_nav ?? 0;
          setScale(total > 0 && total < 2 ? 100 : 1);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }

  const ext1Meta = extractions.find(e => e.id === result?.extraction1_id);
  const ext2Meta = extractions.find(e => e.id === result?.extraction2_id);

  const canCompare = month1 && month2 && month1 !== month2;

  return (
    <div>
      <Link to={`/funds/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Fund
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-indigo-600" />
          Month Comparison
        </h1>
        {fund && <p className="text-slate-500 text-sm mt-0.5">{fund.name}</p>}
      </div>

      {/* Calendar selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        {/* Range slider */}
        <MonthRangeSlider
          extractions={extractions}
          month1={month1}
          month2={month2}
          onMonth1Change={v => { setMonth1(v); setResult(null); setTimelineResult(null); }}
          onMonth2Change={v => { setMonth2(v); setResult(null); setTimelineResult(null); }}
        />

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 shrink-0">or pick from the calendar</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400">
            Click any two months to compare them. Cells show holdings count.
          </p>
          {(month1 || month2) && (
            <button
              onClick={() => { setMonth1(''); setMonth2(''); setResult(null); setTimelineResult(null); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear selection
            </button>
          )}
        </div>

        <ExtractionCalendar
          extractions={extractions}
          month1={month1}
          month2={month2}
          onMonth1Change={v => { setMonth1(v); setResult(null); setTimelineResult(null); }}
          onMonth2Change={v => { setMonth2(v); setResult(null); setTimelineResult(null); }}
        />

        {/* Selection status + Compare button */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            {month1 ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                {extractions.find(e => String(e.id) === month1) && fmtMonth(extractions.find(e => String(e.id) === month1).report_month)}
              </span>
            ) : (
              <span className="text-slate-400 text-xs">Click a month to select start</span>
            )}
            {month1 && <span className="text-slate-300">→</span>}
            {month2 ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg font-medium">
                <span className="w-2 h-2 rounded-full bg-violet-600 inline-block" />
                {extractions.find(e => String(e.id) === month2) && fmtMonth(extractions.find(e => String(e.id) === month2).report_month)}
              </span>
            ) : (
              month1 && <span className="text-slate-400 text-xs">Click another month to select end</span>
            )}
            {isMultiMonth && (
              <span className="text-xs text-violet-600 font-medium ml-1">
                {extractionsInRange.length} months · {extractionsInRange.length - 1} transitions
              </span>
            )}
          </div>
          <button
            onClick={runCompare}
            disabled={!canCompare || loading}
            className={`px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm shrink-0 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${isMultiMonth
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
          >
            {loading
              ? 'Loading…'
              : isMultiMonth
                ? `View Timeline`
                : 'Compare'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {isMultiMonth
            ? [...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
            : (
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
              </div>
            )
          }
        </div>
      )}

      {/* Multi-month timeline view */}
      {timelineResult && (
        <MultiMonthTimeline data={timelineResult} scale={scale} />
      )}

      {/* Classic 2-month comparison view */}
      {result && (() => {
        const drifters2 = filteredDrifters(result.navDrifters, scale);
        return (
          <div>
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{fmtMonth(ext1Meta?.report_month)}</span>
              <span className="text-slate-500">→</span>
              <span className="font-medium text-slate-700">{fmtMonth(ext2Meta?.report_month)}</span>
              <span className="ml-2 text-xs text-slate-400">
                {result.newHoldings.length + result.exitedHoldings.length + result.weightChanges.length} active changes
                {drifters2.length > 0 && ` · ${drifters2.length} NAV drifts`}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <CompareColumn
                title="New Entries"
                count={result.newHoldings.length}
                color="green"
                icon={<TrendingUp className="w-4 h-4" />}
                empty="No new entries this month"
                doodle={
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <style>{`
                        @keyframes cc-sway { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
                        @keyframes cc-bud  { 0%,100%{transform:scale(1)}      50%{transform:scale(1.22)} }
                        .cc-stem { transform-origin:40px 53px; animation:cc-sway 3s ease-in-out infinite; }
                        .cc-bud  { transform-origin:40px 29px; animation:cc-bud  2s ease-in-out infinite; }
                      `}</style>
                    </defs>
                    <circle cx="14" cy="14" r="2.2" fill="#FAC775"/>
                    <circle cx="66" cy="10" r="1.8" fill="#CECBF6"/>
                    <circle cx="68" cy="44" r="1.5" fill="#A8EDDA"/>
                    <circle cx="10" cy="46" r="1.4" fill="#CECBF6"/>
                    <path d="M30 58 L33 70 L47 70 L50 58 Z" fill="#BA7517" stroke="#854F0B" strokeWidth="0.9"/>
                    <rect x="27" y="53" width="26" height="6" rx="2.5" fill="#EF9F27" stroke="#BA7517" strokeWidth="0.9"/>
                    <ellipse cx="40" cy="53" rx="12" ry="2.2" fill="#854F0B" opacity="0.3"/>
                    <g className="cc-stem">
                      <path d="M40 52 L40 30" stroke="#4A8B1A" strokeWidth="2.2" strokeLinecap="round"/>
                      <path d="M40 40 Q28 30 26 18 Q38 22 40 40Z" fill="#5FAF22"/>
                      <path d="M40 40 Q28 30 26 18" stroke="#3B6D11" strokeWidth="0.7" fill="none"/>
                      <path d="M40 32 Q52 22 54 10 Q42 14 40 32Z" fill="#7DC444"/>
                      <path d="M40 32 Q52 22 54 10" stroke="#3B6D11" strokeWidth="0.7" fill="none"/>
                    </g>
                    <g className="cc-bud">
                      <circle cx="40" cy="29" r="3.5" fill="#A8EDDA" stroke="#1D9E75" strokeWidth="1"/>
                      <circle cx="40" cy="29" r="1.5" fill="#1D9E75"/>
                    </g>
                    <ellipse cx="40" cy="74" rx="16" ry="2.5" fill="#D3D1C7" opacity="0.22"/>
                  </svg>
                }
              >
                {result.newHoldings.map(h => (
                  <HoldingRow key={h.isin} h={h} variant="new" scale={scale} />
                ))}
              </CompareColumn>

              <CompareColumn
                title="Exited"
                count={result.exitedHoldings.length}
                color="red"
                icon={<TrendingDown className="w-4 h-4" />}
                empty="No exits this month"
                doodle={
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <style>{`
                        @keyframes cc-redglow  { 0%,100%{opacity:0.18} 50%{opacity:0.42} }
                        @keyframes cc-redpulse { 0%,100%{opacity:1}    50%{opacity:0.65} }
                        .cc-red-halo  { animation:cc-redglow  1.4s ease-in-out infinite; }
                        .cc-red-inner { animation:cc-redpulse 1.4s ease-in-out infinite; }
                      `}</style>
                    </defs>
                    <circle cx="10" cy="10" r="2" fill="#FAC775"/>
                    <circle cx="70" cy="10" r="1.8" fill="#CECBF6"/>
                    <circle cx="72" cy="42" r="1.6" fill="#F5A8A8"/>
                    <rect x="28" y="12" width="24" height="48" rx="9" fill="#2A2A2A" stroke="#555" strokeWidth="1.3"/>
                    <circle className="cc-red-halo" cx="40" cy="24" r="12" fill="#E05252"/>
                    <circle cx="40" cy="24" r="8" fill="#E05252"/>
                    <circle className="cc-red-inner" cx="40" cy="24" r="6" fill="#FF7070"/>
                    <circle cx="37" cy="21" r="2.5" fill="white" opacity="0.28"/>
                    <circle cx="40" cy="40" r="8" fill="#555"/>
                    <circle cx="40" cy="40" r="6" fill="#444"/>
                    <circle cx="40" cy="56" r="8" fill="#555"/>
                    <circle cx="40" cy="56" r="6" fill="#444"/>
                    <line x1="40" y1="60" x2="40" y2="70" stroke="#666" strokeWidth="3" strokeLinecap="round"/>
                    <rect x="30" y="68" width="20" height="5" rx="2.5" fill="#555"/>
                    <ellipse cx="40" cy="74" rx="14" ry="2.5" fill="#E05252" opacity="0.12"/>
                  </svg>
                }
              >
                {result.exitedHoldings.map(h => (
                  <HoldingRow key={h.isin} h={h} variant="exited" scale={scale} />
                ))}
              </CompareColumn>

              <CompareColumn
                title="Weight Changes"
                subtitle="Active buys / trims"
                count={result.weightChanges.length}
                color="blue"
                icon={<Minus className="w-4 h-4" />}
                empty="No weight changes detected"
                doodle={
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <style>{`
                        @keyframes cc-tick1 { 0%,100%{opacity:0.3} 50%{opacity:1} }
                        @keyframes cc-tick2 { 0%,100%{opacity:0.3} 50%{opacity:1} }
                        @keyframes cc-tick3 { 0%,100%{opacity:0.3} 50%{opacity:1} }
                        @keyframes cc-shine { 0%,100%{opacity:0}   40%{opacity:0.7} 60%{opacity:0.7} }
                        .cc-t1 { animation:cc-tick1 2.2s ease-in-out infinite; }
                        .cc-t2 { animation:cc-tick2 2.2s ease-in-out infinite 0.4s; }
                        .cc-t3 { animation:cc-tick3 2.2s ease-in-out infinite 0.8s; }
                        .cc-shine { animation:cc-shine 2.2s ease-in-out infinite; }
                      `}</style>
                    </defs>
                    <circle cx="10" cy="10" r="1.8" fill="#FAC775"/>
                    <circle cx="70" cy="8" r="1.5" fill="#CECBF6"/>
                    <circle cx="72" cy="50" r="1.4" fill="#AFA9EC"/>
                    <rect x="22" y="38" width="36" height="28" rx="5" fill="#E6F1FB" stroke="#378ADD" strokeWidth="1.5"/>
                    <path d="M30 38 L30 28 Q30 18 40 18 Q50 18 50 28 L50 38" fill="none" stroke="#378ADD" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M33 38 L33 28 Q33 22 40 22 Q47 22 47 28 L47 38" fill="none" stroke="#B3D4F5" strokeWidth="1" strokeLinecap="round"/>
                    <circle cx="40" cy="52" r="6" fill="#B3D4F5" stroke="#378ADD" strokeWidth="1"/>
                    <rect x="38" y="52" width="4" height="7" rx="1.5" fill="#378ADD"/>
                    <line className="cc-t1" x1="12" y1="52" x2="18" y2="52" stroke="#B3D4F5" strokeWidth="1.5" strokeLinecap="round"/>
                    <line className="cc-t2" x1="12" y1="46" x2="17" y2="46" stroke="#B3D4F5" strokeWidth="1.2" strokeLinecap="round"/>
                    <line className="cc-t3" x1="12" y1="58" x2="17" y2="58" stroke="#B3D4F5" strokeWidth="1.2" strokeLinecap="round"/>
                    <line className="cc-t1" x1="62" y1="52" x2="68" y2="52" stroke="#B3D4F5" strokeWidth="1.5" strokeLinecap="round"/>
                    <line className="cc-t2" x1="63" y1="46" x2="68" y2="46" stroke="#B3D4F5" strokeWidth="1.2" strokeLinecap="round"/>
                    <line className="cc-t3" x1="63" y1="58" x2="68" y2="58" stroke="#B3D4F5" strokeWidth="1.2" strokeLinecap="round"/>
                    <line className="cc-shine" x1="34" y1="44" x2="38" y2="44" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <ellipse cx="40" cy="70" rx="20" ry="3" fill="#D3D1C7" opacity="0.22"/>
                  </svg>
                }
              >
                {result.weightChanges.map(h => (
                  <HoldingRow key={h.isin} h={h} variant="changed" scale={scale} />
                ))}
              </CompareColumn>

              <CompareColumn
                title="NAV Drift"
                subtitle="Price-driven, quantity held"
                count={drifters2.length}
                color="amber"
                icon={<Activity className="w-4 h-4" />}
                empty="No significant drift (< 0.3%)"
                doodle={
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <style>{`
                        @keyframes cc-bob   { 0%,100%{transform:translateY(0px) rotate(-3deg)} 50%{transform:translateY(-5px) rotate(3deg)} }
                        @keyframes cc-chain { 0%,100%{opacity:0.35} 50%{opacity:0.85} }
                        .cc-anchor { transform-origin:40px 42px; animation:cc-bob   3s ease-in-out infinite; }
                        .cc-chain  { animation:cc-chain 3s ease-in-out infinite; }
                      `}</style>
                    </defs>
                    <circle cx="10" cy="10" r="1.8" fill="#FAC775"/>
                    <circle cx="70" cy="8" r="1.5" fill="#CECBF6"/>
                    <circle cx="72" cy="48" r="1.4" fill="#AFA9EC"/>
                    <circle cx="8" cy="50" r="1.3" fill="#CECBF6"/>
                    <g className="cc-anchor">
                      <circle cx="40" cy="24" r="8" fill="none" stroke="#BA7517" strokeWidth="2"/>
                      <circle cx="40" cy="24" r="3.5" fill="#FFF3CE" stroke="#BA7517" strokeWidth="1.5"/>
                      <line x1="40" y1="32" x2="40" y2="62" stroke="#BA7517" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="26" y1="22" x2="54" y2="22" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="26" cy="22" r="2.5" fill="#FAC775" stroke="#BA7517" strokeWidth="1"/>
                      <circle cx="54" cy="22" r="2.5" fill="#FAC775" stroke="#BA7517" strokeWidth="1"/>
                      <path d="M40 62 Q26 62 24 52 L30 54 L28 58 Q34 62 40 62Z" fill="#FFF3CE" stroke="#BA7517" strokeWidth="1.2"/>
                      <path d="M40 62 Q54 62 56 52 L50 54 L52 58 Q46 62 40 62Z" fill="#FFF3CE" stroke="#BA7517" strokeWidth="1.2"/>
                    </g>
                    <path className="cc-chain" d="M40 24 Q18 20 10 28" stroke="#FAC775" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="3 2"/>
                    <ellipse cx="40" cy="72" rx="18" ry="3" fill="#D3D1C7" opacity="0.22"/>
                  </svg>
                }
              >
                {drifters2.map(h => (
                  <HoldingRow key={h.isin} h={h} variant="drifted" scale={scale} />
                ))}
              </CompareColumn>
            </div>
          </div>
        );
      })()}

      {!result && !timelineResult && !loading && extractions.length < 2 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-3">
          {/* Bar charts doodle — month 1 solid bars, month 2 ghost bars */}
          <svg width="180" height="120" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes bc-ghost { 0%,100%{opacity:0.18} 50%{opacity:0.5} }
                @keyframes bc-glow  { 0%,100%{opacity:1} 50%{opacity:0.75} }
                .bc-ghost { animation: bc-ghost 2.4s ease-in-out infinite; }
                .bc-glow  { animation: bc-glow  2.4s ease-in-out infinite; }
              `}</style>
            </defs>

            {/* Axes */}
            <line x1="14" y1="8" x2="14" y2="66" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14" y1="66" x2="106" y2="66" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round"/>

            {/* Month 1 label */}
            <text x="34" y="75" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="6" fill="#6366f1" fontWeight="700">M1</text>
            {/* Month 2 label */}
            <text x="80" y="75" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="6" fill="#94a3b8" fontWeight="600">M2?</text>

            {/* Month 1 bars — solid, coloured */}
            <g className="bc-glow">
              <rect x="18" y="42" width="9" height="24" rx="1.5" fill="#818cf8"/>
              <rect x="30" y="28" width="9" height="38" rx="1.5" fill="#6366f1"/>
              <rect x="42" y="34" width="9" height="32" rx="1.5" fill="#4338ca"/>
            </g>

            {/* Month 2 bars — dashed ghost, pulsing */}
            <g className="bc-ghost">
              <rect x="64" y="20" width="9" height="46" rx="1.5" fill="none" stroke="#818cf8" strokeWidth="1.2" strokeDasharray="3 2"/>
              <rect x="76" y="32" width="9" height="34" rx="1.5" fill="none" stroke="#818cf8" strokeWidth="1.2" strokeDasharray="3 2"/>
              <rect x="88" y="26" width="9" height="40" rx="1.5" fill="none" stroke="#818cf8" strokeWidth="1.2" strokeDasharray="3 2"/>
            </g>

            {/* Divider between months */}
            <line x1="57" y1="14" x2="57" y2="66" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="2.5 2"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">Need at least 2 months of data</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">This fund has only {extractions.length} extraction{extractions.length !== 1 ? 's' : ''} available</p>
        </div>
      )}
    </div>
  );
}

// ─── CompareColumn ────────────────────────────────────────────────────────────

function CompareColumn({ title, subtitle, count, color, icon, children, empty, doodle }) {
  const colorMap = {
    green: { header: 'bg-green-50 border-green-200',   badge: 'bg-green-100 text-green-700',   title: 'text-green-800' },
    red:   { header: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-700',       title: 'text-red-800' },
    blue:  { header: 'bg-indigo-50 border-indigo-200',     badge: 'bg-indigo-100 text-indigo-700',     title: 'text-indigo-800' },
    amber: { header: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700',   title: 'text-amber-800' },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`p-4 border-b ${c.header}`}>
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1.5 font-semibold text-sm ${c.title}`}>
            {icon} {title}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{count}</span>
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {count === 0
          ? <div className="text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
              {doodle}
              {empty}
            </div>
          : children}
      </div>
    </div>
  );
}

// ─── HoldingRow ───────────────────────────────────────────────────────────────

function HoldingRow({ h, variant, scale }) {
  const pct            = (h.pct_nav      || 0) * scale;
  const prevPct        = (h.prev_pct_nav || 0) * scale;
  const delta          = (h.nav_delta    || 0) * scale;
  const navDeltaScaled = (h.nav_delta    || 0) * scale;

  return (
    <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-snug" title={h.stock_name}>
          {h.stock_name}
        </span>
      </div>

      {/* ISIN */}
      <div className="text-xs text-slate-400 font-mono mt-0.5">{h.isin}</div>

      {/* Delta / weight display */}
      <div className="mt-2 space-y-1">
        {variant === 'changed' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                h.action === 'added'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : h.action === 'isin_changed'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
                {h.action === 'added' ? '▲ Increased' : h.action === 'isin_changed' ? '⟳ ISIN Changed' : '▼ Trimmed'}
              </span>

              {h.action === 'isin_changed' ? (
                <span className="text-xs text-slate-400 font-mono truncate max-w-[160px]" title={`${h.prev_isin} → ${h.isin}`}>
                  {h.prev_isin} → {h.isin}
                </span>
              ) : (
                <>
                  <span className="text-xs text-slate-500">
                    {h.prev_quantity != null ? fmt(h.prev_quantity, 0) : '—'}
                    <span className="text-slate-500 mx-1">→</span>
                    <span className="font-semibold text-slate-700">
                      {h.quantity != null ? fmt(h.quantity, 0) : '—'}
                    </span>
                  </span>
                  {h.prev_quantity != null && h.quantity != null && (
                    <span className={`text-xs font-semibold ${h.qty_delta > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      ({h.qty_delta > 0 ? '+' : ''}{fmt(h.qty_delta, 0)})
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="text-xs text-slate-400">
              Weight: {fmt(prevPct)}%
              <span className="mx-1">→</span>
              {fmt(pct)}%
              <span className={`ml-1 font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                ({delta >= 0 ? '+' : ''}{fmt(delta)}%)
              </span>
            </div>
          </>
        ) : variant === 'drifted' ? (
          <div className="text-xs text-slate-400">
            Weight: {fmt(prevPct)}%
            <span className="mx-1">→</span>
            <span className="font-semibold text-slate-700">{fmt(pct)}%</span>
            <span className={`ml-1 font-medium ${navDeltaScaled > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
              ({navDeltaScaled >= 0 ? '+' : ''}{fmt(navDeltaScaled)}%)
            </span>
            <span className="ml-1.5 text-[10px] text-slate-300">qty unchanged</span>
          </div>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-600">{fmt(pct)}% NAV</div>
            {(variant === 'new' || variant === 'exited') && h.quantity != null && (
              <div className="text-xs text-slate-500">
                Quantity: <span className="font-semibold text-slate-700">{fmt(h.quantity, 0)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Industry tag */}
      {h.industry && (
        <span className={`inline-flex mt-1.5 items-center px-1.5 py-0.5 rounded border text-xs font-medium ${industryBadgeClass(h.industry)}`}>
          {h.industry}
        </span>
      )}
    </div>
  );
}
