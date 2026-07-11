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
  getNavMappings, getAllNavSchemes, autoMatchNav, confirmNavMapping, syncNavFund, syncAllNav, searchNavSchemes, removeNavMapping, syncLatestNav, adminGetCounts, adminFixNameBatch,
  adminGetStocksStatus, adminTriggerStocksSync,
  adminGetBackupStatus, adminTriggerBackup,
  adminListStocks,
  getAuthHeader,
} from '../api/client.js';
import ErrorDoodle from '../components/ErrorDoodle.jsx';
import api from '../api/client.js';
import { AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Settings, X, Search, Activity, TrendingUp, Lock, Unlock, Download } from 'lucide-react';

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
        <div className="flex flex-col items-center gap-3 py-10 text-slate-400 dark:text-slate-500">
          <svg width="200" height="176" viewBox="0 0 100 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes adm-spin1 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes adm-spin2 { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
                @keyframes adm-spin3 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .adm-sf1 { transform-origin:22px 44px; animation:adm-spin1 8s linear infinite; }
                .adm-sf2 { transform-origin:50px 40px; animation:adm-spin2 12s linear infinite; }
                .adm-sf3 { transform-origin:78px 44px; animation:adm-spin3 10s linear infinite; }
              `}</style>
            </defs>
            <circle cx="50" cy="44" r="38" fill="#F0F4FF" opacity="0.4"/>
            {/* Snowflake 1 — purple, spinning */}
            <g className="adm-sf1">
              <line x1="22" y1="26" x2="22" y2="62" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6.4" y1="35" x2="37.6" y2="53" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
              <line x1="37.6" y1="35" x2="6.4" y2="53" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22,22 L25,26 L22,30 L19,26 Z" fill="#7F77DD"/>
              <path d="M22,58 L25,62 L22,66 L19,62 Z" fill="#7F77DD"/>
              <path d="M41,55 L37.6,53 L34,55 L37.6,57 Z" fill="#7F77DD"/>
              <path d="M3,55 L6.4,53 L3,51 L6.4,57 Z" fill="#7F77DD"/>
              <line x1="18" y1="32" x2="14" y2="36" stroke="#7F77DD" strokeWidth="1.2"/>
              <line x1="26" y1="32" x2="30" y2="36" stroke="#7F77DD" strokeWidth="1.2"/>
              <line x1="26" y1="56" x2="30" y2="52" stroke="#7F77DD" strokeWidth="1.2"/>
              <line x1="18" y1="56" x2="14" y2="52" stroke="#7F77DD" strokeWidth="1.2"/>
              <circle cx="22" cy="44" r="5" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.2"/>
            </g>
            {/* Snowflake 2 — green, counter-spinning */}
            <g className="adm-sf2">
              <line x1="50" y1="20" x2="50" y2="60" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="32.7" y1="30" x2="67.3" y2="50" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="67.3" y1="30" x2="32.7" y2="50" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="50" cy="18" r="3" fill="#1D9E75"/>
              <circle cx="50" cy="62" r="3" fill="#1D9E75"/>
              <circle cx="69" cy="51" r="3" fill="#1D9E75"/>
              <circle cx="31" cy="51" r="3" fill="#1D9E75"/>
              <circle cx="69" cy="29" r="3" fill="#1D9E75"/>
              <circle cx="31" cy="29" r="3" fill="#1D9E75"/>
              <circle cx="50" cy="40" r="6" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1.5"/>
              <path d="M47.5 40 L50 42.5 L54 37" stroke="#1D9E75" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </g>
            {/* Snowflake 3 — amber, spinning */}
            <g className="adm-sf3">
              <line x1="78" y1="28" x2="78" y2="60" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"/>
              <line x1="64.1" y1="36" x2="91.9" y2="52" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"/>
              <line x1="91.9" y1="36" x2="64.1" y2="52" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"/>
              <rect x="75.5" y="24" width="5" height="5" rx="0.5" fill="#FAC775" stroke="#BA7517" strokeWidth="0.8"/>
              <rect x="75.5" y="59" width="5" height="5" rx="0.5" fill="#FAC775" stroke="#BA7517" strokeWidth="0.8"/>
              <rect x="90" y="53" width="5" height="5" rx="0.5" fill="#FAC775" stroke="#BA7517" strokeWidth="0.8"/>
              <rect x="63" y="53" width="5" height="5" rx="0.5" fill="#FAC775" stroke="#BA7517" strokeWidth="0.8"/>
              <circle cx="78" cy="44" r="5" fill="#FFF3CE" stroke="#BA7517" strokeWidth="1.2"/>
            </g>
            <ellipse cx="22" cy="68" rx="14" ry="4" fill="#CECBF6" opacity="0.3"/>
            <ellipse cx="50" cy="68" rx="14" ry="4" fill="#A8EDDA" opacity="0.3"/>
            <ellipse cx="78" cy="68" rx="14" ry="4" fill="#FAC775" opacity="0.3"/>
            <circle cx="10" cy="12" r="2" fill="#FAC775"/>
            <circle cx="90" cy="10" r="1.8" fill="#CECBF6"/>
            <circle cx="6" cy="52" r="1.4" fill="#5DCAA5"/>
            <circle cx="94" cy="54" r="1.4" fill="#7F77DD"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">No ISIN conflicts found</p>
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

  // Fix all selected ISINs in a single batch request
  async function fixSelected() {
    if (!selected.size) return;
    setBulkRunning(true);
    try {
      const fixes = [...selected].flatMap(isin => {
        const issue = issues.find(i => i.isin === isin);
        if (!issue) return [];
        const winner = [...issue.names].sort((a, b) => b.row_count - a.row_count)[0];
        return [{ isin, canonical_name: winner.stock_name }];
      });
      const r = await adminFixNameBatch(fixes);
      show(`Fixed ${r.fixed} ISIN${r.fixed !== 1 ? 's' : ''} — ${r.total_rows} rows updated`);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setBulkRunning(false);
    }
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
        <div className="flex flex-col items-center gap-3 py-10 text-slate-400 dark:text-slate-500">
          <svg width="180" height="159" viewBox="0 0 100 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes adm-card-back { 0%,100%{transform:rotate(12deg) translateY(0px)} 50%{transform:rotate(14deg) translateY(-2px)} }
                @keyframes adm-card-mid  { 0%,100%{transform:rotate(-8deg) translateY(0px)} 50%{transform:rotate(-10deg) translateY(-3px)} }
                @keyframes adm-card-front{ 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
                @keyframes adm-check     { 0%,100%{opacity:0.6} 50%{opacity:1} }
                .adm-cb { transform-origin:53px 48px; animation:adm-card-back  3s ease-in-out infinite; }
                .adm-cm { transform-origin:51px 44px; animation:adm-card-mid   3s ease-in-out infinite 0.15s; }
                .adm-cf { transform-origin:50px 41px; animation:adm-card-front 3s ease-in-out infinite 0.3s; }
                .adm-check { animation:adm-check 2s ease-in-out infinite; }
              `}</style>
            </defs>
            <g className="adm-cb">
              <rect x="32" y="22" width="42" height="52" rx="5" fill="#FFF3CE" stroke="#BA7517" strokeWidth="1.2"/>
            </g>
            <g className="adm-cm">
              <rect x="30" y="18" width="42" height="52" rx="5" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.2"/>
            </g>
            <g className="adm-cf">
              <rect x="28" y="14" width="44" height="54" rx="5" fill="white" stroke="#1D9E75" strokeWidth="1.6"/>
              <rect x="34" y="22" width="16" height="16" rx="3" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1"/>
              <path className="adm-check" d="M37 30 L40 33 L46 25" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <line x1="34" y1="44" x2="60" y2="44" stroke="#D3D1C7" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="34" y1="51" x2="56" y2="51" stroke="#D3D1C7" strokeWidth="2" strokeLinecap="round"/>
              <line x1="34" y1="57" x2="58" y2="57" stroke="#D3D1C7" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="60" cy="22" r="3" fill="#1D9E75"/>
              <circle cx="66" cy="18" r="3" fill="#7F77DD" opacity="0.8"/>
              <circle cx="70" cy="26" r="3" fill="#FAC775" opacity="0.9"/>
            </g>
            <ellipse cx="50" cy="72" rx="26" ry="5" fill="#D3D1C7" opacity="0.3"/>
            <circle cx="10" cy="12" r="2.2" fill="#FAC775"/>
            <circle cx="90" cy="10" r="1.8" fill="#CECBF6"/>
            <circle cx="8" cy="56" r="1.5" fill="#5DCAA5"/>
            <circle cx="92" cy="54" r="1.5" fill="#AFA9EC"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">No name conflicts found</p>
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
        <div className="flex flex-col items-center gap-3 py-10 text-slate-400 dark:text-slate-500">
          <svg width="160" height="140" viewBox="0 0 100 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`
                @keyframes adm-ufo-hover { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-5px)} }
                @keyframes adm-beam      { 0%,100%{opacity:0.08} 50%{opacity:0.22} }
                @keyframes adm-rim1      { 0%,33%{opacity:1} 34%,100%{opacity:0.2} }
                @keyframes adm-rim2      { 0%,33%{opacity:0.2} 34%,66%{opacity:1} 67%,100%{opacity:0.2} }
                @keyframes adm-rim3      { 0%,66%{opacity:0.2} 67%,100%{opacity:1} }
                @keyframes adm-dot1      { 0%{transform:translateY(0px);opacity:0.5} 100%{transform:translateY(-18px);opacity:0} }
                @keyframes adm-dot2      { 0%{transform:translateY(0px);opacity:0.4} 100%{transform:translateY(-16px);opacity:0} }
                @keyframes adm-dot3      { 0%{transform:translateY(0px);opacity:0.3} 100%{transform:translateY(-14px);opacity:0} }
                .adm-ufo   { transform-origin:50px 32px; animation:adm-ufo-hover 3s ease-in-out infinite; }
                .adm-beam  { animation:adm-beam 2s ease-in-out infinite; }
                .adm-rl1   { animation:adm-rim1 1.5s linear infinite; }
                .adm-rl2   { animation:adm-rim2 1.5s linear infinite; }
                .adm-rl3   { animation:adm-rim3 1.5s linear infinite; }
                .adm-d1    { animation:adm-dot1 2s ease-in infinite 0s; }
                .adm-d2    { animation:adm-dot2 2s ease-in infinite 0.6s; }
                .adm-d3    { animation:adm-dot3 2s ease-in infinite 1.2s; }
              `}</style>
            </defs>
            <circle cx="6" cy="8" r="1.2" fill="#D3D1C7"/>
            <circle cx="94" cy="6" r="1" fill="#FAC775"/>
            <circle cx="14" cy="18" r="0.8" fill="#B4B2A9"/>
            <circle cx="88" cy="20" r="1.3" fill="#D3D1C7"/>
            <circle cx="4" cy="44" r="1" fill="#D3D1C7"/>
            <circle cx="96" cy="40" r="0.8" fill="#B4B2A9"/>
            {/* Tractor beam — behind UFO, pulses */}
            <path className="adm-beam" d="M38 38 L24 72 L76 72 L62 38 Z" fill="#FAC775"/>
            <line x1="38" y1="38" x2="24" y2="72" stroke="#FAC775" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.4"/>
            <line x1="62" y1="38" x2="76" y2="72" stroke="#FAC775" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.4"/>
            {/* Floating candidate dots */}
            <circle className="adm-d1" cx="50" cy="62" r="4" fill="#7F77DD"/>
            <circle className="adm-d2" cx="44" cy="56" r="3" fill="#AFA9EC"/>
            <circle className="adm-d3" cx="57" cy="59" r="3.5" fill="#7F77DD"/>
            {/* UFO — hovers */}
            <g className="adm-ufo">
              <ellipse cx="50" cy="34" rx="28" ry="6" fill="#CECBF6" opacity="0.3"/>
              <path d="M38 28 Q50 14 62 28 Z" fill="#E6F1FB" stroke="#378ADD" strokeWidth="1.2"/>
              <circle cx="44" cy="24" r="2.5" fill="#B5D4F4" stroke="#378ADD" strokeWidth="0.8"/>
              <circle cx="50" cy="21" r="2.5" fill="#B5D4F4" stroke="#378ADD" strokeWidth="0.8"/>
              <circle cx="56" cy="24" r="2.5" fill="#B5D4F4" stroke="#378ADD" strokeWidth="0.8"/>
              <ellipse cx="50" cy="32" rx="28" ry="8" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.4"/>
              <ellipse cx="50" cy="31" rx="20" ry="5" fill="#CECBF6" opacity="0.5"/>
              {/* Rim lights — cycling */}
              <circle className="adm-rl1" cx="28" cy="32" r="2" fill="#FAC775"/>
              <circle className="adm-rl2" cx="36" cy="36" r="2" fill="#5DCAA5"/>
              <circle className="adm-rl3" cx="50" cy="38" r="2" fill="#FAC775"/>
              <circle className="adm-rl1" cx="64" cy="36" r="2" fill="#5DCAA5"/>
              <circle className="adm-rl2" cx="72" cy="32" r="2" fill="#FAC775"/>
            </g>
            <path d="M16 76 Q50 68 84 76" stroke="#5DCAA5" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M10 82 Q50 74 90 82" stroke="#9FE1CB" strokeWidth="1" fill="none" strokeLinecap="round"/>
          </svg>
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-base">Click "Run Scan" to find candidates</p>
        </div>
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
function SchemeSearchDropdown({ fundName, value, onChange, allSchemes }) {
  const [query, setQuery]         = useState(value?.scheme_name || fundName || '');
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [touched, setTouched]     = useState(false);
  const debounceRef               = useRef(null);
  const containerRef              = useRef(null);
  const cacheRef                  = useRef({});

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function scoreScheme(ref, schemeName) {
    const norm  = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const rWords = new Set(norm(ref));
    const sWords = norm(schemeName);
    let hits = 0;
    for (const w of sWords) if (rWords.has(w)) hits++;
    let score = hits / Math.max(rWords.size, 1);
    const lo = schemeName.toLowerCase();
    if (lo.includes('growth') && !lo.includes('idcw')) score += 0.15;
    if (lo.includes('direct')) score += 0.05;
    if (lo.includes('idcw') || lo.includes('dividend')) score -= 0.3;
    return score;
  }

  function clientSearch(q, schemes) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const ref = fundName || q;
    const scored = schemes
      .filter(s => words.every(w => s.scheme_name.toLowerCase().includes(w)))
      .map(s => ({ ...s, score: scoreScheme(ref, s.scheme_name) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return scored;
  }

  function doSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setOpen(false); return; }

    // ── Client-side search (instant) if full list is loaded ──
    if (allSchemes) {
      const hits = clientSearch(trimmed, allSchemes);
      setResults(hits);
      setOpen(true);
      return;
    }

    // ── Fallback: API search with cache ──
    if (cacheRef.current[trimmed]) {
      setResults(cacheRef.current[trimmed]);
      setOpen(true);
      return;
    }
    setLoading(true);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchNavSchemes(trimmed, fundName);
        cacheRef.current[trimmed] = data;
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }

  function handleInput(e) {
    setQuery(e.target.value);
    doSearch(e.target.value);
  }

  function handleFocus() {
    if (!touched) {
      setTouched(true);
      doSearch(query);
    } else if (results.length) {
      setOpen(true);
    }
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
          onFocus={handleFocus}
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
  const [savingEdit, setSavingEdit]       = useState(false);
  const [search, setSearch]               = useState('');
  const [allSchemes, setAllSchemes]       = useState(null);  // full AMFI list for client-side search
  const { show, toast, hide }             = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setMappings(await getNavMappings()); }
    catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-fetch the full AMFI scheme list once so SchemeSearchDropdown can filter client-side
  useEffect(() => {
    getAllNavSchemes()
      .then(setAllSchemes)
      .catch(() => {}); // silent — will fall back to API search
  }, []);

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
    setSavingEdit(true);
    try {
      await confirmNavMapping(editRow.fund_id, editRow.scheme_code, editRow.scheme_name);
      show('Mapping confirmed');
      setEditRow(null);
      await load();
      onCountChange?.();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setSavingEdit(false);
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
                          allSchemes={allSchemes}
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
                            <button
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="relative text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-80 text-white rounded-lg font-medium overflow-hidden transition-opacity"
                            >
                              {/* Animated loading bar along the bottom edge */}
                              {savingEdit && (
                                <span className="absolute bottom-0 left-0 h-[3px] bg-white/50 rounded-full animate-[saving-bar_1s_ease-in-out_infinite]"
                                  style={{ animation: 'saving-bar 1s ease-in-out infinite' }}
                                />
                              )}
                              <style>{`
                                @keyframes saving-bar {
                                  0%   { width: 0%;   opacity: 1; }
                                  70%  { width: 100%; opacity: 1; }
                                  100% { width: 100%; opacity: 0; }
                                }
                              `}</style>
                              {savingEdit ? 'Saving…' : 'Save'}
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

function Toggle({ on, saving, onClick, title, color = 'indigo' }) {
  const colors = {
    indigo:  'bg-indigo-600',
    emerald: 'bg-emerald-500',
    slate:   'bg-slate-400',
  };
  return (
    <button
      onClick={onClick}
      disabled={saving}
      title={title}
      style={{ width: 48, height: 26 }}
      className={`relative rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? colors[color] : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      {saving
        ? <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </span>
        : <span style={{
            position: 'absolute', top: 3, left: 3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s',
            transform: on ? 'translateX(22px)' : 'translateX(0)',
          }}
          />
      }
    </button>
  );
}

