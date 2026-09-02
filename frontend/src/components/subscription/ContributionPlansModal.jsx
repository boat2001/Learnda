import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getAvailableUpgradePlans } from '../../utils/upgradePlans';
import ContributionAppeal from './ContributionAppeal';
import PlanCard from './PlanCard';
import './Subscription.css';
import './ContributionPlansModal.css';

/**
 * Modal that presents the contribution appeal (styled message) alongside the
 * real contribution plans. Selecting a paid plan hands off to the existing
 * upgrade/checkout flow via the `openUpgradeModal` event.
 */
export default function ContributionPlansModal({ isOpen, onClose, source = 'contribution_banner' }) {
  const { user } = useAuth();
  const { currentPlan, plans } = useSubscription();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPlanName = currentPlan?.name || user?.current_plan || user?.subscription?.plan?.name || 'Basic Student';
  const availablePlans = getAvailableUpgradePlans(plans);

  const handleSelect = (plan) => {
    trackEvent('contribution_plan_selected', {
      current_plan: currentPlanName,
      target_plan: plan.name,
      source,
    });
    onClose?.();
    if (Number(plan.price || 0) <= 0) {
      return; // Already on / staying with the free plan — nothing to charge.
    }
    window.dispatchEvent(
      new CustomEvent('openUpgradeModal', {
        detail: { plan: plan.id || plan.name, source },
      })
    );
  };

  const content = (
    <div
      className="contribution-modal-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div className="contribution-plans-modal" role="dialog" aria-modal="true" aria-label="Contribution plans">
        <div className="contribution-plans-modal__header">
          <div>
            <h3>Chip in to Learnda</h3>
            <p>Pick what fits your budget. Every plan opens up more of the platform.</p>
          </div>
          <button
            type="button"
            className="contribution-plans-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <ContributionAppeal />

        <div className="contribution-plans-modal__grid">
          {availablePlans.map((plan) => (
            <PlanCard
              key={plan.id || plan.name}
              plan={plan.name}
              price={plan.price}
              features={plan.features || []}
              highlight={plan.name === 'Serious Student'}
              current={currentPlanName === plan.name}
              onUpgrade={() => handleSelect(plan)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.getElementById('modal-root') || document.body);
}
