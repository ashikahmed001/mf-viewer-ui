import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Home, Layers, Flame, Newspaper, Settings, Zap, Sun, Moon, Clock, X } from 'lucide-react';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useState, useRef, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { useFeatureFlags } from '../context/FeatureFlagsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const ADMIN_EMAIL = 'ashikahmed001@gmail.com';

// ─── Preferences panel ────────────────────────────────────────────────────────

const MODES = [
  { id: 'light', label: 'Light',     Icon: Sun  },
  { id: 'dark',  label: 'Dark',      Icon: Moon },
  { id: 'auto',  label: 'Auto',      Icon: Clock },
];

function fmt12(h) {
  if (h === 0)  return '12 am';
  if (h === 12) return '12 pm';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function PreferencesPanel({ onClose }) {
  const { prefs, updatePrefs, isDark, nextSwitchLabel } = useTheme();

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Preferences</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme mode */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Theme</p>
        <div className="grid grid-cols-3 gap-1.5">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => updatePrefs({ mode: id })}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors
                ${prefs.mode === id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Auto mode detail */}
        {prefs.mode === 'auto' && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Day window</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {fmt12(prefs.dayStart)} — {fmt12(prefs.dayEnd)}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-0.5 block">From</label>
                <select
                  value={prefs.dayStart}
                  onChange={e => updatePrefs({ dayStart: +e.target.value })}
                  className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5
                             bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 13 }, (_, i) => i).map(h => (
                    <option key={h} value={h}>{fmt12(h)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-0.5 block">To</label>
                <select
                  value={prefs.dayEnd}
                  onChange={e => updatePrefs({ dayEnd: +e.target.value })}
                  className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5
                             bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 13 }, (_, i) => i + 12).map(h => (
                    <option key={h} value={h}>{fmt12(h)}</option>
                  ))}
                </select>
              </div>
            </div>
            {nextSwitchLabel() && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-0.5">{nextSwitchLabel()}</p>
            )}
          </div>
        )}
      </div>

      {/* Current state pill */}
      <div className="px-4 py-3 flex items-center gap-2">
        {isDark
          ? <Moon className="w-3.5 h-3.5 text-slate-400" />
          : <Sun  className="w-3.5 h-3.5 text-amber-500" />
        }
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Currently showing <span className="font-medium text-slate-700 dark:text-slate-200">{isDark ? 'dark' : 'light'}</span> theme
        </span>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const location = useLocation();
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;
  const { isPro } = useSubscription();
  const { paymentsEnabled } = useFeatureFlags();
  const { isDark, prefs } = useTheme();

  const [showPrefs, setShowPrefs] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    function handle(e) { if (panelRef.current && !panelRef.current.contains(e.target)) setShowPrefs(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const ThemeIcon = prefs.mode === 'dark' ? Moon : prefs.mode === 'light' ? Sun : Clock;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="bg-slate-900 text-white shadow-lg no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:text-blue-300 transition-colors">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <span>MF Portfolio Viewer</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <NavLink to="/"         icon={<Newspaper className="w-4 h-4" />} label="Feed"     active={location.pathname === '/'} />
              <NavLink to="/funds"    icon={<Home      className="w-4 h-4" />} label="Funds"    active={location.pathname.startsWith('/funds')} />
              <NavLink to="/analysis" icon={<Layers    className="w-4 h-4" />} label="Analysis" active={location.pathname === '/analysis'} />
              <NavLink to="/rising"   icon={<Flame     className="w-4 h-4" />} label="Rising"   active={location.pathname === '/rising'} />
              {isAdmin && (
                <NavLink to="/admin" icon={<Settings className="w-4 h-4" />} label="Admin" active={location.pathname === '/admin'} />
              )}
              {paymentsEnabled && !isPro && (
                <Link
                  to="/pricing"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" /> Upgrade
                </Link>
              )}

              {/* Theme preferences button */}
              <div ref={panelRef} className="relative">
                <button
                  onClick={() => setShowPrefs(v => !v)}
                  title="Theme preferences"
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                    ${showPrefs ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                  <ThemeIcon className="w-4 h-4" />
                </button>
                {showPrefs && <PreferencesPanel onClose={() => setShowPrefs(false)} />}
              </div>

              <UserButton afterSignOutUrl="/sign-in" />
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs text-center py-4 no-print">
        MF Portfolio Viewer — read-only analytics dashboard
      </footer>
    </div>
  );
}

function NavLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
