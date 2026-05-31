import { Link, useLocation } from 'react-router-dom';
import { Home, Layers, Flame, Newspaper, Settings, Zap, Sun, Moon, Clock, X, Menu } from 'lucide-react';
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
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
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
                             bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                             bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

// ─── FundSight logo ───────────────────────────────────────────────────────────

function FundSightLogo() {
  return (
    <span className="flex items-center gap-2.5">
      {/* Icon badge */}
      <svg width="32" height="32" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="48" height="48" rx="11" fill="#4f46e5"/>
        <line x1="11" y1="7"  x2="11" y2="34" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
        <line x1="24" y1="9"  x2="24" y2="34" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.65"/>
        <line x1="37" y1="5"  x2="37" y2="34" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.85"/>
        <rect x="7.5"  y="12" width="7" height="16" rx="2" fill="white" opacity="0.55"/>
        <rect x="20.5" y="15" width="7" height="13" rx="2" fill="white" opacity="0.7"/>
        <rect x="33.5" y="9"  width="7" height="18" rx="2" fill="white"/>
        <circle cx="37" cy="36" r="9" fill="none" stroke="white" strokeWidth="2.2"/>
        <circle cx="37" cy="36" r="9" fill="white" opacity="0.08"/>
        <line x1="43.5" y1="42.5" x2="47" y2="46" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      {/* Wordmark */}
      <span className="text-lg font-bold tracking-tight text-white">
        Fund<span className="text-violet-300">Sight</span>
      </span>
    </span>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef(null);

  // Close prefs panel on outside click
  useEffect(() => {
    function handle(e) { if (panelRef.current && !panelRef.current.contains(e.target)) setShowPrefs(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const ThemeIcon = prefs.mode === 'dark' ? Moon : prefs.mode === 'light' ? Sun : Clock;

  const navItems = [
    { to: '/',         icon: <Newspaper className="w-5 h-5" />, label: 'Feed',     active: location.pathname === '/'                  },
    { to: '/funds',    icon: <Home      className="w-5 h-5" />, label: 'Funds',    active: location.pathname.startsWith('/funds')      },
    { to: '/analysis', icon: <Layers    className="w-5 h-5" />, label: 'Analysis', active: location.pathname === '/analysis'           },
    { to: '/rising',   icon: <Flame     className="w-5 h-5" />, label: 'Rising',   active: location.pathname === '/rising'             },
    ...(isAdmin ? [{ to: '/admin', icon: <Settings className="w-5 h-5" />, label: 'Admin', active: location.pathname === '/admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="bg-slate-900 text-white shadow-lg no-print sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <FundSightLogo />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-3 text-sm font-medium">
              {navItems.map(({ to, icon, label, active }) => (
                <NavLink key={to} to={to} icon={icon} label={label} active={active} />
              ))}
              {paymentsEnabled && !isPro && (
                <Link to="/pricing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white transition-colors">
                  <Zap className="w-3.5 h-3.5" /> Upgrade
                </Link>
              )}
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

            {/* Mobile: theme + avatar + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setShowPrefs(v => !v)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <ThemeIcon className="w-4 h-4" />
              </button>
              <UserButton afterSignOutUrl="/sign-in" />
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile prefs panel (inline, below header) */}
        {showPrefs && (
          <div className="md:hidden border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <PreferencesPanel onClose={() => setShowPrefs(false)} />
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`fixed top-16 right-0 bottom-0 z-30 w-72 bg-slate-900 shadow-2xl transform transition-transform duration-200 md:hidden
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <nav className="flex flex-col p-4 gap-1">
          {navItems.map(({ to, icon, label, active }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {icon}
              {label}
            </Link>
          ))}

          {paymentsEnabled && !isPro && (
            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white transition-colors mt-2"
            >
              <Zap className="w-5 h-5" /> Upgrade to Pro
            </Link>
          )}
        </nav>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs text-center py-4 no-print">
        FundSight — read-only mutual fund analytics
      </footer>
    </div>
  );
}

function NavLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
        active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
