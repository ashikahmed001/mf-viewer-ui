import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Home, Layers, Flame, Newspaper, Settings, Zap } from 'lucide-react';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { useFeatureFlags } from '../context/FeatureFlagsContext.jsx';

const ADMIN_EMAIL = 'ashikahmed001@gmail.com';

export default function Layout({ children }) {
  const location = useLocation();
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;
  const { isPro } = useSubscription();
  const { paymentsEnabled } = useFeatureFlags();

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
            <nav className="flex items-center gap-6 text-sm font-medium">
              <NavLink to="/"         icon={<Newspaper className="w-4 h-4" />} label="Feed"     active={location.pathname === '/'} />
              <NavLink to="/funds"    icon={<Home      className="w-4 h-4" />} label="Funds"    active={location.pathname === '/funds'} />
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