function UserOverridesPanel({ flags, show }) {
  const [overrides, setOverrides]   = useState({});
  const [userId, setUserId]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/features/overrides');
      setOverrides(r.data.overrides ?? {});
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setOverride(uid, key, enabled, required_plan) {
    const saveKey = `${uid}:${key}`;
    setSaving(s => ({ ...s, [saveKey]: true }));
    try {
      await api.put(`/features/overrides/${uid}/${key}`, { enabled, required_plan });
      setOverrides(prev => {
        const next = { ...prev };
        if (!next[uid]) next[uid] = [];
        const idx = next[uid].findIndex(o => o.feature_key === key);
        const entry = { feature_key: key, enabled: enabled ? 1 : 0, required_plan };
        if (idx >= 0) next[uid][idx] = entry; else next[uid] = [...next[uid], entry];
        return next;
      });
      show(`Override saved for ${uid}`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSaving(s => { const n = { ...s }; delete n[saveKey]; return n; }); }
  }

  async function removeOverride(uid, key) {
    const saveKey = `${uid}:${key}:del`;
    setSaving(s => ({ ...s, [saveKey]: true }));
    try {
      await api.delete(`/features/overrides/${uid}/${key}`);
      setOverrides(prev => {
        const next = { ...prev };
        next[uid] = (next[uid] ?? []).filter(o => o.feature_key !== key);
        if (!next[uid].length) delete next[uid];
        return next;
      });
      show(`Override removed`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSaving(s => { const n = { ...s }; delete n[saveKey]; return n; }); }
  }

  async function addOverride() {
    if (!userId.trim()) return;
    // Default: grant all features as free to this user
    await setOverride(userId.trim(), flags[0]?.key ?? 'feed', true, 'free');
    setUserId('');
  }

  const userIds = Object.keys(overrides);

  return (
    <SectionCard className="p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Per-user overrides</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Override global flags for specific users. Takes precedence over global settings.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Add override for a new user */}
      <div className="flex gap-2 mb-4">
        <input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          placeholder="Clerk user ID (user_...)"
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          onKeyDown={e => e.key === 'Enter' && addOverride()}
        />
        <button onClick={addOverride}
          className="text-xs px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-medium">
          Add user
        </button>
      </div>

      {loading && !userIds.length ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !userIds.length ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">No per-user overrides set.</p>
      ) : (
        <div className="space-y-4">
          {userIds.map(uid => (
            <div key={uid}>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mb-1 px-1 truncate">{uid}</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                {flags.map(f => {
                  const ov = overrides[uid]?.find(o => o.feature_key === f.key);
                  const isEnabled  = ov ? ov.enabled !== 0 : null;
                  const planOverride = ov?.required_plan ?? null;
                  const saveKey = `${uid}:${f.key}`;
                  const isSaving = !!saving[saveKey] || !!saving[`${saveKey}:del`];
                  return (
                    <div key={f.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 min-w-0 truncate">{f.label}</span>

                      {/* Enabled override */}
                      {ov ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {isEnabled ? 'On' : 'Off'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600 px-2 py-0.5">inherit</span>
                      )}

                      {/* Plan override */}
                      {ov && (
                        <select
                          value={planOverride ?? ''}
                          disabled={isSaving}
                          onChange={e => setOverride(uid, f.key, isEnabled, e.target.value || null)}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          <option value="">inherit</option>
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                        </select>
                      )}

                      {/* Toggle enabled override */}
                      <button
                        disabled={isSaving}
                        onClick={() => ov
                          ? setOverride(uid, f.key, !isEnabled, planOverride)
                          : setOverride(uid, f.key, true, null)
                        }
                        className="text-[10px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        {ov ? (isEnabled ? 'Turn off' : 'Turn on') : 'Override'}
                      </button>

                      {/* Remove override */}
                      {ov && (
                        <button
                          disabled={isSaving}
                          onClick={() => removeOverride(uid, f.key)}
                          className="text-[10px] px-2 py-0.5 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

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

  async function toggleEnabled(key, current) {
    const next = !current;
    setSaving(s => ({ ...s, [`${key}:enabled`]: true }));
    try {
      await api.patch(`/features/${key}`, { enabled: next });
      setFlags(f => f.map(x => x.key === key ? { ...x, enabled: next ? 1 : 0 } : x));
      show(`${key} → ${next ? 'enabled' : 'disabled'}`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSaving(s => { const n = { ...s }; delete n[`${key}:enabled`]; return n; }); }
  }

  async function togglePlan(key, currentPlan) {
    const next = currentPlan === 'free' ? 'pro' : 'free';
    setSaving(s => ({ ...s, [`${key}:plan`]: true }));
    try {
      await api.patch(`/features/${key}`, { required_plan: next });
      setFlags(f => f.map(x => x.key === key ? { ...x, required_plan: next } : x));
      show(`${key} → ${next}`);
    } catch (e) { show(e.response?.data?.error || e.message, false); }
    finally { setSaving(s => { const n = { ...s }; delete n[`${key}:plan`]; return n; }); }
  }

  const grouped = flags.reduce((acc, f) => {
    const cat = f.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const enabledCount = flags.filter(f => f.enabled !== 0).length;
  const proCount     = flags.filter(f => f.required_plan === 'pro').length;

  return (
    <div className="space-y-5">
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Payments toggle */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Payments & Billing</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {paymentsEnabled
                ? 'Payments are live — users can upgrade to Pro via Razorpay.'
                : 'Payments are disabled — the Upgrade button and checkout are hidden from all users.'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              paymentsEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {paymentsEnabled ? 'Live' : 'Disabled'}
            </span>
            <Toggle on={paymentsEnabled} saving={savingPayments} onClick={togglePayments} color="emerald" />
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control visibility and plan requirements per feature. Changes take effect immediately.
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
            {flags.length} total
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            {enabledCount} enabled
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
                {/* Column headers */}
                <div className="flex items-center gap-4 px-5 py-2 border-b border-slate-100 dark:border-slate-700">
                  <div className="w-8 shrink-0" />
                  <div className="flex-1" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 w-16 text-center">Visible</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 w-16 text-center">Pro only</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {catFlags.map(f => {
                    const isPro    = f.required_plan === 'pro';
                    const isOn     = f.enabled !== 0;
                    return (
                      <div key={f.key} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                        !isOn ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900'
                      }`}>
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          !isOn ? 'bg-slate-100 dark:bg-slate-800' : isPro ? 'bg-indigo-50' : 'bg-emerald-50'
                        }`}>
                          {!isOn
                            ? <span className="text-slate-300 dark:text-slate-600 text-xs font-bold">—</span>
                            : isPro
                              ? <Lock className="w-3.5 h-3.5 text-indigo-500" />
                              : <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{f.label}</span>
                            {!isOn && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{f.description}</p>
                        </div>

                        {/* Visible toggle */}
                        <div className="w-16 flex justify-center">
                          <Toggle
                            on={isOn}
                            saving={!!saving[`${f.key}:enabled`]}
                            onClick={() => toggleEnabled(f.key, isOn)}
                            color="emerald"
                            title={isOn ? 'Hide from all users' : 'Show to users'}
                          />
                        </div>

                        {/* Pro-only toggle */}
                        <div className="w-16 flex justify-center">
                          <Toggle
                            on={isPro}
                            saving={!!saving[`${f.key}:plan`]}
                            onClick={() => togglePlan(f.key, f.required_plan)}
                            color="indigo"
                            title={isPro ? 'Make free' : 'Require Pro'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          ))}
        </div>
      )}

      {/* Per-user overrides */}
      <UserOverridesPanel flags={flags} show={show} />
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

// ─── Tab: Backup ─────────────────────────────────────────────────────────────
function BackupTab() {
  const [status,      setStatus]      = useState(null);
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast, show, hide }         = useToast();

  useEffect(() => {
    adminGetBackupStatus()
      .then(setStatus)
      .catch(e => show(e.response?.data?.error || e.message, false));
  }, []);

  async function triggerBackup() {
    setLoading(true);
    setResult(null);
    try {
      const data = await adminTriggerBackup();
      setResult(data);
      setStatus({ last_triggered_at: data.triggered_at });
      show('WAL checkpoint complete — Litestream is syncing to R2');
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setLoading(false);
    }
  }

  async function downloadDb() {
    setDownloading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      const authHeader = await getAuthHeader();
      const res = await fetch(`${baseURL}/admin/backup/download`, {
        headers: { ...authHeader },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob     = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
                       || `mf_portfolio_${new Date().toISOString().slice(0,10)}.db.gz`;
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      show('Database downloaded');
    } catch (e) {
      show(e.message, false);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={hide} />}

      <SectionCard className="p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <svg width="80" height="70" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-1">
              <style>{`
                @keyframes rkt-bob   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-5px)} }
                @keyframes rkt-glow  { 0%,100%{opacity:.3} 50%{opacity:.9} }
                @keyframes rkt-spark { 0%,100%{opacity:.15;transform:scale(1)} 50%{opacity:1;transform:scale(1.9)} }
              `}</style>
              {/* Cloud destination */}
              <g style={{animation:'rkt-glow 2.5s ease-in-out infinite', transformOrigin:'72px 22px'}}>
                <path d="M52 28 Q50 28 50 24 Q50 18 57 18 Q59 12 66 12 Q73 12 75 18 Q82 18 82 24 Q82 28 80 28 Z" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.2"/>
                <path d="M60 22 L64 18 L68 22" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <line x1="64" y1="18" x2="64" y2="25" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round"/>
              </g>
              {/* Rocket */}
              <g style={{animation:'rkt-bob 2.4s ease-in-out infinite', transformOrigin:'42px 54px'}}>
                {/* Exhaust flames */}
                <ellipse cx="34" cy="76" rx="4" ry="6" fill="#fde68a" style={{animation:'rkt-glow 0.4s ease-in-out infinite'}} opacity="0.8"/>
                <ellipse cx="34" cy="78" rx="2.5" ry="4" fill="#fbbf24" style={{animation:'rkt-glow 0.4s ease-in-out infinite 0.1s'}} opacity="0.9"/>
                <ellipse cx="42" cy="76" rx="5" ry="7" fill="#fed7aa" style={{animation:'rkt-glow 0.5s ease-in-out infinite 0.2s'}} opacity="0.8"/>
                <ellipse cx="42" cy="79" rx="3" ry="5" fill="#f97316" style={{animation:'rkt-glow 0.5s ease-in-out infinite'}} opacity="0.9"/>
                <ellipse cx="50" cy="76" rx="4" ry="6" fill="#fde68a" style={{animation:'rkt-glow 0.4s ease-in-out infinite 0.3s'}} opacity="0.8"/>
                {/* Rocket body */}
                <path d="M28 68 L28 44 Q28 28 42 20 Q56 28 56 44 L56 68 Z" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.5"/>
                {/* Nose cone */}
                <path d="M28 44 Q28 28 42 20 Q56 28 56 44" fill="#c7d2fe" stroke="#6366f1" strokeWidth="1.2"/>
                {/* Window */}
                <circle cx="42" cy="46" r="8" fill="#ddd6fe" stroke="#6366f1" strokeWidth="1.2"/>
                <circle cx="42" cy="46" r="5" fill="#ede9fe" stroke="#818cf8" strokeWidth="0.8"/>
                {/* DB symbol in window */}
                <ellipse cx="42" cy="44" rx="3.5" ry="1.2" fill="#6366f1"/>
                <rect x="38.5" y="44" width="7" height="3" fill="#818cf8"/>
                <ellipse cx="42" cy="47" rx="3.5" ry="1.2" fill="#6366f1"/>
                {/* Fins */}
                <path d="M28 64 L20 72 L28 68 Z" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1"/>
                <path d="M56 64 L64 72 L56 68 Z" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1"/>
              </g>
              {/* Trajectory dashes */}
              <path d="M52 56 Q58 40 62 28" stroke="#a5b4fc" strokeWidth="1" strokeDasharray="3 4" fill="none"/>
              {/* Corner sparkles */}
              <circle cx="10"  cy="14" r="2"   style={{animation:'rkt-spark 2.2s ease-in-out infinite'}}       fill="#818cf8"/>
              <circle cx="100" cy="12" r="1.6" style={{animation:'rkt-spark 2.2s ease-in-out infinite 0.8s'}}  fill="#6366f1"/>
              <circle cx="100" cy="82" r="1.6" style={{animation:'rkt-spark 2.2s ease-in-out infinite 1.6s'}}  fill="#a5b4fc"/>
              <circle cx="10"  cy="82" r="1.8" style={{animation:'rkt-spark 2.2s ease-in-out infinite 2.4s'}}  fill="#818cf8"/>
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">On-Demand Backup</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-w-sm">
                Force a checkpoint now — flushes all pending writes from SQLite's WAL into the main database file, then Litestream syncs it to Cloudflare R2 within seconds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={triggerBackup}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Running…' : 'Backup Now'}
            </button>
            <button
              onClick={downloadDb}
              disabled={downloading}
              title="Checkpoint WAL and download compressed .db.gz file"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {downloading ? <Spinner /> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading…' : 'Download .db.gz'}
            </button>
          </div>
        </div>

        {status?.last_triggered_at && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            Last triggered: {new Date(status.last_triggered_at + ' UTC').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}

        {result && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Checkpoint Result</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'WAL Frames',    value: result.log,          desc: 'Total frames in WAL' },
                { label: 'Checkpointed',  value: result.checkpointed, desc: 'Frames written to DB' },
                { label: 'Busy',          value: result.busy === 0 ? 'No' : 'Yes', desc: result.busy === 0 ? 'No locks — clean sync' : 'WAL was locked' },
              ].map(({ label, value, desc }) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold ${label === 'Busy' && result.busy ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">{label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>



      <SectionCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">How it works</h3>
        <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {[
            { step: 'Checkpoint', desc: 'Clicking Backup Now runs PRAGMA wal_checkpoint(TRUNCATE), flushing all pending SQLite writes from the WAL into the main .db file.' },
            { step: 'Sync to R2',  desc: 'Litestream detects the checkpoint and uploads the updated database segments to Cloudflare R2 within seconds.' },
            { step: 'Restore',     desc: 'To recover: run litestream restore with your R2 credentials. This pulls down the latest snapshot as a .db file.' },
            { step: 'Inspect',     desc: 'Open the restored .db file in DB Browser for SQLite to browse tables, run queries, or export data.' },
          ].map(({ step, desc }, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span><span className="font-medium text-slate-800 dark:text-slate-200">{step} — </span>{desc}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

// ─── Stocks: Browse sub-tab ───────────────────────────────────────────────────
const CAP_FILTERS = [
  { value: '',      label: 'All caps' },
  { value: 'large', label: 'Large cap', color: 'text-emerald-600' },
  { value: 'mid',   label: 'Mid cap',   color: 'text-blue-600' },
  { value: 'small', label: 'Small cap', color: 'text-amber-600' },
  { value: 'micro', label: 'Micro cap', color: 'text-slate-500 dark:text-slate-400' },
];
const INDEX_FILTERS = [
  { value: '',         label: 'All' },
  { value: 'nifty50',  label: 'NIFTY 50' },
  { value: 'nifty500', label: 'NIFTY 500' },
];
const CAP_COLORS = {
  large: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid:   'bg-blue-50 text-blue-700 border-blue-200',
  small: 'bg-amber-50 text-amber-700 border-amber-200',
  micro: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600',
};

function StocksBrowseTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [q,       setQ]       = useState('');
  const [cap,     setCap]     = useState('');
  const [index,   setIndex]   = useState('');
  const [page,    setPage]    = useState(1);
  const searchRef             = useRef(null);
  const debounceRef           = useRef(null);

  async function load(params) {
    setLoading(true);
    try {
      const result = await adminListStocks(params);
      setData(result);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load({ q, cap, index, page: 1, limit: 50 });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q, cap, index]);

  useEffect(() => {
    load({ q, cap, index, page, limit: 50 });
  }, [page]);

  function fmtCap(crores) {
    if (crores == null) return '—';
    if (crores >= 100000) return `₹${(crores / 100000).toFixed(1)}L Cr`;
    if (crores >= 1000)   return `₹${(crores / 1000).toFixed(1)}K Cr`;
    return `₹${crores.toLocaleString('en-IN')} Cr`;
  }

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-3">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search symbol or company name…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Market cap chips */}
        <div className="flex gap-1 flex-wrap">
          {CAP_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setCap(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                cap === f.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Index chips */}
        <div className="flex gap-1">
          {INDEX_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setIndex(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                index === f.value
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {data && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {total.toLocaleString('en-IN')} stocks{q || cap || index ? ' matched' : ''}
        </p>
      )}

      {/* Table */}
      <SectionCard>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">No stocks found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {['Symbol', 'Company', 'Sector', 'Market Cap', 'Category', 'Index'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {rows.map(row => (
                  <tr key={row.isin} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${loading ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{row.symbol_nse}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{row.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{row.isin}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[140px] truncate">{row.sector || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">{fmtCap(row.market_cap)}</td>
                    <td className="px-4 py-3">
                      {row.market_cap_cat ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${CAP_COLORS[row.market_cap_cat]}`}>
                          {row.market_cap_cat}
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {row.is_nifty50  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">N50</span>  : null}
                        {row.is_nifty500 ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">N500</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Page {page} of {pages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              >
                ← Prev
              </button>
              {/* Page number buttons — up to 5 centered around current page */}
              {(() => {
                const total   = Math.min(5, pages);
                let start     = Math.max(1, page - 2);
                const end     = Math.min(pages, start + total - 1);
                if (end - start + 1 < total) start = Math.max(1, end - total + 1);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      p === page
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Tab: Stocks ─────────────────────────────────────────────────────────────
function StocksTab() {
  const [subTab, setSubTab] = useState('sync');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-fit">
        {[{ id: 'sync', label: 'Sync' }, { id: 'browse', label: 'Browse' }].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === t.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'sync'   && <StocksSyncPanel />}
      {subTab === 'browse' && <StocksBrowseTab />}
    </div>
  );
}

function StocksSyncPanel() {
  const [status,   setStatus]   = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const { toast, show, hide }   = useToast();
  const pollRef                 = useRef(null);

  async function loadStatus() {
    try {
      const data = await adminGetStocksStatus();
      setStatus(data);
      return data;
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
      return null;
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const data = await loadStatus();
      if (data?.sync?.status !== 'running') {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  }

  useEffect(() => {
    loadStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Resume polling if a sync was already in progress when the tab mounted
  useEffect(() => {
    if (status?.sync?.status === 'running') startPolling();
  }, [status?.sync?.status]);

  async function triggerSync() {
    setSyncing(true);
    try {
      await adminTriggerStocksSync();
      await loadStatus();
      startPolling();
    } catch (e) {
      show(e.response?.data?.error || e.message, false);
    } finally {
      setSyncing(false);
    }
  }

  const sync      = status?.sync;
  const counts    = status?.db_counts;
  const isRunning = sync?.status === 'running';
  const pct       = sync?.total > 0 ? Math.round((sync.progress / sync.total) * 100) : 0;

  const PHASE_LABELS = {
    fetching:  'Downloading NSE equity master…',
    upserting: 'Writing stocks to DB…',
    enriching: 'Fetching market caps from Yahoo Finance…',
    done:      'Complete',
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={hide} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Stocks',     value: counts?.total,           color: 'text-slate-900 dark:text-slate-100' },
          { label: 'NIFTY 50',         value: counts?.nifty50,         color: 'text-blue-600' },
          { label: 'NIFTY 500',        value: counts?.nifty500,        color: 'text-indigo-600' },
          { label: 'With Market Cap',  value: counts?.with_market_cap, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <SectionCard key={label} className="p-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>
              {value != null ? value.toLocaleString('en-IN') : '—'}
            </p>
          </SectionCard>
        ))}
      </div>

      {/* Sync control */}
      <SectionCard className="p-5">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Stock Universe Sync</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-w-sm">
              Fetches NSE equity master + NIFTY 50/500 constituents + Yahoo Finance market caps for NIFTY 500 stocks.
            </p>
          </div>
          <button
            onClick={triggerSync}
            disabled={isRunning || syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0"
          >
            {isRunning || syncing ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
            {isRunning ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {status?.last_synced_at && !isRunning && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            Last synced: {new Date(status.last_synced_at + ' UTC').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}

        {/* Progress bar */}
        {isRunning && (
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{PHASE_LABELS[sync.phase] || sync.message}</span>
              {sync.total > 0 && <span>{sync.progress.toLocaleString()} / {sync.total.toLocaleString()}</span>}
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${sync.total > 0 ? pct : 30}%` }}
              />
            </div>
          </div>
        )}

        {sync?.status === 'done' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            Completed at {new Date(sync.completedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {' · '}
            {sync.counts.total.toLocaleString()} stocks, {sync.counts.with_market_cap.toLocaleString()} with market cap
          </div>
        )}

        {sync?.status === 'error' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {sync.error}
          </div>
        )}
      </SectionCard>

      {/* Data sources */}
      <SectionCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Data Sources</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {[
            { label: 'NSE Equity Master',      source: 'archives.nseindia.com', desc: 'All NSE EQ-series stocks — symbol, ISIN, name, face value' },
            { label: 'NIFTY 50 Constituents',  source: 'archives.nseindia.com', desc: 'Index membership + sector classification for 50 stocks' },
            { label: 'NIFTY 500 Constituents', source: 'archives.nseindia.com', desc: 'Index membership + sector classification for 500 stocks' },
            { label: 'Market Capitalisation',  source: 'Yahoo Finance',          desc: 'Live market cap (₹ crores) for all NIFTY 500 stocks' },
          ].map(({ label, source, desc }) => (
            <div key={label} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full shrink-0 font-medium">
                {source}
              </span>
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
  { id: 'stocks',      label: 'Stocks Universe' },
  { id: 'backup',      label: 'Backup' },
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
        {tab === 'stocks'     && <StocksTab />}
        {tab === 'backup'     && <BackupTab />}
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
        <ErrorDoodle message={error} compact />
      )}

      {loading && !data && (
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm p-6">
          <Spinner /> Loading continuity report…
        </div>
      )}

      {/* Fund rows */}
      {filtered.length === 0 && data && !loading && (
        <div className="text-center py-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          {/* Calendar doodle — all months checked */}
          <svg width="120" height="108" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-1">
            <defs><style>{`
              @keyframes ag-bob  { 0%,100%{transform:translateY(0)}        50%{transform:translateY(-5px)} }
              @keyframes ag-sp   { 0%,100%{opacity:.2;transform:scale(1)}  50%{opacity:1;transform:scale(1.8)} }
              @keyframes ag-pop1 { 0%,15%,100%{opacity:0;transform:scale(.3)} 20%{opacity:1;transform:scale(1.1)} 25%{transform:scale(1)} }
              @keyframes ag-pop2 { 0%,30%,100%{opacity:0;transform:scale(.3)} 35%{opacity:1;transform:scale(1.1)} 40%{transform:scale(1)} }
              @keyframes ag-pop3 { 0%,50%,100%{opacity:0;transform:scale(.3)} 55%{opacity:1;transform:scale(1.1)} 60%{transform:scale(1)} }
              @keyframes ag-pop4 { 0%,65%,100%{opacity:0;transform:scale(.3)} 70%{opacity:1;transform:scale(1.1)} 75%{transform:scale(1)} }
              .ag-cal  { transform-origin:50px 50px; animation:ag-bob  3s   ease-in-out infinite; }
              .ag-sp1  { animation:ag-sp   2s   ease-in-out infinite; }
              .ag-sp2  { animation:ag-sp   2s   ease-in-out infinite .7s; }
              .ag-sp3  { animation:ag-sp   2s   ease-in-out infinite 1.4s; }
              .ag-sp4  { animation:ag-sp   2s   ease-in-out infinite 2.1s; }
              .ag-p1a  { animation:ag-pop1 3.5s ease-in-out infinite; }
              .ag-p1b  { animation:ag-pop1 3.5s ease-in-out infinite .1s; }
              .ag-p2a  { animation:ag-pop2 3.5s ease-in-out infinite; }
              .ag-p2b  { animation:ag-pop2 3.5s ease-in-out infinite .1s; }
              .ag-p3a  { animation:ag-pop3 3.5s ease-in-out infinite; }
              .ag-p3b  { animation:ag-pop3 3.5s ease-in-out infinite .1s; }
              .ag-p4a  { animation:ag-pop4 3.5s ease-in-out infinite; }
              .ag-p4b  { animation:ag-pop4 3.5s ease-in-out infinite .1s; }
              .ag-p4c  { animation:ag-pop4 3.5s ease-in-out infinite .2s; }
              .ag-p4d  { animation:ag-pop4 3.5s ease-in-out infinite .3s; }
              .ag-p4e  { animation:ag-pop4 3.5s ease-in-out infinite .4s; }
              .ag-p4f  { animation:ag-pop4 3.5s ease-in-out infinite .5s; }
            `}</style></defs>

            <g className="ag-cal">
              <rect x="18" y="22" width="64" height="56" rx="5" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5"/>
              <rect x="18" y="22" width="64" height="16" rx="5" fill="#d1fae5" stroke="#10b981" strokeWidth="1.5"/>
              <rect x="18" y="30" width="64" height="8" fill="#d1fae5"/>
              <line x1="18" y1="38" x2="82" y2="38" stroke="#10b981" strokeWidth="1"/>
              <circle cx="32" cy="18" r="4" fill="#a7f3d0" stroke="#10b981" strokeWidth="1.5"/>
              <circle cx="68" cy="18" r="4" fill="#a7f3d0" stroke="#10b981" strokeWidth="1.5"/>
              {/* Row 1 */}
              <g className="ag-p1a"><rect x="24" y="43" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M26.5 48 L28 50 L31 45" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p1b"><rect x="38" y="43" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M40.5 48 L42 50 L45 45" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p2a"><rect x="52" y="43" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M54.5 48 L56 50 L59 45" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p2b"><rect x="66" y="43" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M68.5 48 L70 50 L73 45" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              {/* Row 2 */}
              <g className="ag-p3a"><rect x="24" y="55" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M26.5 60 L28 62 L31 57" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p3b"><rect x="38" y="55" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M40.5 60 L42 62 L45 57" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p4a"><rect x="52" y="55" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M54.5 60 L56 62 L59 57" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p4b"><rect x="66" y="55" width="11" height="9" rx="2" fill="#a7f3d0"/><path d="M68.5 60 L70 62 L73 57" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              {/* Row 3 */}
              <g className="ag-p4c"><rect x="24" y="67" width="11" height="9" rx="2" fill="#6ee7b7"/><path d="M26.5 72 L28 74 L31 69" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p4d"><rect x="38" y="67" width="11" height="9" rx="2" fill="#6ee7b7"/><path d="M40.5 72 L42 74 L45 69" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p4e"><rect x="52" y="67" width="11" height="9" rx="2" fill="#6ee7b7"/><path d="M54.5 72 L56 74 L59 69" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
              <g className="ag-p4f"><rect x="66" y="67" width="11" height="9" rx="2" fill="#6ee7b7"/><path d="M68.5 72 L70 74 L73 69" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></g>
            </g>

            <circle cx="8"  cy="12" r="2"   className="ag-sp1 fill-emerald-300 dark:fill-emerald-500"/>
            <circle cx="92" cy="10" r="1.6" className="ag-sp2 fill-emerald-400 dark:fill-emerald-400"/>
            <circle cx="6"  cy="78" r="1.4" className="ag-sp3 fill-emerald-300 dark:fill-emerald-500"/>
            <circle cx="94" cy="76" r="1.8" className="ag-sp4 fill-emerald-400 dark:fill-emerald-400"/>
          </svg>

          <p className="font-semibold text-slate-600 dark:text-slate-300">All funds look good!</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No gaps or issues found matching your filters</p>
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
