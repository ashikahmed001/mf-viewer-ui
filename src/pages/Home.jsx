import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Calendar, ChevronRight, Search } from 'lucide-react';
import { getFunds } from '../api/client.js';

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

export default function Home() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getFunds()
      .then(setFunds)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = funds.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
      <p className="font-semibold">Failed to load funds</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Mutual Fund Holdings</h1>
        <p className="text-slate-500 mt-1">Browse portfolio composition and analytics for all tracked funds</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search funds…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard value={funds.length} label="Total Funds" />
          <StatCard value={funds.reduce((a, b) => a + (b.extraction_count || 0), 0)} label="Total Extractions" />
          <StatCard value={filtered.length} label="Showing" />
        </div>
      )}

      {/* Fund cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No funds found</p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fund => (
            <Link key={fund.id} to={`/funds/${fund.id}`}>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm
                              hover:shadow-md hover:border-blue-200 transition-all group h-36 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-3 group-hover:text-blue-700 transition-colors">
                      {fund.name}
                    </h2>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {fund.extraction_count || 0} month{fund.extraction_count !== 1 ? 's' : ''}
                  </span>
                  <span className="bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-medium">
                    {fmtMonth(fund.last_month)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
