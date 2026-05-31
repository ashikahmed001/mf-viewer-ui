import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle,
  Loader2, Plus, Trash2, ChevronDown, ChevronUp, Save, RotateCcw,
  Info, AlertCircle,
} from 'lucide-react';
import { uploadSingleFile, uploadBatchStream, importExtraction } from '../../api/client.js';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const DRAFT_KEY = 'fs_upload_drafts';

function loadDrafts()        { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); } catch { return []; } }
function saveDrafts(drafts)  { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); }
function clearDrafts()       { localStorage.removeItem(DRAFT_KEY); }

// ─── Utility ──────────────────────────────────────────────────────────────────
function fmtMonth(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

function confColor(label) {
  if (!label) return 'bg-slate-100 text-slate-600 border-slate-200';
  const l = label.toLowerCase();
  if (l === 'high')   return 'bg-green-100  text-green-800  border-green-200';
  if (l === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

// ─── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((files) => {
    const xlsx = [...files].filter(f => /\.(xlsx|xls)$/i.test(f.name));
    if (xlsx.length) onFiles(xlsx);
  }, [onFiles]);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
        ${dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={e => handle(e.target.files)}
        disabled={disabled}
      />
      <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center">
        <Upload className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">Drop Excel files here</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">or click to browse · .xlsx / .xls · up to 20 files</p>
      </div>
    </div>
  );
}

