import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getAvailableUpgradePlans, getPlanLockState, resolveRequestedPlan } from '../../utils/upgradePlans';

export default function UpgradeModalHost() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { currentPlan, plans, subscriptionDetails } = useSubscription();
  const { trackEvent } = useAnalytics();

  const availablePlans = useMemo(
    () => getAvailableUpgradePlans(plans),
    [plans]
  );

  const currentPlanName = currentPlan?.name || user?.current_plan || user?.subscription?.plan?.name || 'Basic Student';

  useEffect(() => {
    const handleOpenUpgradeModal = (event) => {
      if (!isAuthenticated) {
        window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
        return;
      }

      const nextPlan = resolveRequestedPlan({
        detail: event?.detail || null,
        plans: availablePlans,
        currentPlanName,
      });

      if (!nextPlan) {
        return;
      }

      // Backstop for programmatic dispatches: the CTAs are already disabled, but
      // never route a contributor to checkout for a plan below their active one.
      const lockState = getPlanLockState({
        currentPlanName,
        targetPlanName: nextPlan.name,
        subscriptionDetails,
      });
      if (lockState.locked) {
        trackEvent('upgrade_blocked_downgrade', {
          current_plan: currentPlanName,
          target_plan: nextPlan.name,
          source: event?.detail?.source || 'global',
        });
        return;
      }

      trackEvent('upgrade_modal_opened', {
        current_plan: currentPlanName,
        target_plan: nextPlan.name,
        source: event?.detail?.source || 'global',
      });

      const params = new URLSearchParams();
      params.set('plan', nextPlan.id || nextPlan.name);
      if (event?.detail?.source) {
        params.set('source', event.detail.source);
      }
      navigate(`/upgrade?${params.toString()}`, {
        state: {
          detail: event?.detail || null,
          from: `${window.location.pathname}${window.location.search || ''}`,
        },
      });
    };

    window.addEventListener('openUpgradeModal', handleOpenUpgradeModal);
    return () => window.removeEventListener('openUpgradeModal', handleOpenUpgradeModal);
  }, [availablePlans, currentPlanName, isAuthenticated, navigate, subscriptionDetails, trackEvent]);

  return null;
}
