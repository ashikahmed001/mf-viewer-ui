import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Calendar, ChevronRight, Search } from 'lucide-react';
import { getFunds } from '../api/client.js';

// ─── AMC logo helpers ─────────────────────────────────────────────────────────

// Longest prefix first so "Aditya Birla" matches before a shorter key
const AMC_MAP = [
  ['Aditya Birla',       'mutualfund.adityabirlacapital.com'],
  ['Mahindra Manulife',  'mahindramanulifemf.com'],
  ['Parag Parikh',       'ppfas.com'],
  ['Motilal Oswal',      'motilaloswalmf.com'],
  ['Canara Robeco',      'canararobeco.com'],
  ['WhiteOak',           'whiteoakcapital.com'],
  ['White Oak',          'whiteoakcapital.com'],
  ['Mirae Asset',        'miraeassetmf.co.in'],
  ['Nippon India',       'mf.nipponindiaim.com'],
  ['Franklin Templeton', 'franklintempletonindia.com'],
  ['Franklin',           'franklintempletonindia.com'],
  ['ICICI Prudential',   'icicipruamc.com'],
  ['ICICI',              'icicipruamc.com'],
  ['Bajaj Finserv',      'mutualfund.bajajfinserv.in'],
  ['Baroda BNP',         'barodabnpparibas.com'],
  ['Baroda',             'barodabnpparibas.com'],
  ['JM Financial',       'jmfinancialmf.com'],
  ['360 ONE',            '360.one'],
  ['HDFC',               'hdfcfund.com'],
  ['quant',              'quantmutualfund.com'],
  ['SBI',                'sbimf.com'],
  ['UTI',                'utimf.com'],
  ['Axis',               'axismf.com'],
  ['Kotak',              'kotakmf.com'],
  ['Tata',               'tatamutualfund.com'],
  ['DSP',                'dspim.com'],
  ['Bandhan',            'bandhanmf.com'],
  ['Edelweiss',          'edelweissmf.com'],
  ['Invesco',            'invescomutualfund.com'],
  ['Sundaram',           'sundarammutual.com'],
  ['PGIM',               'pgimindiamf.com'],
  ['Navi',               'navimf.com'],
  ['Groww',              'groww.in'],
  ['Helios',             'heliosmf.in'],
  ['Samco',              'samco.in'],
  ['Union',              'unionmf.com'],
  ['LIC',                'licmf.com'],
  ['ITI',                'itimf.com'],
  ['Trust',              'trustmf.com'],
  ['NJ',                 'njmutualfund.in'],
  ['Zerodha',            'zerodhaassetmanagement.com'],
];

function getAmcDomain(fundName) {
  const lower = fundName.toLowerCase();
  for (const [prefix, domain] of AMC_MAP) {
    if (lower.startsWith(prefix.toLowerCase())) return domain;
  }
  return null;
}

function getInitials(name) {
  const words = name.split(' ').filter(w => w.length > 1);
  if (!words.length) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

function avatarColor(name) {
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function AmcLogo({ name }) {
  const [failed, setFailed] = useState(false);
  const domain = getAmcDomain(name);

  if (!failed && domain) {
    return (
      <img
        src={`https://logo.clearbit.com/${domain}?size=80`}
        alt=""
        onError={() => setFailed(true)}
        className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-slate-100 dark:border-slate-700 flex-shrink-0"
      />
    );
  }

  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(name)}`}>
      {getInitials(name)}
    </div>
  );
}

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

// Deterministic color per month — same month always gets the same color
const MONTH_COLORS = [
  'bg-indigo-50  text-indigo-600  border-indigo-100',   // Jan
  'bg-rose-50    text-rose-600    border-rose-100',      // Feb
  'bg-emerald-50 text-emerald-600 border-emerald-100',  // Mar
  'bg-amber-50   text-amber-600   border-amber-100',    // Apr
  'bg-violet-50  text-violet-600  border-violet-100',   // May
  'bg-sky-50     text-sky-600     border-sky-100',      // Jun
  'bg-orange-50  text-orange-600  border-orange-100',   // Jul
  'bg-teal-50    text-teal-600    border-teal-100',     // Aug
  'bg-pink-50    text-pink-600    border-pink-100',     // Sep
  'bg-cyan-50    text-cyan-600    border-cyan-100',     // Oct
  'bg-lime-50    text-lime-600    border-lime-100',     // Nov
  'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100', // Dec
];

function monthBadgeClass(dateStr) {
  if (!dateStr) return MONTH_COLORS[0];
  const month = new Date(dateStr).getMonth(); // 0–11
  return MONTH_COLORS[month];
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mutual Fund Holdings</h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Browse portfolio composition and analytics for all tracked funds</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search funds…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
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
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">No funds found</p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fund => (
            <Link key={fund.id} to={`/funds/${fund.id}`}>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm
                              hover:shadow-md hover:border-indigo-200 transition-all group h-36 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AmcLogo name={fund.name} />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-3 group-hover:text-indigo-700 transition-colors">
                      {fund.name}
                    </h2>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors" />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {fund.extraction_count || 0} month{fund.extraction_count !== 1 ? 's' : ''}
                  </span>
                  <span className={`border rounded-full px-2 py-0.5 font-medium ${monthBadgeClass(fund.last_month)}`}>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 shadow-sm text-center">
      <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}
