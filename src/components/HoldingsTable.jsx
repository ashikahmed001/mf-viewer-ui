import { useState } from 'react';
import { ChevronUp, ChevronDown, Search, Filter, X } from 'lucide-react';
import { industryBadgeClass } from '../utils/industryColors.js';
import CapBadge from './CapBadge.jsx';
import { useStockDialog } from '../context/StockDialogContext.jsx';

function fmt(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const COLUMNS = [
  { key: 'stock_name',   label: 'Stock',             sortable: true },
  { key: 'industry',     label: 'Industry',          sortable: false },
  { key: 'rating',       label: 'Rating',            sortable: false },
  { key: 'quantity',     label: 'Quantity',          sortable: true,  align: 'right' },
  { key: 'market_value', label: 'Market Value (L)',  sortable: true,  align: 'right' },
  { key: 'pct_nav',      label: '% NAV',             sortable: true,  align: 'right' },
];

export default function HoldingsTable({
  holdings = [],
  industries = [],
  sort, order, industry, search,
  onSort, onIndustry, onSearch,
  loading,
  scale = 1,
}) {
  const { openStockDialog } = useStockDialog();

  function handleSort(key) {
    if (sort === key) {
      onSort(key, order === 'desc' ? 'asc' : 'desc');
    } else {
      onSort(key, 'desc');
    }
  }

  const SortIcon = ({ col }) => {
    if (sort !== col.key) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return order === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-500" />
      : <ChevronDown className="w-3 h-3 text-indigo-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by stock name or ISIN…"
            value={search || ''}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {search && (
            <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={industry || ''}
            onChange={e => onIndustry(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm appearance-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
          >
            <option value="">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 self-center whitespace-nowrap">
          {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-8 w-full" />
            ))}
          </div>
        ) : holdings.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No holdings found</p>
            {(search || industry) && (
              <p className="text-sm mt-1">Try clearing your filters</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide
                                ${col.align === 'right' ? 'text-right' : 'text-left'}
                                ${col.sortable ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="flex items-center gap-1 justify-start"
                          style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {col.label}
                      {col.sortable && <SortIcon col={col} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {holdings.map((h, idx) => (
                <tr key={h.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 max-w-[260px]">
                    <button
                      onClick={() => openStockDialog({ isin: h.isin, stock_name: h.stock_name, market_cap_cat: h.market_cap_cat, industry: h.industry })}
                      title={h.stock_name}
                      className="flex flex-col items-start min-w-0 text-left hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 w-full">
                        <span className="truncate group-hover:underline underline-offset-2">{h.stock_name}</span>
                        <CapBadge cap={h.market_cap_cat} />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 tracking-wide">{h.isin}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {h.industry ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${industryBadgeClass(h.industry)}`}>
                        {h.industry}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {h.rating ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {h.rating}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{fmt(h.quantity, 0)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{fmt(h.market_value)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {(() => {
                      const pct = (h.pct_nav || 0) * scale;
                      return (
                        <span className={pct >= 5 ? 'text-indigo-700' : pct >= 2 ? 'text-slate-700' : 'text-slate-500'}>
                          {fmt(pct, 2)}%
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
