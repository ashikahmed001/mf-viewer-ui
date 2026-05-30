import { useNavigate } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { useFeatureFlags } from '../context/FeatureFlagsContext.jsx';

/**
 * Drop-in upgrade prompt for gated features.
 * Usage: <UpgradePrompt feature="NAV history charts" />
 */
export default function UpgradePrompt({ feature = 'this feature', className = '' }) {
  const navigate = useNavigate();
  const { paymentsEnabled } = useFeatureFlags();

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 px-6 text-center ${className}`}>
      <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center">
        <Lock className="w-5 h-5 text-slate-400" />
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-base mb-1">Pro feature</p>
        <p className="text-slate-500 text-sm max-w-xs">
          {paymentsEnabled
            ? `${feature} is available on the Pro plan. Upgrade to unlock it along with all other Pro features.`
            : `${feature} is a Pro feature. It will be available when we launch paid plans.`}
        </p>
      </div>
      {paymentsEnabled && (
        <button
          onClick={() => navigate('/pricing')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
