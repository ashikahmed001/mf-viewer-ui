import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { getSubscriptionStatus } from '../api/client.js';

const ADMIN_EMAIL = 'ashikahmed001@gmail.com';

const SubscriptionContext = createContext({ plan: 'free', loading: true, refresh: () => {} });

export function SubscriptionProvider({ children }) {
  const { isSignedIn }  = useAuth();
  const { user }        = useUser();
  const [plan, setPlan]       = useState('free');
  const [status, setStatus]   = useState('none');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const refresh = useCallback(async () => {
    if (!isSignedIn) { setPlan('free'); setLoading(false); return; }
    // Admin always gets Pro — no API call needed
    if (isAdmin) { setPlan('pro'); setStatus('admin'); setLoading(false); return; }
    try {
      const data = await getSubscriptionStatus();
      setPlan(data.plan ?? 'free');
      setStatus(data.status ?? 'none');
    } catch {
      setPlan('free');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const isPro = plan === 'pro' || isAdmin;

  return (
    <SubscriptionContext.Provider value={{ plan, status, loading, isPro, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
