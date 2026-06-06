// CapBadge — shows SEBI market-cap category next to a stock name
// Colors: large=blue, mid=violet, small=emerald, micro=slate
const CAP_STYLES = {
  large: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  mid:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  small: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  micro: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const CAP_LABELS = {
  large: 'Large',
  mid:   'Mid',
  small: 'Small',
  micro: 'Micro',
};

export default function CapBadge({ cap, className = '' }) {
  if (!cap) return null;
  const style = CAP_STYLES[cap] ?? CAP_STYLES.micro;
  const label = CAP_LABELS[cap] ?? cap;
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${style} ${className}`}>
      {label}
    </span>
  );
}