// ─── FileCard (upload progress) ───────────────────────────────────────────────
function FileCard({ item, onRemove }) {
  const statusIcon = {
    pending:    <FileSpreadsheet className="w-5 h-5 text-slate-400" />,
    extracting: <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />,
    done:       <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error:      <AlertTriangle className="w-5 h-5 text-red-500" />,
  }[item.status] ?? null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
        {item.status === 'extracting' && (
          <p className="text-xs text-indigo-500 mt-0.5">Extracting… {item.elapsed}s</p>
        )}
        {item.status === 'done' && (
          <p className="text-xs text-emerald-600 mt-0.5">{item.result?.holdings?.length ?? 0} holdings · {fmtMonth(item.result?.report_month)}</p>
        )}
        {item.status === 'error' && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{item.error}</p>
        )}
      </div>
      {(item.status === 'pending' || item.status === 'error') && (
        <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Conflict Modal ───────────────────────────────────────────────────────────
function ConflictModal({ info, onReplace, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Extraction already exists</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-medium text-slate-700 dark:text-slate-200">{info.fund_name}</span> already has{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{info.existing_holding_count} holdings</span> for{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{fmtMonth(info.month)}</span>.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          Replacing will permanently delete the existing extraction and all its holdings. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onReplace} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
            Replace Existing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HoldingsEditor ───────────────────────────────────────────────────────────
function HoldingsEditor({ holdings, onChange }) {
  const [expanded, setExpanded] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { row, col }

  function updateCell(rowIdx, field, value) {
    const updated = holdings.map((h, i) =>
      i === rowIdx ? { ...h, [field]: value } : h
    );
    onChange(updated);
  }

  function addRow() {
    onChange([...holdings, { stock_name: '', isin: '', quantity: null, market_value: null, pct_nav: null, industry: '', rating: null }]);
  }

  function removeRow(idx) {
    onChange(holdings.filter((_, i) => i !== idx));
  }

  const COLS = [
    { key: 'stock_name',   label: 'Stock Name',    type: 'text',   width: 'min-w-[200px]' },
    { key: 'isin',         label: 'ISIN',           type: 'text',   width: 'min-w-[130px]' },
    { key: 'industry',     label: 'Industry',       type: 'text',   width: 'min-w-[160px]' },
    { key: 'quantity',     label: 'Quantity',       type: 'number', width: 'min-w-[110px]' },
    { key: 'market_value', label: 'Market Value',   type: 'number', width: 'min-w-[120px]' },
    { key: 'pct_nav',      label: '% NAV',          type: 'number', width: 'min-w-[90px]'  },
    { key: 'rating',       label: 'Rating',         type: 'text',   width: 'min-w-[80px]'  },
  ];

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
          Holdings <span className="ml-1.5 text-xs font-normal text-slate-400">({holdings.length} rows)</span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-8">#</th>
                  {COLS.map(c => (
                    <th key={c.key} className={`px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ${c.width}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {holdings.map((h, ri) => (
                  <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
                    <td className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">{ri + 1}</td>
                    {COLS.map(col => (
                      <td key={col.key} className={`px-1 py-1 ${col.width}`}>
                        <input
                          type={col.type}
                          value={h[col.key] ?? ''}
                          onChange={e => {
                            const val = col.type === 'number'
                              ? (e.target.value === '' ? null : Number(e.target.value))
                              : e.target.value;
                            updateCell(ri, col.key, val);
                          }}
                          className="w-full px-2 py-1 text-sm rounded-lg border border-transparent focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none bg-transparent dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 transition-colors"
                        />
                      </td>
                    ))}
                    <td className="px-2">
                      <button onClick={() => removeRow(ri)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Add row
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ExtractionReview ─────────────────────────────────────────────────────────
function ExtractionReview({ draft, onDiscard, onSaved }) {
  const [data, setData] = useState(() => ({
    fund_name:    draft.fund_name    || '',
    report_month: draft.report_month || '',
    source_file:  draft.source_file  || '',
    confidence:   draft.confidence   || { score: 100, label: 'high' },
    holdings:     draft.holdings     || [],
    notes:        draft.notes        || '',
  }));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [toast, setToast]   = useState(null);
  const navigate = useNavigate();

  function update(patch) { setData(d => ({ ...d, ...patch })); }

  async function handleConfirm(replace = false) {
    setSaving(true);
    setConflict(null);
    try {
      const res = await importExtraction(data, replace);
      setToast({ type: 'success', msg: `Saved! ${res.holding_count} holdings for "${res.fund_name}"` });
      setTimeout(() => {
        onSaved?.();
        navigate(`/funds/${res.fund_id}`);
      }, 1500);
    } catch (err) {
      if (err.response?.status === 409) {
        const info = err.response.data;
        setConflict({ ...info, fund_name: data.fund_name, month: data.report_month });
      } else {
        setToast({ type: 'error', msg: err.response?.data?.error || err.message });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Conflict modal */}
      {conflict && (
        <ConflictModal
          info={conflict}
          onReplace={() => handleConfirm(true)}
          onCancel={() => setConflict(null)}
        />
      )}

      {/* Metadata card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Extraction Details</h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${confColor(data.confidence?.label)}`}>
            {(data.confidence?.label || 'unknown').charAt(0).toUpperCase() + (data.confidence?.label || '').slice(1)} · {data.confidence?.score ?? '?'}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Fund Name</label>
            <input
              value={data.fund_name}
              onChange={e => update({ fund_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Fund name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Report Month</label>
            <input
              type="month"
              value={data.report_month?.slice(0, 7) || ''}
              onChange={e => update({ report_month: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Source File</label>
            <input
              value={data.source_file}
              onChange={e => update({ source_file: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Source file name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
            <input
              value={data.notes}
              onChange={e => update({ notes: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Optional notes"
            />
          </div>
        </div>

        {data.confidence?.deductions?.length > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Confidence deductions: </span>
              {data.confidence.deductions.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Holdings editor */}
      <HoldingsEditor
        holdings={data.holdings}
        onChange={h => update({ holdings: h })}
      />

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          onClick={onDiscard}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Discard
        </button>
        <button
          onClick={() => handleConfirm(false)}
          disabled={saving || !data.fund_name || !data.report_month || data.holdings.length === 0}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : `Confirm & Save (${data.holdings.length} holdings)`}
        </button>
      </div>
    </div>
  );
}

// ─── Main UploadTab ───────────────────────────────────────────────────────────
export default function UploadTab() {
  const [files, setFiles]     = useState([]);   // { id, name, status, elapsed, result, error }
  const [phase, setPhase]     = useState('upload');  // 'upload' | 'review'
  const [drafts, setDrafts]   = useState([]);   // completed extraction results
  const [activeDraft, setActiveDraft] = useState(0);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(null);
  const timersRef = useRef({});

  // Restore drafts from localStorage on mount
  useEffect(() => {
    const saved = loadDrafts();
    if (saved.length > 0) {
      setDrafts(saved);
      setPhase('review');
    }
  }, []);

  function addFiles(newFiles) {
    const items = newFiles.map(f => ({ id: crypto.randomUUID(), name: f.name, file: f, status: 'pending' }));
    setFiles(prev => [...prev, ...items]);
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function updateFile(id, patch) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function startTimer(id) {
    let elapsed = 0;
    timersRef.current[id] = setInterval(() => {
      elapsed++;
      updateFile(id, { elapsed });
    }, 1000);
  }

  function stopTimer(id) {
    clearInterval(timersRef.current[id]);
    delete timersRef.current[id];
  }

  async function runExtraction() {
    const pending = files.filter(f => f.status === 'pending');
    if (!pending.length) return;
    setRunning(true);

    if (pending.length === 1) {
      // Single file path
      const item = pending[0];
      updateFile(item.id, { status: 'extracting', elapsed: 0 });
      startTimer(item.id);
      try {
        const result = await uploadSingleFile(item.file);
        stopTimer(item.id);
        updateFile(item.id, { status: 'done', result });
        const newDrafts = [result];
        saveDrafts(newDrafts);
        setDrafts(newDrafts);
        setPhase('review');
      } catch (err) {
        stopTimer(item.id);
        updateFile(item.id, { status: 'error', error: err.response?.data?.error || err.message });
      }
    } else {
      // Batch path: SSE stream
      pending.forEach(f => updateFile(f.id, { status: 'extracting', elapsed: 0 }));
      pending.forEach(f => startTimer(f.id));

      const completed = [];
      const fileMap = Object.fromEntries(pending.map(f => [f.name, f.id]));

      const cancel = uploadBatchStream(
        pending.map(f => f.file),
        {
          onProgress: ({ file }) => {
            const id = fileMap[file];
            if (id) updateFile(id, { status: 'extracting' });
          },
          onResult: ({ file, status, result, error }) => {
            const id = fileMap[file];
            if (!id) return;
            stopTimer(id);
            if (status === 'done' && result) {
              updateFile(id, { status: 'done', result });
              completed.push(result);
            } else {
              updateFile(id, { status: 'error', error: error || 'Unknown error' });
            }
          },
          onDone: () => {
            cancelRef.current = null;
            setRunning(false);
            if (completed.length > 0) {
              saveDrafts(completed);
              setDrafts(completed);
              setActiveDraft(0);
              setPhase('review');
            }
          },
          onError: ({ error }) => {
            pending.forEach(f => {
              stopTimer(f.id);
              updateFile(f.id, { status: 'error', error });
            });
            setRunning(false);
          },
        }
      );
      cancelRef.current = cancel;
      return; // done in onDone callback
    }

    setRunning(false);
  }

  function cancelExtraction() {
    cancelRef.current?.();
    cancelRef.current = null;
    Object.keys(timersRef.current).forEach(stopTimer);
    setFiles(prev => prev.map(f =>
      f.status === 'extracting' ? { ...f, status: 'pending', elapsed: undefined } : f
    ));
    setRunning(false);
  }

  function handleDiscard() {
    const remaining = drafts.filter((_, i) => i !== activeDraft);
    if (remaining.length === 0) {
      clearDrafts();
      setDrafts([]);
      setFiles([]);
      setPhase('upload');
      setActiveDraft(0);
    } else {
      saveDrafts(remaining);
      setDrafts(remaining);
      setActiveDraft(Math.min(activeDraft, remaining.length - 1));
    }
  }

  function handleSaved() {
    handleDiscard();
  }

  const pendingCount   = files.filter(f => f.status === 'pending').length;
  const extractingCount = files.filter(f => f.status === 'extracting').length;
  const doneCount      = files.filter(f => f.status === 'done').length;

  // ── Review phase ────────────────────────────────────────────────────────────
  if (phase === 'review' && drafts.length > 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Review Extraction</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Verify and edit the extracted data before saving to the database.
            </p>
          </div>
          {drafts.length > 1 && (
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
              {drafts.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setActiveDraft(i)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeDraft === i
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {d.fund_name?.split(' ').slice(0, 2).join(' ') || `File ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <ExtractionReview
          key={activeDraft}
          draft={drafts[activeDraft]}
          onDiscard={handleDiscard}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  // ── Upload phase ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Upload & Extract</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Upload one or more fund Excel files. Data will be extracted and shown for review before saving.
        </p>
      </div>

      <DropZone onFiles={addFiles} disabled={running} />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(item => (
            <FileCard key={item.id} item={item} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* Stats bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
          {doneCount > 0      && <span className="text-emerald-600 font-medium">{doneCount} done</span>}
          {extractingCount > 0 && <span className="text-indigo-600 font-medium animate-pulse">{extractingCount} extracting…</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {running ? (
          <button
            onClick={cancelExtraction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        ) : (
          <>
            <button
              onClick={runExtraction}
              disabled={pendingCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              {pendingCount === 0 ? 'No files pending' : `Extract ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
            </button>
            {files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Clear all
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
