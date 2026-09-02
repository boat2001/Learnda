import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PlanCard from '../components/subscription/PlanCard';
import ContributionAppeal from '../components/subscription/ContributionAppeal';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { PLANS } from '../data/subscriptionPlans';
import { toDisplayName } from '../utils/contributionPlans';
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
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-product">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Contribution Plans</span>
            <h1 className="hero-title">Support Learnda. Unlock more.</h1>
            <p className="hero-subtitle">
              Learnda is funded by students, for students. Contribute to keep it running — and get more tools as our thank you.
            </p>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Free Learner</span>
                <span className="stat-label">Free, always. Start studying today and chip in whenever it suits you.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Helper</span>
                <span className="stat-label">GHS 5 a month opens up more courses, downloads and practice.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Hero</span>
                <span className="stat-label">GHS 10 a month unlocks everything, plus new features first.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">Why chip in</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Nobody gets locked out</strong>
                  <p>Your contribution keeps the core tools free for students who can&apos;t pay.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>You get more back</strong>
                  <p>Helper and Hero open up more courses, downloads and practice.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Pay what fits</strong>
                  <p>GHS 5 or GHS 10 a month, and you can stop or switch any time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="page-section" id="pricing-plans">
        <div className="section-heading">
          <h2>Contribution plans</h2>
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
