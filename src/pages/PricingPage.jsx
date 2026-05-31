import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, TrendingUp, BarChart2, GitCompare, Activity, Star } from 'lucide-react';
import { createCheckout, verifyPayment } from '../api/client.js';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { useFeatureFlags } from '../context/FeatureFlagsContext.jsx';

const FREE_FEATURES = [
  'View all your mutual funds',
  'Monthly holdings table',
  'Basic industry breakdown',
];

const PRO_FEATURES = [
  { icon: TrendingUp, text: 'NAV history chart for every fund' },
  { icon: BarChart2,  text: 'Overlap matrix across all funds' },
  { icon: GitCompare, text: 'Month-over-month comparison' },
  { icon: Activity,   text: 'Rising conviction & sector drift' },
  { icon: Star,       text: 'Portfolio feed & hidden gems' },
];

const PRICES = {
  monthly: { amount: 149, label: '₹149 / month', save: null },
  annual:  { amount: 999, label: '₹999 / year',  save: 'Save ₹789 vs monthly' },
};

function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PricingPage() {
  const [cycle, setCycle]     = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const { isPro, plan, refresh } = useSubscription();
  const { paymentsEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay checkout');

      const checkout = await createCheckout(cycle);

      const options = {
        key:             checkout.razorpay_key,
        subscription_id: checkout.subscription_id,
        name:            'FundSight',
        description:     `Pro – ${cycle === 'annual' ? 'Annual' : 'Monthly'} plan`,
        handler: async (response) => {
          try {
            await verifyPayment({ ...response, cycle });
            await refresh();
            navigate('/funds');
          } catch (e) {
            setError('Payment verified but activation failed. Please contact support.');
          }
        },
        prefill: {},
        theme: { color: '#2563eb' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(`Payment failed: ${resp.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Simple, transparent pricing</h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-lg">Unlock the full power of your portfolio analytics</p>
      </div>

      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="flex items-center gap-4">
          <span className={`text-sm font-medium ${cycle === 'monthly' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>Monthly</span>
          {/* Track: 48px wide, 26px tall. Thumb: 20px. Gap: 3px each side. Travel: 48-20-6=22px */}
          <button
            onClick={() => setCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
            style={{ width: 48, height: 26 }}
            className={`relative rounded-full transition-colors flex-shrink-0 ${cycle === 'annual' ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s',
                transform: cycle === 'annual' ? 'translateX(22px)' : 'translateX(0)',
              }}
            />
          </button>
          <span className={`text-sm font-medium ${cycle === 'annual' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>Annual</span>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Save 44% with annual
        </span>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-7 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Free</h2>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">₹0</div>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Forever free</p>
          </div>
          <ul className="space-y-3 mb-8">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
                <Check className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 font-medium py-2 border border-slate-200 dark:border-slate-700 rounded-xl">
            {plan === 'free' ? 'Your current plan' : 'Free tier'}
          </div>
        </div>

        {/* Pro */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-7 shadow-xl text-white relative overflow-hidden">
          {/* Glow */}
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-400 rounded-full opacity-20 blur-2xl" />

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">Pro</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">Most popular</span>
            </div>
            <div className="text-3xl font-bold">{PRICES[cycle].label}</div>
            {PRICES[cycle].save && (
              <p className="text-indigo-200 text-sm mt-1">{PRICES[cycle].save}</p>
            )}
          </div>

          <ul className="space-y-3 mb-8">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-indigo-50">
                <Icon className="w-4 h-4 text-indigo-200 shrink-0" />
                {text}
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="text-center text-sm font-semibold py-3 bg-white/20 rounded-xl">
              ✓ You're on Pro
            </div>
          ) : !paymentsEnabled ? (
            <div className="text-center text-sm font-semibold py-3 bg-white/10 rounded-xl text-indigo-100">
              Coming soon — payments not yet enabled
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 bg-white dark:bg-slate-800 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? 'Opening checkout…' : `Upgrade to Pro – ${PRICES[cycle].label}`}
            </button>
          )}

          {error && (
            <p className="text-red-200 text-xs mt-3 text-center">{error}</p>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-slate-400 dark:text-slate-500 text-xs mt-8">
        Payments are processed securely by Razorpay. Cancel anytime — no questions asked.
      </p>
    </div>
  );
}
