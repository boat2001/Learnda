import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PlanCard from '../components/subscription/PlanCard';
import ContributionAppeal from '../components/subscription/ContributionAppeal';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { PLANS } from '../data/subscriptionPlans';
import { toDisplayName } from '../utils/contributionPlans';
import PageHeader from '../components/common/PageHeader';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
import './SharedPages.css';

const PLAN_KEY_TO_NAME = {
  basic:       'Basic Student',
  serious:     'Serious Student',
  master:      'Master Student',
  friend:      'Basic Student',
  helper:      'Serious Student',
  hero:        'Master Student',
  pass:        'Basic Student',
  credit:      'Serious Student',
  distinction: 'Master Student',
};

export default function Features() {
  const location = useLocation();
  const { currentPlan } = useSubscription();
  const { isAuthenticated } = useAuth();
  const { trackEvent } = useAnalytics();
  const [processingPlan, setProcessingPlan] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedCurrentPlan = String(currentPlan?.name || currentPlan?.plan_name || '').trim().toLowerCase();

  const recommendedPlan = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requestedKey = String(params.get('plan') || '').trim().toLowerCase();
    return PLAN_KEY_TO_NAME[requestedKey] || null;
  }, [location.search]);

  const handlePlanUpgrade = async (plan) => {
    if (!plan || processingPlan) return;
    setProcessingPlan(plan.name);
    setStatusMessage('');
    setErrorMessage('');
    try {
      if (!isAuthenticated) {
        window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
        setStatusMessage('Create an account to continue with this plan.');
        return;
      }
      if (Number(plan.price || 0) <= 0) {
        setStatusMessage(
          normalizedCurrentPlan === 'basic student'
            ? 'You are already on the Free Learner plan.'
            : 'You can switch to the Free Learner plan after your current active period ends.'
        );
        return;
      }
      trackEvent('pricing_upgrade_selected', { plan_name: plan.name });
      window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { ...plan, source: 'features-and-plans' } }));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start checkout.');
    } finally {
      setProcessingPlan('');
    }
  };

  return (
    <div className="page-shell">
      {/* ── Hero ── */}
      <PageHeader icon="plans" title="Contribution plans" description="Support Learnda and unlock more learning tools." />

      {/* ── Plans ── */}
      <section className="page-section" id="pricing-plans">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="support" /><span className="section-heading__title">Contribution plans</span></h2>
          <p>Pick what fits your budget — you can change or stop it any time.</p>
          {recommendedPlan && (
            <p className="status-message">What you need for this: <strong>{toDisplayName(recommendedPlan)}</strong></p>
          )}
          {statusMessage && <p className="pricing-inline-feedback success">{statusMessage}</p>}
          {errorMessage && <p className="pricing-inline-feedback error">{errorMessage}</p>}
        </div>
        <div className="plans-grid">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan.name}
              price={plan.price}
              features={plan.features}
              current={String(plan.name).trim().toLowerCase() === normalizedCurrentPlan}
              variant={plan.highlight ? 'highlight' : 'default'}
              onUpgrade={() => handlePlanUpgrade(plan)}
              upgradeDisabled={Boolean(processingPlan)}
              upgradeLabel={processingPlan === plan.name
                ? Number(plan.price || 0) > 0 ? 'Redirecting to checkout...' : 'Saving plan...'
                : !isAuthenticated && Number(plan.price || 0) > 0 ? 'Contribute' : null}
            />
          ))}
        </div>
        <ContributionAppeal className="page-contribution-appeal" />
      </section>

    </div>
  );
}
