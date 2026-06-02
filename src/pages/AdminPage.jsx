import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import UploadTab from '../components/admin/UploadTab.jsx';
import {
  adminGetIsinIssues, adminRemapIsin,
  adminGetNameIssues, adminFixName,
  adminScanOverlapping,
  adminGetFunds, adminGetFundMonths, adminRenameFund, adminMergeFunds, adminDeleteFund,
  adminGetFundExtractions, adminDeleteExtraction,
  adminBulkDeleteFunds, adminBulkDeleteExtractions,
  adminGetFundGaps,
  adminGetCacheStats, adminClearCache, adminSetCacheEnabled,
  getNavMappings, autoMatchNav, confirmNavMapping, syncNavFund, syncAllNav, searchNavSchemes, removeNavMapping, syncLatestNav, adminGetCounts,
} from '../api/client.js';
import api from '../api/client.js';
import { AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Settings, X, Search, Activity, TrendingUp, Lock, Unlock } from 'lucide-react';

const ADMIN_EMAIL = 'ashikahmed001@gmail.com';

// ─── Shared helpers ───────────────────────────────────────────────────────────
function fmtMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium
      ${ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, ok = true) => setToast({ msg, ok });
  const hide = () => setToast(null);
  return { toast, show, hide };
}

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />;
}

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, color = 'amber' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    red:   'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

