import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useFeatureFlags } from '../context/FeatureFlagsContext.jsx';

/**
 * Drop-in upgrade prompt for gated features.
 * Shows a hand-drawn indigo rocket doodle when a free user hits a Pro gate.
 * Usage: <UpgradePrompt feature="NAV history charts" />
 */

function RocketDoodle() {
  return (
    <svg
      width="200"
      height="190"
      viewBox="0 0 200 190"
      role="img"
      aria-label="Rocket illustration for Pro upgrade"
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @media (prefers-color-scheme: light) {
          .up-orbit  { stroke: #e0e7ff; }
          .up-star1  { fill: #a5b4fc; }
          .up-star2  { fill: #fbbf24; }
          .up-rb     { fill: #e0e7ff; stroke: #818cf8; }
          .up-fin    { fill: #c7d2fe; stroke: #818cf8; }
          .up-win    { fill: #818cf8; }
          .up-winc   { fill: #e0e7ff; }
          .up-fl-o   { fill: #f97316; }
          .up-fl-i   { fill: #fbbf24; }
          .up-badge  { fill: #4f46e5; }
          .up-lk-bg  { fill: #eef2ff; stroke: #e0e7ff; }
          .up-lk     { stroke: #818cf8; }
          .up-lk-dot { fill: #818cf8; }
          .up-spark  { stroke: #fbbf24; }
          .up-dot    { fill: #c7d2fe; }
        }
        @media (prefers-color-scheme: dark) {
          .up-orbit  { stroke: #1e1b4b; }
          .up-star1  { fill: #818cf8; }
          .up-star2  { fill: #fbbf24; }
          .up-rb     { fill: #1e1b4b; stroke: #818cf8; }
          .up-fin    { fill: #1e1b4b; stroke: #818cf8; }
          .up-win    { fill: #4338ca; }
          .up-winc   { fill: #1e1b4b; }
          .up-fl-o   { fill: #f97316; }
          .up-fl-i   { fill: #fbbf24; }
          .up-badge  { fill: #4f46e5; }
          .up-lk-bg  { fill: #1e1b4b; stroke: #312e81; }
          .up-lk     { stroke: #818cf8; }
          .up-lk-dot { fill: #818cf8; }
          .up-spark  { stroke: #fbbf24; }
          .up-dot    { fill: #312e81; }
        }
        .up-sk { fill: none; stroke-linecap: round; stroke-linejoin: round; }
      `}</style>

      {/* orbit rings */}
      <ellipse cx="95" cy="100" rx="82" ry="46" className="up-sk up-orbit" strokeWidth="0.9" strokeDasharray="5 5" />
      <ellipse cx="95" cy="100" rx="55" ry="30" className="up-sk up-orbit" strokeWidth="0.7" strokeDasharray="3 6" />

      {/* stars */}
      <circle cx="22" cy="28" r="4" className="up-star1" opacity="0.8" />
      <circle cx="160" cy="20" r="3" className="up-star2" opacity="0.75" />
      <circle cx="166" cy="118" r="2.5" className="up-star1" opacity="0.6" />
      <circle cx="18" cy="116" r="2" className="up-star1" opacity="0.55" />

      {/* spark lines off amber star */}
      <g className="up-sk up-spark" strokeWidth="1.3">
        <line x1="160" y1="14" x2="163" y2="9" />
        <line x1="162" y1="15" x2="167" y2="15" />
        <line x1="160" y1="26" x2="163" y2="31" />
        <line x1="22" y1="22" x2="25" y2="17" />
        <line x1="24" y1="22" x2="24" y2="16" />
      </g>

      {/* rocket — tilted left */}
      <g transform="translate(68,14) rotate(-12,34,68)">
        {/* nose */}
        <path d="M34,0 C34,0 10,22 8,68 L60,68 C58,22 34,0 34,0Z" className="up-sk up-rb" strokeWidth="1.5" />
        {/* body */}
        <rect x="8" y="68" width="52" height="52" rx="4" className="up-sk up-rb" strokeWidth="1.5" />
        {/* window */}
        <circle cx="34" cy="92" r="13" className="up-win" opacity="0.55" />
        <circle cx="34" cy="92" r="7"  className="up-winc" opacity="0.3" />
        {/* fins */}
        <path d="M8,106 L-10,134 L8,122Z"  className="up-sk up-fin" strokeWidth="1.4" />
        <path d="M60,106 L78,134 L60,122Z" className="up-sk up-fin" strokeWidth="1.4" />
        {/* flame outer */}
        <path d="M14,120 C14,120 24,152 34,156 C44,152 54,120 54,120Z" className="up-fl-o" opacity="0.9" />
        {/* flame inner */}
        <path d="M20,120 C20,120 28,146 34,150 C40,146 48,120 48,120Z" className="up-fl-i" />
        {/* PRO badge */}
        <rect x="12" y="30" width="44" height="18" rx="9" className="up-badge" />
        <text
          x="34" y="43"
          textAnchor="middle"
          fontFamily="system-ui,sans-serif"
          fontSize="10"
          fontWeight="700"
          fill="white"
        >PRO</text>
      </g>

      {/* lock badge */}
      <g transform="translate(130,130)">
        <rect x="0" y="0" width="42" height="42" rx="12" className="up-sk up-lk-bg" strokeWidth="1.4" />
        {/* shackle */}
        <path d="M13,19 L13,13 C13,7.5 29,7.5 29,13 L29,19" className="up-sk up-lk" strokeWidth="2.2" />
        {/* body */}
        <rect x="9" y="19" width="24" height="18" rx="4" className="up-sk up-lk" strokeWidth="2.2" />
        {/* keyhole */}
        <circle cx="21" cy="27" r="3.2" className="up-lk-dot" opacity="0.7" />
        <line x1="21" y1="30" x2="21" y2="35" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      {/* trail dots */}
      <g className="up-dot">
        <circle cx="60" cy="172" r="3" />
        <circle cx="50" cy="181" r="2.2" />
        <circle cx="42" cy="188" r="1.5" />
      </g>
    </svg>
  );
}

export default function UpgradePrompt({ feature = 'this feature', className = '' }) {
  const navigate = useNavigate();
  const { paymentsEnabled } = useFeatureFlags();

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 px-6 text-center ${className}`}>
      <RocketDoodle />

      <div className="space-y-1.5 -mt-2">
        <p className="font-semibold text-slate-800 text-base">Pro feature</p>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
          {paymentsEnabled
            ? `${feature} is available on the Pro plan. Upgrade to unlock it along with all other Pro features.`
            : `${feature} is a Pro feature. It will be available when we launch paid plans.`}
        </p>
      </div>

      {paymentsEnabled && (
        <button
          onClick={() => navigate('/pricing')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm mt-1"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
