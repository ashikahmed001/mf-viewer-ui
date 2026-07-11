/**
 * ErrorDoodle — sleeping server illustration for error states.
 * Props:
 *   message  — string shown below the doodle (default: "Something went wrong")
 *   compact  — boolean, smaller inline variant (default: false)
 */
export default function ErrorDoodle({ message = 'Something went wrong', compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
        <svg width="100" height="72" viewBox="0 0 100 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Server rack — bottom */}
          <rect x="12" y="44" width="60" height="14" rx="3" fill="#e0e7ff" stroke="#818cf8" strokeWidth="1.5"/>
          {/* LED lights bottom */}
          <circle cx="22" cy="51" r="2.5" fill="#6ee7b7"/>
          <circle cx="30" cy="51" r="2.5" fill="#fca5a5"/>
          {/* Disk slot bottom */}
          <rect x="38" y="48" width="28" height="4" rx="1.5" fill="#c7d2fe" opacity="0.8"/>
          {/* Server rack — top */}
          <rect x="12" y="28" width="60" height="14" rx="3" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="1.5"/>
          {/* LED lights top */}
          <circle cx="22" cy="35" r="2.5" fill="#6ee7b7" opacity="0.5"/>
          <circle cx="30" cy="35" r="2.5" fill="#fca5a5" opacity="0.5"/>
          {/* Disk slot top */}
          <rect x="38" y="32" width="28" height="4" rx="1.5" fill="#ede9fe" opacity="0.8"/>
          {/* Sleepy eyes */}
          <path d="M50 33 Q53 30 56 33" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M60 33 Q63 30 66 33" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          {/* Z Z Z */}
          <text x="74" y="28" fontSize="9" fontWeight="600" fill="#f59e0b" opacity="0.9">z</text>
          <text x="80" y="21" fontSize="11" fontWeight="600" fill="#f59e0b" opacity="0.7">z</text>
          <text x="88" y="13" fontSize="13" fontWeight="600" fill="#f59e0b" opacity="0.5">z</text>
        </svg>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 gap-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Shadow under stack */}
        <ellipse cx="62" cy="108" rx="42" ry="5" fill="#e2e8f0" opacity="0.6"/>
        {/* Server rack — bottom */}
        <rect x="12" y="70" width="100" height="22" rx="5" fill="#e0e7ff" stroke="#818cf8" strokeWidth="2"/>
        {/* LED row bottom */}
        <circle cx="26" cy="81" r="3.5" fill="#34d399"/>
        <circle cx="37" cy="81" r="3.5" fill="#f87171"/>
        <circle cx="48" cy="81" r="3.5" fill="#34d399" opacity="0.4"/>
        {/* Disk slots bottom */}
        <rect x="60" y="76" width="44" height="6" rx="2.5" fill="#c7d2fe"/>
        <rect x="60" y="84" width="32" height="3" rx="1.5" fill="#c7d2fe" opacity="0.5"/>
        {/* Server rack — middle */}
        <rect x="12" y="45" width="100" height="22" rx="5" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
        {/* LED row middle */}
        <circle cx="26" cy="56" r="3.5" fill="#34d399" opacity="0.5"/>
        <circle cx="37" cy="56" r="3.5" fill="#f87171" opacity="0.5"/>
        <circle cx="48" cy="56" r="3.5" fill="#34d399" opacity="0.2"/>
        {/* Disk slots middle */}
        <rect x="60" y="50" width="44" height="6" rx="2.5" fill="#ede9fe"/>
        {/* Sleepy eyes (closed arcs) */}
        <path d="M75 55 Q79 50 83 55" stroke="#7c3aed" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M89 55 Q93 50 97 55" stroke="#7c3aed" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        {/* Server rack — top */}
        <rect x="12" y="20" width="100" height="22" rx="5" fill="#ede9fe" stroke="#a78bfa" strokeWidth="2"/>
        {/* LED row top */}
        <circle cx="26" cy="31" r="3.5" fill="#34d399" opacity="0.3"/>
        <circle cx="37" cy="31" r="3.5" fill="#f87171" opacity="0.3"/>
        {/* Disk slots top */}
        <rect x="60" y="25" width="44" height="6" rx="2.5" fill="#f5f3ff"/>
        {/* Z Z Z floating amber */}
        <text x="120" y="48" fontSize="14" fontWeight="700" fill="#f59e0b" opacity="0.95">z</text>
        <text x="130" y="36" fontSize="18" fontWeight="700" fill="#f59e0b" opacity="0.75">z</text>
        <text x="142" y="22" fontSize="22" fontWeight="700" fill="#f59e0b" opacity="0.5">z</text>
        {/* Little stars/sparkles */}
        <circle cx="8" cy="42" r="2" fill="#a78bfa" opacity="0.4"/>
        <circle cx="5" cy="60" r="1.5" fill="#818cf8" opacity="0.3"/>
        <circle cx="10" cy="72" r="1" fill="#c4b5fd" opacity="0.4"/>
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try refreshing the page</p>
      </div>
    </div>
  );
}