// ─── Searchable Fund Select ───────────────────────────────────────────────────
function FundSelect({ funds, value, onChange, placeholder = 'Search fund…', exclude = [] }) {
  const [query, setQuery]     = useState('');
  const [open, setOpen]       = useState(false);
  const containerRef          = useRef(null);
  const inputRef              = useRef(null);

  const selected = funds.find(f => String(f.id) === String(value));

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = funds
    .filter(f => !exclude.includes(String(f.id)))
    .filter(f => f.name.toLowerCase().includes(query.toLowerCase()));

  function select(fund) {
    onChange(String(fund.id));
    setQuery('');
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  function handleInputClick() {
    setOpen(true);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <div
        onClick={handleInputClick}
        className={`flex items-center gap-2 bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 cursor-text transition-colors
          ${open ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selected ? selected.name : placeholder}
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 min-w-0"
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
            {selected ? selected.name : placeholder}
          </span>
        )}
        {selected
          ? <button onClick={clear} className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:text-slate-500"><X className="w-3.5 h-3.5" /></button>
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        }
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">No funds match "{query}"</div>
          ) : (
            filtered.map(f => (
              <button
                key={f.id}
                onMouseDown={e => { e.preventDefault(); select(f); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors
                  ${String(f.id) === String(value) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-800 dark:text-slate-200'}`}
              >
                {f.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: ISIN Remap ──────────────────────────────────────────────────────────
function IsinRemapTab({ onCountChange }) {
  const [issues, setIssues]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState({});
  const [pending, setPending]   = useState({});
  const { show, toast, hide }   = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setIssues(await adminGetIsinIssues()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function applyRemap(old_isin, new_isin) {
    const key = `${old_isin}→${new_isin}`;
    setPending(p => ({ ...p, [key]: true }));
    try {
      const r = await adminRemapIsin(old_isin, new_isin);
      show(`Remapped ${old_isin} → ${new_isin}  (${r.moved} rows moved)`);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setPending(p => { const n = { ...p }; delete n[key]; return n; });
    }
  }

  return (
    <div>
      {toast && <Toast {...toast} onClose={hide} />}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">
          Equity ISINs sharing the same company code (face-value splits). Expand a company and apply the old → new merge.
        </p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          No ISIN conflicts found
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map(({ company_code, isins }) => {
            const open = expanded[company_code];
            return (
              <SectionCard key={company_code}>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [company_code]: !open }))}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 rounded-2xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {open
                      ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{company_code}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{isins[0].stock_name}</span>
                    <Badge color="amber">{isins.length} ISINs</Badge>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* ISIN detail rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {isins.map(isin => (
                        <div key={isin.isin} className="px-5 py-3 flex items-center gap-4">
                          <span className="font-mono text-sm text-indigo-600 w-36 shrink-0">{isin.isin}</span>
                          <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs w-36 shrink-0">{fmtMonth(isin.first_month)} → {fmtMonth(isin.last_month)}</span>
                          <span className="text-slate-400 dark:text-slate-500 text-xs w-20 shrink-0">{isin.row_count} rows</span>
                          <span className="text-slate-700 dark:text-slate-300 text-sm flex-1">{isin.stock_name}</span>
                        </div>
                      ))}
                    </div>
                    {/* Remap buttons */}
                    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">Apply remap:</span>
                      {isins.flatMap((old_r, i) =>
                        isins.slice(i + 1).map(new_r => {
                          const key = `${old_r.isin}→${new_r.isin}`;
                          return (
                            <button
                              key={key}
                              disabled={!!pending[key]}
                              onClick={() => applyRemap(old_r.isin, new_r.isin)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                            >
                              {pending[key] ? <Spinner /> : null}
                              <span className="font-mono">{old_r.isin}</span>
                              <span>→</span>
                              <span className="font-mono">{new_r.isin}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Name Normalisation ──────────────────────────────────────────────────
function NameNormTab({ onCountChange }) {
  const [issues, setIssues]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState({});
  const [pending, setPending]     = useState({});
  const [selected, setSelected]     = useState(new Set()); // set of ISINs
  const [bulkRunning, setBulkRunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { show, toast, hide }         = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try { setIssues(await adminGetNameIssues()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fix a single ISIN to the given name
  async function applyFix(isin, name) {
    const key = `${isin}:${name}`;
    setPending(p => ({ ...p, [key]: true }));
    try {
      const r = await adminFixName(isin, name);
      show(`Updated ${r.rows_updated} rows for ${isin}`);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setPending(p => { const n = { ...p }; delete n[key]; return n; });
    }
  }

  // Fix all selected ISINs — pick the variant with the most rows
  async function fixSelected() {
    if (!selected.size) return;
    setBulkRunning(true);
    let fixed = 0, failed = 0;
    for (const isin of selected) {
      const issue = issues.find(i => i.isin === isin);
      if (!issue) continue;
      // Sort by row_count desc, pick the winner
      const winner = [...issue.names].sort((a, b) => b.row_count - a.row_count)[0];
      try {
        await adminFixName(isin, winner.stock_name);
        fixed++;
      } catch { failed++; }
    }
    show(`Fixed ${fixed} ISIN${fixed !== 1 ? 's' : ''}${failed ? ` · ${failed} failed` : ''}`, failed === 0);
    await load();
    onCountChange?.();
    setBulkRunning(false);
  }

  const allIsins  = issues.map(i => i.isin);
  const allSelected = allIsins.length > 0 && allIsins.every(i => selected.has(i));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIsins));
  }

  function toggleOne(isin) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(isin) ? next.delete(isin) : next.add(isin);
      return next;
    });
  }

  return (
    <div>
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Bulk fix confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Fix {selected.size} ISIN{selected.size !== 1 ? 's' : ''}?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Each selected ISIN will be normalised to its <span className="font-medium text-slate-700 dark:text-slate-200">most common name variant</span> (highest row count). All other variants will be overwritten.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-5 max-h-40 overflow-y-auto space-y-1">
              {[...selected].map(isin => {
                const issue  = issues.find(i => i.isin === isin);
                const winner = issue ? [...issue.names].sort((a, b) => b.row_count - a.row_count)[0] : null;
                return (
                  <div key={isin} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">{isin}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{winner?.stock_name}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); fixSelected(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                Confirm & fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          ISINs appearing under multiple name variants.
        </p>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={bulkRunning}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {bulkRunning ? <Spinner /> : <CheckCircle className="w-3 h-3" />}
              Fix {selected.size} selected — use most common name
            </button>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          No name conflicts found
        </div>
      ) : (
        <>
          {/* Select all bar */}
          <div className="flex items-center gap-3 px-2 pb-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selected.size > 0 ? `${selected.size} of ${issues.length} selected` : `Select all (${issues.length})`}
            </span>
          </div>

          <div className="space-y-2">
            {issues.map(({ isin, names }) => {
              const open     = expanded[isin];
              const isSelected = selected.has(isin);
              // Winner = most rows
              const winner   = [...names].sort((a, b) => b.row_count - a.row_count)[0];
              return (
                <SectionCard key={isin}>
                  <div className="flex items-center gap-3 px-5 py-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(isin)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                    />
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [isin]: !open }))}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      {open
                        ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">{isin}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{winner.stock_name}</span>
                      <Badge color="amber">{names.length} variants</Badge>
                    </button>
                  </div>

                  {open && (
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                      {[...names].sort((a, b) => b.row_count - a.row_count).map(n => {
                        const isWinner = n.stock_name === winner.stock_name;
                        return (
                          <div key={n.stock_name} className={`px-5 py-3 flex items-center gap-4 ${isWinner ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                            <span className="text-slate-800 dark:text-slate-200 text-sm flex-1 flex items-center gap-2">
                              {n.stock_name}
                              {isWinner && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">most rows</span>}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs w-36 shrink-0 text-right">{fmtMonth(n.first_month)} → {fmtMonth(n.last_month)}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs w-16 shrink-0 text-right">{n.row_count} rows</span>
                            <button
                              disabled={!!pending[`${isin}:${n.stock_name}`]}
                              onClick={() => applyFix(isin, n.stock_name)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shrink-0"
                            >
                              {pending[`${isin}:${n.stock_name}`] ? <Spinner /> : null}
                              Use this name
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Duplicate Scanner ───────────────────────────────────────────────────
function ScannerTab() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [scanned, setScanned]       = useState(false);
  const [pending, setPending]       = useState({});
  const { show, toast, hide }       = useToast();

  async function runScan() {
    setLoading(true);
    setScanned(false);
    try { setCandidates(await adminScanOverlapping()); setScanned(true); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }

  async function applyRemap(old_isin, new_isin) {
    const key = `${old_isin}→${new_isin}`;
    setPending(p => ({ ...p, [key]: true }));
    try {
      const r = await adminRemapIsin(old_isin, new_isin);
      show(`Remapped ${old_isin} → ${new_isin}  (${r.moved} rows moved)`);
      setCandidates(c => c.filter(x => x.old_isin !== old_isin || x.new_isin !== new_isin));
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setPending(p => { const n = { ...p }; delete n[key]; return n; });
    }
  }

  const overlapping = candidates.filter(c => c.overlapping);
  const sequential  = candidates.filter(c => !c.overlapping);

  return (
    <div>
      {toast && <Toast {...toast} onClose={hide} />}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">
          Scan for all ISIN pairs sharing the same company code — catches face-value splits the automated importer missed.
        </p>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
        >
          {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {!scanned && !loading && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">Click "Run Scan" to find candidates.</div>
      )}

      {scanned && candidates.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          No candidates found
        </div>
      )}

      {scanned && candidates.length > 0 && (
        <div className="space-y-6">
          {overlapping.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Overlapping transitions — {overlapping.length} candidates
                </h3>
                <Badge color="amber">old + new coexist</Badge>
              </div>
              <CandidateTable rows={overlapping} pending={pending} onRemap={applyRemap} />
            </div>
          )}
          {sequential.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Sequential transitions — {sequential.length} candidates
              </h3>
              <CandidateTable rows={sequential} pending={pending} onRemap={applyRemap} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateTable({ rows, pending, onRemap }) {
  return (
    <SectionCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Old ISIN</th>
            <th className="px-4 py-3 font-medium">New ISIN</th>
            <th className="px-4 py-3 font-medium">Old range</th>
            <th className="px-4 py-3 font-medium">New range</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map(c => {
            const key = `${c.old_isin}→${c.new_isin}`;
            return (
              <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.stock_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">{c.old_isin}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{c.new_isin}</td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtMonth(c.old_first)}→{fmtMonth(c.old_last)} <span className="text-slate-400 dark:text-slate-500">({c.old_months}mo)</span></td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtMonth(c.new_first)}→{fmtMonth(c.new_last)} <span className="text-slate-400 dark:text-slate-500">({c.new_months}mo)</span></td>
                <td className="px-4 py-3">
                  <button
                    disabled={!!pending[key]}
                    onClick={() => onRemap(c.old_isin, c.new_isin)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                  >
                    {pending[key] ? <Spinner /> : null}
                    Apply
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SectionCard>
  );
}

// ─── Confirm Merge Modal ──────────────────────────────────────────────────────
function ConfirmMergeModal({ source, target, sourceMonths, targetMonths, onConfirm, onCancel, loading }) {
  const sourceSet  = new Set(sourceMonths);
  const targetSet  = new Set(targetMonths);
  const moving     = sourceMonths.filter(m => !targetSet.has(m));
  const conflicts  = sourceMonths.filter(m => targetSet.has(m));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Confirm fund merge</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 ml-12">This action is permanent and cannot be undone.</p>
        </div>

        {/* Fund flow */}
        <div className="mx-6 mb-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">Source — will be deleted</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{source?.name}</p>
            </div>
            <span className="text-slate-300 text-base shrink-0">→</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">Target — will be kept</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{target?.name}</p>
            </div>
          </div>
        </div>

        {/* What will happen */}
        <div className="mx-6 mb-5 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">What will happen</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-indigo-600">{moving.length} month{moving.length !== 1 ? 's' : ''}</span> will move from source to target
              </span>
            </div>
            {conflicts.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-red-600">{conflicts.length} conflicting month{conflicts.length !== 1 ? 's' : ''}</span> will be dropped (already in target)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 text-emerald-700 font-medium">No conflicts — clean merge</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">
                Fund record <span className="font-semibold">"{source?.name}"</span> will be permanently deleted
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {loading ? <Spinner /> : null}
            Merge funds
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Calendar ───────────────────────────────────────────────────────────
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MergeCalendar({ sourceMonths, targetMonths }) {
  const sourceSet = new Set(sourceMonths);
  const targetSet = new Set(targetMonths);
  const allMonths = [...new Set([...sourceMonths, ...targetMonths])].sort();
  if (!allMonths.length) return null;

  // Group by year
  const byYear = {};
  for (const m of allMonths) {
    const y = m.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  }

  const conflicts  = allMonths.filter(m => sourceSet.has(m) && targetSet.has(m));
  const moving     = allMonths.filter(m => sourceSet.has(m) && !targetSet.has(m));
  const targetOnly = allMonths.filter(m => !sourceSet.has(m) && targetSet.has(m));

  return (
    <div className="mt-5 space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Source only — will move ({moving.length})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Target only — already there ({targetOnly.length})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Conflict — will be dropped ({conflicts.length})</span>
      </div>

      {/* Year grids */}
      {Object.entries(byYear).map(([year, months]) => {
        const monthNums = months.map(m => parseInt(m.slice(5, 7)) - 1); // 0-indexed
        return (
          <div key={year} className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 w-8 shrink-0">{year}</span>
            <div className="grid grid-cols-12 gap-1 flex-1">
              {MONTH_LABELS.map((lbl, idx) => {
                const isoMonth = `${year}-${String(idx + 1).padStart(2, '0')}-01`;
                const inSource = sourceSet.has(isoMonth);
                const inTarget = targetSet.has(isoMonth);
                const conflict = inSource && inTarget;
                const srcOnly  = inSource && !inTarget;
                const tgtOnly  = !inSource && inTarget;
                const empty    = !inSource && !inTarget;

                let bg, text;
                if (conflict)   { bg = 'bg-red-100 border-red-300';       text = 'text-red-700'; }
                else if (srcOnly) { bg = 'bg-indigo-100 border-indigo-300';   text = 'text-indigo-700'; }
                else if (tgtOnly) { bg = 'bg-emerald-100 border-emerald-300'; text = 'text-emerald-700'; }
                else              { bg = 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';  text = 'text-slate-300'; }

                return (
                  <div
                    key={idx}
                    title={empty ? '' : `${lbl} ${year}${conflict ? ' — CONFLICT' : srcOnly ? ' — source' : ' — target'}`}
                    className={`border rounded text-center py-1 text-[10px] font-medium select-none ${bg} ${text} ${empty ? 'opacity-40' : ''}`}
                  >
                    {lbl}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary pill */}
      <div className="flex items-center gap-3 pt-1 text-xs">
        {moving.length > 0 && (
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full font-medium">
            {moving.length} months will move
          </span>
        )}
        {conflicts.length > 0 && (
          <span className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full font-medium">
            {conflicts.length} conflicts will be dropped
          </span>
        )}
        {conflicts.length === 0 && moving.length > 0 && (
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-medium">
            ✓ No conflicts — clean merge
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Fund Management ─────────────────────────────────────────────────────
function FundMgmtTab() {
  const [funds, setFunds]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [renameId, setRenameId]       = useState(null);
  const [renameName, setRenameName]   = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [sourceMonths, setSourceMonths] = useState([]);
  const [targetMonths, setTargetMonths] = useState([]);
  const [calLoading, setCalLoading]   = useState(false);
  const [merging, setMerging]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [filter, setFilter]           = useState('');
  const [deleteId, setDeleteId]         = useState(null); // fund pending delete confirmation
  const [deleting, setDeleting]         = useState(false);
  const [expandedFund, setExpandedFund]   = useState(null);
  const [extractions, setExtractions]     = useState([]);
  const [extLoading, setExtLoading]       = useState(false);
  const [deleteExtId, setDeleteExtId]     = useState(null);
  const [deletingExt, setDeletingExt]     = useState(false);
  // Multi-select
  const [selectedFunds, setSelectedFunds]   = useState(new Set());
  const [selectedExts, setSelectedExts]     = useState(new Set());
  const [bulkConfirm, setBulkConfirm]       = useState(null); // 'funds' | 'extractions'
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const { show, toast, hide }         = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setFunds(await adminGetFunds()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch months for both funds whenever either selection changes
  useEffect(() => {
    if (!mergeSource && !mergeTarget) { setSourceMonths([]); setTargetMonths([]); return; }
    setCalLoading(true);
    Promise.all([
      mergeSource ? adminGetFundMonths(mergeSource).then(r => r.months) : Promise.resolve([]),
      mergeTarget ? adminGetFundMonths(mergeTarget).then(r => r.months) : Promise.resolve([]),
    ]).then(([sm, tm]) => {
      setSourceMonths(sm);
      setTargetMonths(tm);
    }).catch(e => show(e.response?.data?.error || e.message, false))
      .finally(() => setCalLoading(false));
  }, [mergeSource, mergeTarget]);

  async function saveRename() {
    if (!renameName.trim()) return;
    setSaving(true);
    try {
      const r = await adminRenameFund(renameId, renameName);
      show(`Renamed to "${r.new_name}"`);
      setRenameId(null);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await adminDeleteFund(deleteId);
      show(`Deleted "${r.name}" — ${r.extractions_deleted} extractions removed`);
      setDeleteId(null);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setDeleting(false); }
  }

  async function toggleExpand(fundId) {
    if (expandedFund === fundId) { setExpandedFund(null); setExtractions([]); return; }
    setExpandedFund(fundId);
    setExtractions([]);
    setExtLoading(true);
    try { setExtractions(await adminGetFundExtractions(fundId)); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setExtLoading(false); }
  }

  async function confirmDeleteExtraction() {
    if (!deleteExtId) return;
    setDeletingExt(true);
    try {
      const r = await adminDeleteExtraction(deleteExtId);
      show(`Deleted ${fmtMonth(r.report_month)} — ${r.holdings_deleted} holdings removed`);
      setDeleteExtId(null);
      // Refresh extractions list and fund list
      setExtractions(await adminGetFundExtractions(expandedFund));
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setDeletingExt(false); }
  }

  async function doBulkDelete() {
    setBulkDeleting(true);
    try {
      if (bulkConfirm === 'funds') {
        const r = await adminBulkDeleteFunds([...selectedFunds]);
        show(`Deleted ${r.deleted} fund${r.deleted !== 1 ? 's' : ''} — ${r.extractions_deleted} extractions removed`);
        setSelectedFunds(new Set());
        setExpandedFund(null);
        setExtractions([]);
      } else {
        const r = await adminBulkDeleteExtractions([...selectedExts]);
        show(`Deleted ${r.deleted} extraction${r.deleted !== 1 ? 's' : ''}`);
        setSelectedExts(new Set());
        setExtractions(await adminGetFundExtractions(expandedFund));
      }
      setBulkConfirm(null);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setBulkDeleting(false); }
  }

  function toggleFundSelect(id) {
    setSelectedFunds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleExtSelect(id) {
    setSelectedExts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllFunds() {
    setSelectedFunds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(f => f.id)));
  }
  function toggleAllExts() {
    setSelectedExts(prev => prev.size === extractions.length ? new Set() : new Set(extractions.map(e => e.id)));
  }

  async function applyMerge() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) {
      show('Select two different funds to merge', false); return;
    }
    setShowConfirm(true);
  }

  async function doMerge() {
    setMerging(true);
    try {
      const r = await adminMergeFunds(+mergeSource, +mergeTarget);
      show(`Merged "${r.source.name}" → "${r.target.name}"  (${r.extractions_moved} months moved)`);
      setMergeSource(''); setMergeTarget('');
      setSourceMonths([]); setTargetMonths([]);
      setShowConfirm(false);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setMerging(false); }
  }

  const filtered    = funds.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
  const showCalendar = (mergeSource || mergeTarget) && (sourceMonths.length > 0 || targetMonths.length > 0);
  const sourceFund  = funds.find(f => String(f.id) === mergeSource);
  const targetFund  = funds.find(f => String(f.id) === mergeTarget);

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Delete confirmation modal */}
      {deleteId && (() => {
        const fund = funds.find(f => f.id === deleteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete fund permanently?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5 text-sm">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{fund?.name}</p>
                <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
                  {fund?.extraction_count} months · {(fund?.total_holdings || 0).toLocaleString()} holdings — all will be deleted.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete fund'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Extraction delete confirmation modal */}
      {deleteExtId && (() => {
        const ext = extractions.find(e => e.id === deleteExtId);
        const fund = funds.find(f => f.id === expandedFund);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete extraction?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5 text-sm">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{fund?.name}</p>
                <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
                  {fmtMonth(ext?.report_month)} · {Number(ext?.holding_count || 0).toLocaleString()} holdings will be deleted.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteExtId(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteExtraction}
                  disabled={deletingExt}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {deletingExt ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk delete confirmation modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {bulkConfirm === 'funds'
                    ? `Delete ${selectedFunds.size} fund${selectedFunds.size !== 1 ? 's' : ''} permanently?`
                    : `Delete ${selectedExts.size} extraction${selectedExts.size !== 1 ? 's' : ''} permanently?`}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5 text-sm">
              {bulkConfirm === 'funds' ? (
                <>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Funds to be deleted:</p>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                    {[...selectedFunds].map(id => {
                      const f = funds.find(x => x.id === id);
                      return f ? (
                        <li key={id} className="text-slate-600 dark:text-slate-400 dark:text-slate-500 text-xs flex justify-between">
                          <span>{f.name}</span>
                          <span className="text-slate-400 dark:text-slate-500">{f.extraction_count} months</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs mt-2">All extractions and holdings will be permanently removed.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Extractions to be deleted:</p>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                    {[...selectedExts].map(id => {
                      const ext = extractions.find(x => x.id === id);
                      return ext ? (
                        <li key={id} className="text-slate-600 dark:text-slate-400 dark:text-slate-500 text-xs flex justify-between">
                          <span>{fmtMonth(ext.report_month)}</span>
                          <span className="text-slate-400 dark:text-slate-500">{Number(ext.holding_count).toLocaleString()} holdings</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs mt-2">All holdings in these extractions will be permanently removed.</p>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkConfirm(null)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {bulkDeleting ? 'Deleting…' : bulkConfirm === 'funds'
                  ? `Yes, delete ${selectedFunds.size} fund${selectedFunds.size !== 1 ? 's' : ''}`
                  : `Yes, delete ${selectedExts.size} extraction${selectedExts.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <ConfirmMergeModal
          source={sourceFund}
          target={targetFund}
          sourceMonths={sourceMonths}
          targetMonths={targetMonths}
          onConfirm={doMerge}
          onCancel={() => setShowConfirm(false)}
          loading={merging}
        />
      )}

      {/* Merge panel */}
      <SectionCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Merge two funds</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-4">
          The source fund's history is moved into the target fund. Conflicting months are dropped. The source fund record is deleted.
        </p>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-52">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 mb-1">Source (will be deleted)</label>
            <FundSelect
              funds={funds}
              value={mergeSource}
              onChange={setMergeSource}
              placeholder="Search funds…"
              exclude={mergeTarget ? [mergeTarget] : []}
            />
          </div>
          <div className="text-slate-400 dark:text-slate-500 pb-2 text-lg">→</div>
          <div className="flex-1 min-w-52">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 mb-1">Target (kept)</label>
            <FundSelect
              funds={funds}
              value={mergeTarget}
              onChange={setMergeTarget}
              placeholder="Search funds…"
              exclude={mergeSource ? [mergeSource] : []}
            />
          </div>
          <button
            onClick={applyMerge}
            disabled={merging || !mergeSource || !mergeTarget}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {merging ? <Spinner /> : null}
            Merge
          </button>
        </div>

        {/* Calendar */}
        {calLoading && (
          <div className="flex items-center gap-2 mt-5 text-sm text-slate-400 dark:text-slate-500">
            <Spinner /> Loading months…
          </div>
        )}
        {!calLoading && showCalendar && (
          <MergeCalendar sourceMonths={sourceMonths} targetMonths={targetMonths} />
        )}
      </SectionCard>

      {/* Fund list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">All funds <span className="text-slate-400 dark:text-slate-500 font-normal">({funds.length})</span></h3>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter funds…"
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        {/* Fixed bottom bulk-action bar — funds */}
        {selectedFunds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700 min-w-80">
            <div className="flex items-center gap-2.5 flex-1">
              <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-bold">{selectedFunds.size}</span>
              <span className="text-sm font-medium">fund{selectedFunds.size !== 1 ? 's' : ''} selected</span>
            </div>
            <button onClick={() => setSelectedFunds(new Set())} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              Clear
            </button>
            <button onClick={() => setBulkConfirm('funds')} className="text-xs px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 font-semibold transition-colors">
              Delete {selectedFunds.size} fund{selectedFunds.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Fixed bottom bulk-action bar — extractions */}
        {selectedExts.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700 min-w-80">
            <div className="flex items-center gap-2.5 flex-1">
              <span className="w-5 h-5 rounded-full bg-violet-400 flex items-center justify-center text-[11px] font-bold">{selectedExts.size}</span>
              <span className="text-sm font-medium">extraction{selectedExts.size !== 1 ? 's' : ''} selected</span>
            </div>
            <button onClick={() => setSelectedExts(new Set())} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              Clear
            </button>
            <button onClick={() => setBulkConfirm('extractions')} className="text-xs px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 font-semibold transition-colors">
              Delete {selectedExts.size} extraction{selectedExts.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <SectionCard>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox"
                      checked={filtered.length > 0 && selectedFunds.size === filtered.length}
                      onChange={toggleAllFunds}
                      className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Fund name</th>
                  <th className="px-4 py-3 font-medium text-right">Months</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Range</th>
                  <th className="px-4 py-3 font-medium text-right">Holdings</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const isExpanded = expandedFund === f.id;
                  const isSelected = selectedFunds.has(f.id);
                  const inBulkMode = selectedFunds.size > 0;
                  return (
                    <Fragment key={f.id}>
                      {/* Fund row */}
                      <tr className={`border-t border-slate-100 dark:border-slate-800 transition-colors
                        ${isSelected ? 'bg-indigo-50' : isExpanded ? 'bg-slate-50 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900'}`}
                      >
                        {/* Checkbox — with left accent when selected */}
                        <td className={`pl-0 pr-2 py-3 w-10 relative ${isSelected ? 'border-l-[3px] border-indigo-500' : 'border-l-[3px] border-transparent'}`}>
                          <div className="pl-3">
                            <input type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFundSelect(f.id)}
                              onClick={e => e.stopPropagation()}
                              className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                            />
                          </div>
                        </td>
                        {/* Expand toggle + name */}
                        <td className="px-4 py-3">
                          {renameId === f.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={renameName}
                                onChange={e => setRenameName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenameId(null); }}
                                className="border border-indigo-400 ring-1 ring-indigo-200 text-slate-900 dark:text-slate-100 text-sm rounded-lg px-2 py-1 w-80 focus:outline-none"
                              />
                              <button onClick={saveRename} disabled={saving}
                                className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">
                                {saving ? <Spinner /> : 'Save'}
                              </button>
                              <button onClick={() => setRenameId(null)}
                                className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-400 dark:text-slate-500 rounded-lg">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleExpand(f.id)}
                              className="flex items-center gap-2 text-left w-full group"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                              <span className={`font-medium transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-900 dark:text-slate-100 group-hover:text-indigo-700'}`}>{f.name}</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 dark:text-slate-500">{f.extraction_count}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 whitespace-nowrap">{fmtMonth(f.first_month)} → {fmtMonth(f.last_month)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 dark:text-slate-500">{(f.total_holdings || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {/* Hide per-row actions while in bulk-select mode */}
                          {renameId !== f.id && !inBulkMode && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setRenameId(f.id); setRenameName(f.name); }}
                                className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-400 dark:text-slate-500 rounded-lg transition-colors font-medium"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => setDeleteId(f.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors font-medium border border-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Extractions drawer */}
                      {isExpanded && (
                        <tr className="border-t border-slate-100 dark:border-slate-800">
                          <td colSpan={6} className="px-0 py-0 bg-slate-50 dark:bg-slate-900">
                            <div className="mx-6 my-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Extractions — {f.name}</p>
                                <div className="flex items-center gap-2">
                                  {extLoading && <Spinner />}
                                </div>
                              </div>
                              {extractions.length === 0 && !extLoading ? (
                                <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500">No extractions found.</p>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                      <th className="pl-4 pr-2 py-2 w-8">
                                        <input type="checkbox"
                                          checked={extractions.length > 0 && selectedExts.size === extractions.length}
                                          onChange={toggleAllExts}
                                          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                                        />
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Month</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Holdings</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">ID</th>
                                      <th className="px-4 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {extractions.map(ext => {
                                      const extSelected = selectedExts.has(ext.id);
                                      const extBulkMode = selectedExts.size > 0;
                                      return (
                                        <tr key={ext.id} className={`transition-colors ${extSelected ? 'bg-indigo-50' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900'}`}>
                                          <td className={`pl-0 pr-2 py-2 w-10 ${extSelected ? 'border-l-[3px] border-indigo-400' : 'border-l-[3px] border-transparent'}`}>
                                            <div className="pl-3">
                                              <input type="checkbox"
                                                checked={extSelected}
                                                onChange={() => toggleExtSelect(ext.id)}
                                                className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                                              />
                                            </div>
                                          </td>
                                          <td className={`px-4 py-2 font-medium ${extSelected ? 'text-indigo-700' : 'text-slate-700 dark:text-slate-300'}`}>{fmtMonth(ext.report_month)}</td>
                                          <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400 dark:text-slate-500">{Number(ext.holding_count).toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-slate-400 dark:text-slate-500 font-mono text-xs">{ext.id}</td>
                                          <td className="px-4 py-2 text-right">
                                            {!extBulkMode && (
                                              <button
                                                onClick={() => setDeleteExtId(ext.id)}
                                                className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors font-medium border border-red-100"
                                              >
                                                Delete
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ─── Scheme Search Dropdown ───────────────────────────────────────────────────
function SchemeSearchDropdown({ fundName, value, onChange }) {
  const [query, setQuery]         = useState(value?.scheme_name || fundName || '');
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const debounceRef               = useRef(null);
  const containerRef              = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch on mount with fund name
  useEffect(() => {
    if (fundName) doSearch(fundName);
  }, []);

  function doSearch(q) {
    if (!q.trim()) return;
    setLoading(true);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchNavSchemes(q, fundName);
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }

  function handleInput(e) {
    setQuery(e.target.value);
    doSearch(e.target.value);
  }

  function select(scheme) {
    onChange({ scheme_code: scheme.scheme_code, scheme_name: scheme.scheme_name });
    setQuery(scheme.scheme_name);
    setOpen(false);
  }

  const lower = (s = '') => s.toLowerCase();
  function planBadge(name) {
    const n = lower(name);
    if (n.includes('direct') && n.includes('growth'))  return { label: 'Direct Growth',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (n.includes('direct') && n.includes('idcw'))    return { label: 'Direct IDCW',    cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (n.includes('growth'))                           return { label: 'Regular Growth', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    if (n.includes('idcw') || n.includes('dividend'))  return { label: 'IDCW',           cls: 'bg-red-50 text-red-600 border-red-200' };
    return null;
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 transition-colors ${open ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200 dark:border-slate-700'}`}>
        <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          value={query}
          onChange={handleInput}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder="Search scheme name…"
          className="flex-1 text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400"
        />
        {loading && <span className="w-3 h-3 border border-slate-300 border-t-blue-500 rounded-full animate-spin shrink-0" />}
      </div>

      {/* Selected scheme code pill */}
      {value?.scheme_code && (
        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 pl-1">{value.scheme_code}</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.map(r => {
            const badge = planBadge(r.scheme_name);
            const isSelected = value?.scheme_code === r.scheme_code;
            return (
              <button
                key={r.scheme_code}
                onMouseDown={e => { e.preventDefault(); select(r); }}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors border-b border-slate-50 last:border-0 ${isSelected ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-800 dark:text-slate-200 leading-snug flex-1">{r.scheme_name}</span>
                  {badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{r.scheme_code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: NAV Mapping ─────────────────────────────────────────────────────────
function NavTab({ onCountChange }) {
  const [mappings, setMappings]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [matching, setMatching]           = useState(false);
  const [syncingAll, setSyncingAll]       = useState(false);
  const [syncingLatest, setSyncingLatest] = useState(false);
  const [syncingId, setSyncingId]         = useState(null);
  const [editRow, setEditRow]             = useState(null);
  const [removeTarget, setRemoveTarget]   = useState(null); // { id, name }
  const [removing, setRemoving]           = useState(false);
  const [search, setSearch]               = useState('');
  const { show, toast, hide }             = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setMappings(await getNavMappings()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function fetchLatest() {
    setSyncingLatest(true);
    try {
      const r = await syncLatestNav();
      show(r.message || 'NAV sync started in background');
      setTimeout(load, 5000); // refresh table after a few seconds
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setSyncingLatest(false);
    }
  }

  async function runAutoMatch() {
    setMatching(true);
    try {
      const results = await autoMatchNav();
      const matched = results.filter(r => r.candidates?.length > 0).length;
      show(`Auto-match done — ${matched} of ${results.length} funds matched`);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setMatching(false); }
  }

  async function syncFund(fundId) {
    setSyncingId(fundId);
    try {
      const r = await syncNavFund(fundId);
      show(`Synced — ${r.nav_rows} NAV rows stored`);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setSyncingId(null); }
  }

  async function runSyncAll() {
    setSyncingAll(true);
    try {
      const results = await syncAllNav();
      const ok = results.filter(r => r.ok).length;
      show(`Sync-all done — ${ok} of ${results.length} funds synced`);
      await load();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setSyncingAll(false); }
  }

  async function saveEdit() {
    if (!editRow?.scheme_code || !editRow?.scheme_name) return;
    try {
      await confirmNavMapping(editRow.fund_id, editRow.scheme_code, editRow.scheme_name);
      show('Mapping confirmed');
      setEditRow(null);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeNavMapping(removeTarget.id);
      show('Mapping removed');
      setRemoveTarget(null);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setRemoving(false);
    }
  }

  const filtered = mappings.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.scheme_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const confirmed  = mappings.filter(m => m.confirmed).length;
  const synced     = mappings.filter(m => m.synced_at).length;
  const unmapped   = mappings.filter(m => !m.scheme_code).length;

  return (
    <div className="space-y-5">
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Remove mapping confirmation dialog */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Remove NAV mapping?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This will unlink <span className="font-medium text-slate-700 dark:text-slate-200">"{removeTarget.name}"</span> from its AMFI scheme. The NAV history data will be kept.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {removing ? 'Removing…' : 'Remove mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              NAV Mapping
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              Map funds to AMFI scheme codes and sync NAV history from mfapi.in
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLatest}
              disabled={syncingLatest || loading}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {syncingLatest ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
              {syncingLatest ? 'Starting…' : 'Fetch latest AMFI data'}
            </button>
            <button
              onClick={runAutoMatch}
              disabled={matching || loading}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {matching ? <Spinner /> : <Search className="w-4 h-4" />}
              {matching ? 'Matching…' : 'Auto-match all'}
            </button>
            <button
              onClick={runSyncAll}
              disabled={syncingAll || loading}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {syncingAll ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
              {syncingAll ? 'Syncing…' : 'Sync all confirmed'}
            </button>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700">
            {mappings.length} funds
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            {confirmed} confirmed
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
            {synced} synced
          </span>
          {unmapped > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {unmapped} unmapped
            </span>
          )}
        </div>
      </SectionCard>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search fund or scheme name…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <SectionCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Scheme mapped</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">NAV rows</th>
                <th className="px-4 py-3 font-medium">Last synced</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(m => {
                const isEditing = editRow?.fund_id === m.id;
                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[220px]">
                      <span className="line-clamp-2 leading-snug">{m.name}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      {isEditing ? (
                        <SchemeSearchDropdown
                          fundName={m.name}
                          value={{ scheme_code: editRow.scheme_code, scheme_name: editRow.scheme_name }}
                          onChange={({ scheme_code, scheme_name }) => setEditRow(r => ({ ...r, scheme_code, scheme_name }))}
                        />
                      ) : m.scheme_name ? (
                        <div>
                          <p className="text-slate-800 dark:text-slate-200 text-xs leading-snug line-clamp-2">{m.scheme_name}</p>
                          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-mono mt-0.5">{m.scheme_code}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs italic">Not mapped</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.confirmed
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Confirmed</span>
                        : m.scheme_code
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Unconfirmed</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700">Unmapped</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 dark:text-slate-500 tabular-nums">
                      {m.nav_rows > 0 ? m.nav_rows.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                      {m.synced_at
                        ? new Date(m.synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit}
                              className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">
                              Save
                            </button>
                            <button onClick={() => setEditRow(null)}
                              className="text-xs px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-400 dark:text-slate-500 rounded-lg">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditRow({ fund_id: m.id, scheme_code: m.scheme_code || '', scheme_name: m.scheme_name || '' })}
                              className="text-xs px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-400 dark:text-slate-500 rounded-lg transition-colors font-medium"
                            >
                              {m.scheme_code ? 'Edit' : 'Map'}
                            </button>
                            {m.scheme_code && (
                              <>
                                <button
                                  onClick={() => syncFund(m.id)}
                                  disabled={syncingId === m.id}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors font-medium disabled:opacity-50"
                                >
                                  {syncingId === m.id ? <Spinner /> : <RefreshCw className="w-3 h-3" />}
                                  Sync
                                </button>
                                <button
                                  onClick={() => setRemoveTarget({ id: m.id, name: m.name })}
                                  className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors font-medium"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No funds match your search</div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ─── Tab: Feature Flags ───────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  pages:    'Pages & Navigation',
  charts:   'Charts',
  analysis: 'Analysis Tools',
  general:  'General',
};

function FeatureFlagsTab() {
  const [flags, setFlags]               = useState([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState({});
  const [savingPayments, setSavingPayments] = useState(false);
  const { show, toast, hide }           = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/features');
      setFlags(r.data.flags);
      setPaymentsEnabled(r.data.paymentsEnabled ?? false);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function togglePayments() {
    const next = !paymentsEnabled;
    setSavingPayments(true);
    try {
      await api.patch('/features/payments', { enabled: next });
      setPaymentsEnabled(next);
      show(`Payments ${next ? 'enabled' : 'disabled'}`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSavingPayments(false); }
  }

  async function toggle(key, currentPlan) {
    const next = currentPlan === 'free' ? 'pro' : 'free';
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.patch(`/features/${key}`, { required_plan: next });
      setFlags(f => f.map(x => x.key === key ? { ...x, required_plan: next } : x));
      show(`${key} → ${next}`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSaving(s => { const n = { ...s }; delete n[key]; return n; }); }
  }

  // Group by category
  const grouped = flags.reduce((acc, f) => {
    const cat = f.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const proCount  = flags.filter(f => f.required_plan === 'pro').length;
  const freeCount = flags.filter(f => f.required_plan === 'free').length;

  return (
    <div className="space-y-5">
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Payments toggle — prominent at the top */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Payments & Billing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              {paymentsEnabled
                ? 'Payments are live — users can upgrade to Pro via Razorpay.'
                : 'Payments are disabled — the Upgrade button and checkout are hidden from all users.'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              paymentsEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
            }`}>
              {paymentsEnabled ? 'Live' : 'Disabled'}
            </span>
            <button
              onClick={togglePayments}
              disabled={savingPayments}
              style={{ width: 48, height: 26 }}
              className={`relative rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                paymentsEnabled ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              {savingPayments
                ? <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                : <span style={{
                    position: 'absolute', top: 3, left: 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s',
                    transform: paymentsEnabled ? 'translateX(22px)' : 'translateX(0)',
                  }}
                />
              }
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Feature flags header */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-500" />
              Feature Flags
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              Toggle which features require a Pro subscription. Changes take effect immediately.
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700">
            {flags.length} features total
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            {freeCount} free
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
            {proCount} Pro-only
          </span>
        </div>
      </SectionCard>

      {loading && flags.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catFlags]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              <SectionCard>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {catFlags.map(f => {
                    const isPro = f.required_plan === 'pro';
                    return (
                      <div key={f.key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isPro ? 'bg-indigo-50' : 'bg-slate-100'
                        }`}>
                          {isPro
                            ? <Lock className="w-3.5 h-3.5 text-indigo-500" />
                            : <Unlock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{f.label}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                              isPro
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isPro ? 'Pro' : 'Free'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{f.description}</p>
                        </div>

                        {/* Toggle — track: 48×26px, thumb: 20px, inset: 3px, travel: 22px */}
                        <button
                          onClick={() => toggle(f.key, f.required_plan)}
                          disabled={!!saving[f.key]}
                          style={{ width: 48, height: 26 }}
                          className={`relative rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                            isPro ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                          title={isPro ? 'Click to make Free' : 'Click to make Pro-only'}
                        >
                          {saving[f.key]
                            ? <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </span>
                            : <span style={{
                                position: 'absolute',
                                top: 3, left: 3,
                                width: 20, height: 20,
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                transition: 'transform 0.2s',
                                transform: isPro ? 'translateX(22px)' : 'translateX(0)',
                              }}
                            />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cache ───────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (ms < 60_000)   return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
}

function CacheTab() {
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const { toast, show, hide }   = useToast();

  async function loadStats() {
    setLoading(true);
    try { setStats(await adminGetCacheStats()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }

  async function clearCache() {
    setClearing(true);
    try {
      await adminClearCache();
      show('Cache cleared — all entries invalidated');
      setStats(s => ({ ...s, total: 0, alive: 0, expired: 0, keys: [] }));
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setClearing(false); }
  }

  async function toggleCache() {
    if (!stats) return;
    setToggling(true);
    try {
      const { enabled } = await adminSetCacheEnabled(!stats.enabled);
      setStats(s => ({ ...s, enabled, ...(enabled ? {} : { total: 0, alive: 0, expired: 0, keys: [] }) }));
      show(enabled ? 'Cache enabled' : 'Cache disabled — all entries cleared');
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally { setToggling(false); }
  }

  useEffect(() => { loadStats(); }, []);

  const keys = stats?.keys ?? [];

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={hide} />}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">In-memory response cache</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              Heavy analytics routes are cached for 24 hours. Cache resets on writes or server restart.
            </p>
          </div>
          <button onClick={loadStats} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : stats ? (
          <div className="space-y-4">

            {/* Enable / disable toggle */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Cache enabled</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
                  When disabled, every request hits the database directly. Disabling also clears all entries.
                </p>
              </div>
              <button
                onClick={toggleCache}
                disabled={toggling}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none
                  ${stats.enabled ? 'bg-emerald-500' : 'bg-slate-300'} ${toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-slate-800 shadow transition-transform
                  ${stats.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total entries', value: stats.total,   color: 'text-slate-700 dark:text-slate-300',  bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700' },
                { label: 'Alive (fresh)', value: stats.alive,   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                { label: 'Expired',       value: stats.expired, color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`border rounded-xl px-4 py-3 ${bg}`}>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Clear + show keys */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowKeys(v => !v)}
                className="text-xs text-indigo-600 hover:underline"
              >
                {showKeys ? 'Hide' : 'Show'} live keys ({keys.length})
              </button>
              <button
                onClick={clearCache}
                disabled={clearing || stats.alive === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {clearing ? <Spinner /> : null}
                {stats.alive === 0 ? 'Cache is empty' : `Clear ${stats.alive} live entries`}
              </button>
            </div>

            {/* Live key list */}
            {showKeys && keys.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {keys.map(({ key, expiresIn }) => (
                    <div key={key} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <p className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate mr-4">{key}</p>
                      <span className="shrink-0 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {fmtMs(expiresIn)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showKeys && keys.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">No live keys in cache.</p>
            )}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">What gets cached</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
          {[
            { route: '/api/holdings/cross-fund',              desc: 'Cross-fund stock analysis' },
            { route: '/api/holdings/overlap-matrix',          desc: 'Pairwise fund overlap' },
            { route: '/api/holdings/overlap-trend',           desc: 'Overlap trend per fund pair' },
            { route: '/api/holdings/rising-conviction',       desc: 'Rising / losing conviction' },
            { route: '/api/holdings/hidden-gems',             desc: 'Hidden gems' },
            { route: '/api/holdings/entry-exit/:fundId',      desc: 'Entry & exit timeline' },
            { route: '/api/holdings/sector-drift/:id',        desc: 'Sector drift per fund' },
            { route: '/api/holdings/stock-tracker/:isin',     desc: 'Stock tracker' },
            { route: '/api/holdings/churn-rates',             desc: 'Fund churn rates' },
            { route: '/api/holdings/sector-rotation',         desc: 'Sector rotation calendar' },
            { route: '/api/holdings/discovery-chain',         desc: 'Stock discovery chain' },
            { route: '/api/holdings/concentration',           desc: 'Concentration scores' },
            { route: '/api/extractions/:id/holdings/summary', desc: 'Holdings summary (immutable)' },
            { route: '/api/extractions/trend/:id/:isin',      desc: 'Stock % NAV trend' },
            { route: '/api/feed',                             desc: 'Activity feed' },
            { route: '/api/funds',                            desc: 'Fund list' },
            { route: '/api/funds/:id',                        desc: 'Fund detail' },
            { route: '/api/funds/:id/extractions',            desc: 'Extractions list per fund' },
            { route: '/api/funds/:id/compare',                desc: 'Month comparison (immutable data)' },
          ].map(({ route, desc }) => (
            <div key={route} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-mono text-xs text-indigo-700">{route}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full shrink-0 ml-4">24 h</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'upload',      label: 'Upload' },
  { id: 'isin',        label: 'ISIN Remap' },
  { id: 'names',       label: 'Name Normalisation' },
  { id: 'scanner',     label: 'Duplicate Scanner' },
  { id: 'funds',       label: 'Fund Management' },
  { id: 'continuity',  label: 'Data Continuity' },
  { id: 'nav',         label: 'NAV Mapping' },
  { id: 'features',    label: 'Feature Flags' },
  { id: 'cache',       label: 'Cache' },
];

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab]       = useState('isin');
  const [counts, setCounts] = useState({});

  const refreshCounts = useCallback(() => {
    adminGetCounts().then(setCounts).catch(() => {});
  }, []);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  if (!isLoaded) return null;
  if (user?.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  // Only these 4 tabs get badges
  const badgeCount = {
    isin:       counts.isin         || 0,
    names:      counts.names        || 0,
    continuity: counts.continuity   || 0,
    nav:        counts.nav_unmapped || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 ml-7">Data normalisation &amp; fund management</p>
        </div>
        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full font-medium w-fit">
          {user.primaryEmailAddress.emailAddress}
        </span>
      </div>

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-max sm:w-fit min-w-full sm:min-w-0">
          {TABS.map(t => {
            const count = badgeCount[t.id] || 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                    ${tab === t.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'upload'     && <UploadTab />}
        {tab === 'isin'       && <IsinRemapTab onCountChange={refreshCounts} />}
        {tab === 'names'      && <NameNormTab  onCountChange={refreshCounts} />}
        {tab === 'scanner'    && <ScannerTab />}
        {tab === 'funds'      && <FundMgmtTab />}
        {tab === 'continuity' && <ContinuityTab onCountChange={refreshCounts} />}
        {tab === 'nav'        && <NavTab onCountChange={refreshCounts} />}
        {tab === 'features'   && <FeatureFlagsTab />}
        {tab === 'cache'      && <CacheTab />}
      </div>
    </div>
  );
}

// ─── ContinuityTab ────────────────────────────────────────────────────────────
const CAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ContinuityTab({ onCountChange: _onCountChange }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [hideOk, setHideOk]         = useState(true);
  const [sortBy, setSortBy]         = useState('gaps');   // 'gaps' | 'name' | 'stale'
  const [search, setSearch]         = useState('');
  const { toast, show, hide }       = useToast();

  function load() {
    setLoading(true);
    setError(null);
    adminGetFundGaps()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = (data || [])
    .filter(f => {
      if (hideOk && f.status === 'ok') return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'gaps')  return b.gap_count - a.gap_count;
      if (sortBy === 'stale') return (b.months_since_last ?? 0) - (a.months_since_last ?? 0);
      return a.name.localeCompare(b.name);
    });

  const summary = data ? {
    total:  data.length,
    ok:     data.filter(f => f.status === 'ok').length,
    stale:  data.filter(f => f.status === 'stale').length,
    minor:  data.filter(f => f.status === 'minor').length,
    major:  data.filter(f => f.status === 'major').length,
    empty:  data.filter(f => f.status === 'empty').length,
  } : null;

  const statusMeta = {
    ok:    { label: 'Complete',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    stale: { label: 'Stale',        cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    minor: { label: '1–2 gaps',     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    major: { label: '3+ gaps',      cls: 'bg-red-100 text-red-700 border-red-200' },
    empty: { label: 'No data',      cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700' },
  };

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={hide} />}

      {/* Header */}
      <SectionCard>
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Data Continuity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              Funds with internal month gaps or stale extractions
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Summary pills */}
        {summary && (
          <div className="px-5 pb-4 flex items-center gap-2 flex-wrap border-t border-slate-100 dark:border-slate-800 pt-4">
            {[
              { key: 'total',  label: `${summary.total} funds`,       cls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700' },
              { key: 'ok',     label: `${summary.ok} complete`,        cls: statusMeta.ok.cls },
              { key: 'stale',  label: `${summary.stale} stale`,        cls: statusMeta.stale.cls },
              { key: 'minor',  label: `${summary.minor} minor gaps`,   cls: statusMeta.minor.cls },
              { key: 'major',  label: `${summary.major} major gaps`,   cls: statusMeta.major.cls },
            ].map(p => (
              <span key={p.key} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${p.cls}`}>
                {p.label}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Controls */}
      {data && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search fund name…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl text-sm">
            {[
              { key: 'gaps',  label: 'By gaps' },
              { key: 'stale', label: 'By staleness' },
              { key: 'name',  label: 'By name' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  sortBy === s.key ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Toggle complete funds */}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideOk}
              onChange={e => setHideOk(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            Hide complete funds
          </label>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm p-6">
          <Spinner /> Loading continuity report…
        </div>
      )}

      {/* Fund rows */}
      {filtered.length === 0 && data && !loading && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">All funds look good!</p>
          <p className="text-xs mt-1">No gaps or issues found matching your filters</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(f => <ContinuityRow key={f.id} fund={f} statusMeta={statusMeta} />)}
      </div>
    </div>
  );
}

function ContinuityRow({ fund: f, statusMeta }) {
  const [open, setOpen] = useState(f.gap_count > 0 || f.status === 'stale');

  // Build year → months structure for the visual grid
  const actualSet  = new Set(f.actual_months);
  const gapSet     = new Set(f.gaps);
  const years      = [...new Set([
    ...(f.actual_months || []),
    ...(f.expected_months || []),
  ].map(m => m.slice(0, 4)))].sort();

  const sm = statusMeta[f.status] || statusMeta.empty;

  const stalenessLabel = f.months_since_last == null ? null
    : f.months_since_last === 0 ? 'This month'
    : f.months_since_last === 1 ? '1 month ago'
    : `${f.months_since_last} months ago`;

  return (
    <div className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm transition-colors ${
      f.gap_count > 0 ? 'border-orange-200' : f.status === 'stale' ? 'border-amber-200' : 'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Row header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors text-left"
      >
        {/* Status badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${sm.cls}`}>
          {sm.label}
        </span>

        {/* Fund name */}
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</span>

        {/* Meta chips */}
        <div className="flex items-center gap-2 shrink-0">
          {f.gap_count > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {f.gap_count} gap{f.gap_count !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">{f.coverage_pct}% coverage</span>
          {stalenessLabel && (
            <span className={`text-xs font-medium ${
              (f.months_since_last ?? 0) > 3 ? 'text-amber-600' : 'text-slate-400 dark:text-slate-500'
            }`}>
              Last: {stalenessLabel}
            </span>
          )}
          {f.first_month && (
            <span className="text-xs text-slate-300 hidden sm:inline">
              {fmtMonth(f.first_month)} – {fmtMonth(f.last_month)}
            </span>
          )}
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-1" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-1" />}
        </div>
      </button>

      {/* Expanded: visual month grid */}
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4">
          {f.status === 'empty' ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No extractions found for this fund.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {years.map(year => {
                  const yearHasActivity = Array.from({length: 12}, (_, i) => {
                    const m = `${year}-${String(i+1).padStart(2,'0')}-01`;
                    return actualSet.has(m) || gapSet.has(m);
                  }).some(Boolean);

                  if (!yearHasActivity) return null;

                  return (
                    <div key={year} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 w-8 shrink-0 text-right">{year}</span>
                      <div className="grid grid-cols-12 gap-0.5 flex-1">
                        {CAL_MONTHS.map((lbl, idx) => {
                          const isoMonth = `${year}-${String(idx+1).padStart(2,'0')}-01`;
                          const hasData  = actualSet.has(isoMonth);
                          const isGap    = gapSet.has(isoMonth);
                          // Before first extraction or after last: neutral
                          const inRange  = isoMonth >= f.first_month && isoMonth <= f.last_month;

                          let cellCls, textCls;
                          if (hasData) {
                            cellCls = 'bg-emerald-100 border-emerald-300';
                            textCls = 'text-emerald-700 font-semibold';
                          } else if (isGap) {
                            cellCls = 'bg-red-100 border-red-300';
                            textCls = 'text-red-600 font-bold';
                          } else if (inRange) {
                            // Shouldn't happen (gap covers inRange without data) but fallback
                            cellCls = 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
                            textCls = 'text-slate-300';
                          } else {
                            cellCls = 'bg-transparent border-transparent';
                            textCls = 'text-slate-200';
                          }

                          return (
                            <div
                              key={idx}
                              title={
                                hasData ? `${lbl} ${year} — data present`
                                : isGap ? `${lbl} ${year} — MISSING`
                                : ''
                              }
                              className={`border rounded text-center py-1.5 ${cellCls}`}
                            >
                              <span className={`text-[9px] leading-none tracking-wide ${textCls}`}>{lbl}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend + gap list */}
              <div className="mt-3 flex items-start gap-6 flex-wrap">
                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />
                    Has data
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />
                    Missing
                  </span>
                </div>

                {f.gaps.length > 0 && (
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-600 mb-1">
                      Missing months ({f.gaps.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {f.gaps.map(g => (
                        <span key={g} className="text-[10px] font-mono bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded">
                          {fmtMonth(g)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {f.status === 'stale' && f.months_since_last > 2 && (
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-600">
                      ⚠ No new data for {f.months_since_last} months — last extraction was {fmtMonth(f.last_month)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
