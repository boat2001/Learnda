import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import UpgradeBillingModal from '../components/subscription/UpgradeBillingModal';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useAnalytics } from '../hooks/useAnalytics';
import authService from '../services/authService';
import api from '../services/api';
import { ONBOARDING_STEPS } from '../utils/onboarding';
import { getAvailableUpgradePlans, resolveRequestedPlan } from '../utils/upgradePlans';

export default function Upgrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, checkAuth } = useAuth();
  const { currentPlan, plans, subscriptionDetails, invoices = [], refresh } = useSubscription();
  const { trackEvent } = useAnalytics();
  const [durationMonths, setDurationMonths] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const availablePlans = useMemo(() => getAvailableUpgradePlans(plans), [plans]);
  const currentPlanName = currentPlan?.name || user?.current_plan || user?.subscription?.plan?.name || 'Basic Student';
  const currentPlanPrice = currentPlan?.price ?? availablePlans.find((plan) => plan.name === currentPlanName)?.price ?? 0;

  const targetPlan = useMemo(() => {
    const queryPlan = searchParams.get('plan');
    const stateDetail = location.state?.detail || null;
    return resolveRequestedPlan({
      detail: queryPlan ? { plan: queryPlan } : stateDetail,
      plans: availablePlans,
      currentPlanName,
    });
  }, [availablePlans, currentPlanName, location.state, searchParams]);

  const goBack = () => {
    if (processing) return;
    const fallbackPath = location.state?.from || '/';
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackPath, { replace: true });
  };

  const startUpgrade = async () => {
    if (!targetPlan || processing) return;

    setProcessing(true);
    setError('');

    try {
      const selection = await authService.selectPlan(targetPlan.id);
      if (!selection?.success) {
        throw new Error(selection?.error || 'Unable to start upgrade');
      }

      if (Number(targetPlan.price || 0) <= 0 && selection?.next_step === ONBOARDING_STEPS.DONE) {
        await checkAuth(true);
        await refresh();
        navigate(location.state?.from || '/', { replace: true });
        return;
      }

      const returnPath = location.state?.from || '/';
      const checkout = await api.billing.checkout(targetPlan.id, durationMonths, {
        return_path: returnPath,
      });
      if (!checkout?.authorization_url) {
        throw new Error(checkout?.error || 'Unable to initialize checkout');
      }

      trackEvent('upgrade_checkout_started', {
        current_plan: currentPlanName,
        target_plan: targetPlan.name,
        duration_months: durationMonths,
        source: searchParams.get('source') || location.state?.detail?.source || 'upgrade_page',
      });
      window.location.assign(checkout.authorization_url);
    } catch (upgradeError) {
      setError(upgradeError.message || 'Unable to start upgrade right now.');
      trackEvent('upgrade_checkout_failed', {
        current_plan: currentPlanName,
        target_plan: targetPlan?.name || 'unknown',
        error: upgradeError.message || 'upgrade_failed',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!targetPlan) {
    return (
      <main className="upgrade-billing-page">
        <section className="upgrade-billing-modal upgrade-billing-modal-page-panel">
          <div className="upgrade-billing-modal-hero">
            <button
              type="button"
              className="upgrade-billing-modal-close"
              onClick={goBack}
              aria-label="Go back"
            >
              &larr;
            </button>
            <div className="upgrade-billing-modal-hero-copy">
              <span className="upgrade-billing-modal-kicker">Plan upgrade</span>
              <h3>No upgrade available</h3>
              <p>Your account is already on the highest available plan.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <UpgradeBillingModal
      variant="page"
      isOpen
      currentPlanName={currentPlanName}
      currentPlanPrice={currentPlanPrice}
      targetPlan={targetPlan}
      durationMonths={durationMonths}
      onDurationChange={setDurationMonths}
      subscriptionDetails={subscriptionDetails || user?.subscription || currentPlan}
      invoices={invoices}
      onClose={goBack}
      onConfirm={startUpgrade}
      isProcessing={processing}
      error={error}
    />
  );
}
