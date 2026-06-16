import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/client.js';

const FeatureFlagsContext = createContext({
  flags: {},
  overrides: {},
  paymentsEnabled: false,
  loading: true,
});

export function FeatureFlagsProvider({ children }) {
  const { isSignedIn } = useAuth();
  const [flags, setFlags]                     = useState({});
  const [overrides, setOverrides]             = useState({});
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    api.get('/features')
      .then(r => {
        const raw = Array.isArray(r.data) ? r.data : (r.data.flags ?? []);
        const map = {};
        for (const f of raw) map[f.key] = { required_plan: f.required_plan, enabled: f.enabled !== 0 };
        setFlags(map);
        setPaymentsEnabled(Array.isArray(r.data) ? false : (r.data.paymentsEnabled ?? false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setOverrides({}); return; }
    api.get('/features/my-overrides')
      .then(r => {
        const map = {};
        for (const o of (r.data.overrides ?? [])) {
          map[o.feature_key] = {
            enabled:       o.enabled === null ? null : o.enabled !== 0,
            required_plan: o.required_plan ?? null,
          };
        }
        setOverrides(map);
      })
      .catch(() => {});
  }, [isSignedIn]);

  return (
    <FeatureFlagsContext.Provider value={{ flags, overrides, paymentsEnabled, setPaymentsEnabled, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/** Returns true if the feature is turned on at all (ignores plan). */
export function isFeatureEnabled(flags, overrides, key) {
  const override = overrides?.[key];
  if (override?.enabled === false) return false;
  if (override?.enabled === true)  return true;
  const flag = flags[key];
  if (!flag) return true;
  return flag.enabled !== false;
}

/**
 * Returns true if the current user can access a feature.
 *
 * Resolution order:
 *   1. User override enabled=false  → always blocked
 *   2. User override enabled=true   → use override's required_plan (falls back to global)
 *   3. Global flag disabled         → blocked for everyone
 *   4. Global required_plan + isPro → standard plan gate
 */
export function canUseFeature(flags, overrides, isPro, key) {
  const override = overrides?.[key];

  if (override) {
    if (override.enabled === false) return false;
    if (override.enabled === true) {
      const plan = override.required_plan ?? flags[key]?.required_plan ?? 'free';
      return plan === 'free' || isPro;
    }
    // override.enabled === null → inherit global
  }

  const flag = flags[key];
  if (!flag) return true;
  if (!flag.enabled) return false;
  return flag.required_plan === 'free' || isPro;
}
