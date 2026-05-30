import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const FeatureFlagsContext = createContext({ flags: {}, paymentsEnabled: false, loading: true });

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags]                   = useState({});
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    api.get('/features')
      .then(r => {
        // Support both old format (array) and new format ({ flags, paymentsEnabled })
        const raw = Array.isArray(r.data) ? r.data : (r.data.flags ?? []);
        const map = {};
        for (const f of raw) map[f.key] = f.required_plan;
        setFlags(map);
        setPaymentsEnabled(Array.isArray(r.data) ? false : (r.data.paymentsEnabled ?? false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, paymentsEnabled, setPaymentsEnabled, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Returns true if the current user can access a feature.
 * isPro comes from SubscriptionContext; flags come from FeatureFlagsContext.
 *
 * Usage:
 *   const canAccess = useFeature('nav_history', isPro);
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/** Convenience: true if feature is accessible given the user's plan */
export function canUseFeature(flags, isPro, key) {
  const required = flags[key] ?? 'free';
  if (required === 'free') return true;
  return isPro;
}
