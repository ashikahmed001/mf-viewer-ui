/**
 * Wraps a page or section behind a feature flag check.
 * Shows <UpgradePrompt> if the feature requires Pro and user is on Free.
 *
 * Usage:
 *   <GatedPage featureKey="cross_fund" featureLabel="Cross-Fund Analysis">
 *     <ActualPageContent />
 *   </GatedPage>
 */
import { useFeatureFlags, canUseFeature } from '../context/FeatureFlagsContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import UpgradePrompt from './UpgradePrompt.jsx';

export default function GatedPage({ featureKey, featureLabel, children }) {
  const { flags, overrides, loading } = useFeatureFlags();
  const { isPro }                     = useSubscription();

  // While flags are loading, render children (avoids flash of upgrade prompt)
  if (loading) return children;

  if (!canUseFeature(flags, overrides, isPro, featureKey)) {
    return <UpgradePrompt feature={featureLabel} />;
  }

  return children;
}
