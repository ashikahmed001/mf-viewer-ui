/**
 * Wraps a page or section behind a feature flag check.
 *
 * Resolution:
 *   1. Feature disabled (globally or via override) → render null (nothing)
 *   2. Feature enabled but requires Pro, user is Free → show UpgradePrompt
 *   3. Feature enabled + user has access → render children
 *
 * Usage:
 *   <GatedPage featureKey="cross_fund" featureLabel="Cross-Fund Analysis">
 *     <ActualPageContent />
 *   </GatedPage>
 */
import { useFeatureFlags, canUseFeature } from '../context/FeatureFlagsContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import UpgradePrompt from './UpgradePrompt.jsx';

/** Returns true only if the feature flag is turned on (ignores plan check). */
function isFeatureEnabled(flags, overrides, key) {
  const override = overrides?.[key];
  if (override?.enabled === false) return false;
  if (override?.enabled === true)  return true;
  // inherit global
  const flag = flags[key];
  if (!flag) return true;          // unknown flag → allow
  return flag.enabled !== false;
}

export default function GatedPage({ featureKey, featureLabel, children }) {
  const { flags, overrides, loading } = useFeatureFlags();
  const { isPro }                     = useSubscription();

  // While flags are loading, render children (avoids flash)
  if (loading) return children;

  // Feature is turned off entirely — render nothing, no upgrade prompt
  if (!isFeatureEnabled(flags, overrides, featureKey)) return null;

  // Feature is on but user doesn't have the right plan
  if (!canUseFeature(flags, overrides, isPro, featureKey)) {
    return <UpgradePrompt feature={featureLabel} />;
  }

  return children;
}
