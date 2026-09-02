import { useState } from "react";
import { FiBookOpen, FiTrendingUp, FiStar, FiCheckCircle, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useSubscription } from "../../hooks/useSubscription";
import { normalizePlanFeatures } from "../../utils/planFeatures";
import { getPlanCopy } from "../../utils/contributionPlans";
import { getPlanLockState } from "../../utils/upgradePlans";
import "./Subscription.css";

// Always receives the backend plan name (e.g. "Serious Student").
// Display name translation happens inside via getPlanCopy().
export default function PlanCard({
  plan,
  price,
  features = [],
  highlight = false,
  current = false,
  onUpgrade,
  upgradeDisabled = false,
  upgradeLabel = null,
  minFeatureRows = 0,
  variant = "card",
  enforcePlanLock = true,
}) {
  const { trackEvent } = useAnalytics();
  const { currentPlan, subscriptionDetails } = useSubscription();
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  const planCopy = getPlanCopy(plan);

  // A contributor inside a paid period can't drop to a lower plan — lock its CTA
  // here so every surface that renders a PlanCard gets the rule for free.
  const lockState = enforcePlanLock
    ? getPlanLockState({
        currentPlanName: currentPlan?.name,
        targetPlanName: plan,
        subscriptionDetails,
      })
    : { locked: false, reason: '', unlocksAtLabel: '' };
  const isLocked = !current && lockState.locked;

  const PLAN_ICONS = {
    'Basic Student':   <FiBookOpen />,
    'Serious Student': <FiTrendingUp />,
    'Master Student':  <FiStar />,
  };
  const planIcon = PLAN_ICONS[String(plan || '').trim()] || <FiBookOpen />;

  const getBillingLabel = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return '';
    return '/ month';
  };

  const formatAmount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value || '0').replace(/\.00\b/, '');
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toFixed(2).replace(/\.?0+$/, '');
  };

  const handleUpgradeClick = () => {
    if (upgradeDisabled || isLocked) return;
    trackEvent('plan_card_clicked', { plan_name: plan, is_highlighted: highlight, is_current: current });
    if (onUpgrade) onUpgrade();
  };

  const displayFeatures = normalizePlanFeatures(features);
  const placeholderCount = Math.max(0, Number(minFeatureRows || 0) - displayFeatures.length);
  const displayPrice = formatAmount(price);

  // Always show first 2 benefits; rest behind toggle
  const ALWAYS_VISIBLE = 2;
  const alwaysShown = displayFeatures.slice(0, ALWAYS_VISIBLE);
  const collapsible = displayFeatures.slice(ALWAYS_VISIBLE);
  const hasCollapsible = collapsible.length > 0;

  const defaultCta = planCopy.ctaLabel;

  return (
    <div
      className={`plan-card ${variant === 'banner' ? 'banner' : ''} ${highlight ? 'highlighted' : ''} ${current ? 'current-plan' : ''}`}
      style={{ '--plan-color': planCopy.color }}
    >
      <div className="plan-header">
        <div className="plan-icon">
          {planIcon}
        </div>
        <div className="plan-title">
          <h3>{planCopy.displayName}</h3>
          <p className="plan-tagline">{planCopy.tagline}</p>
        </div>
      </div>

      <div className="plan-price">
        <div className="price-monthly">
          {Number(price) > 0 ? (
            <>
              <span className="price-currency">GHS</span>
              <span className="price-amount">{displayPrice}</span>
              <span className="price-period">{getBillingLabel()}</span>
            </>
          ) : (
            <>
              <span className="price-amount">Free</span>
              <span className="price-period">with limits</span>
            </>
          )}
        </div>
      </div>

      <div className="plan-description">
        <p>{planCopy.description}</p>
      </div>

      {/* Benefits — collapsible after first 2 */}
      <div className="plan-features">
        <p className="plan-features__label">What you unlock</p>
        <ul>
          {alwaysShown.map((feature, i) => (
            <li key={i} className="feature-item">
              <span className="feature-icon"><FiCheckCircle /></span>
              <span className="feature-text">{feature}</span>
            </li>
          ))}

          {benefitsOpen && collapsible.map((feature, i) => (
            <li key={`c-${i}`} className="feature-item">
              <span className="feature-icon"><FiCheckCircle /></span>
              <span className="feature-text">{feature}</span>
            </li>
          ))}

        </ul>

        {hasCollapsible && (
          <button
            type="button"
            className="plan-features__toggle"
            onClick={() => setBenefitsOpen((o) => !o)}
          >
            {benefitsOpen ? <><FiChevronUp /> Show less</> : <><FiChevronDown /> See everything included</>}
          </button>
        )}
      </div>

      <div className="plan-actions">
        {current ? (
          <button className="plan-btn current" disabled type="button">
            Current plan
          </button>
        ) : (
          <>
            <button
              className={`plan-btn primary${isLocked ? ' locked' : ''}`}
              onClick={handleUpgradeClick}
              type="button"
              disabled={upgradeDisabled || isLocked}
              title={isLocked ? lockState.reason : undefined}
            >
              {isLocked
                ? (lockState.unlocksAtLabel ? `Available ${lockState.unlocksAtLabel}` : 'Available when your plan ends')
                : (upgradeLabel || defaultCta)}
            </button>
            {isLocked && <p className="plan-lock-note">{lockState.reason}</p>}
          </>
        )}
      </div>
    </div>
  );
}
