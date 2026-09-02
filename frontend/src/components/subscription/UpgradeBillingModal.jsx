import { useEffect } from 'react';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import {
  BILLING_DURATION_OPTIONS,
  formatGhsAmount,
  getUpgradeBillingPreview,
} from '../../utils/billingUpgrade';
import { toDisplayName } from '../../utils/contributionPlans';
import './UpgradeBillingModal.css';

export default function UpgradeBillingModal({
  isOpen,
  currentPlanName,
  currentPlanPrice,
  targetPlan,
  durationMonths,
  onDurationChange,
  subscriptionDetails,
  invoices,
  onClose,
  onConfirm,
  isProcessing = false,
  error = '',
  variant = 'modal',
}) {
  const isPage = variant === 'page';

  useEffect(() => {
    if (!isOpen) return undefined;
    const releaseBodyScroll = isPage ? () => {} : lockBodyScroll();
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isProcessing) onClose?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      releaseBodyScroll();
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isPage, isProcessing, onClose]);

  if (!isOpen || !targetPlan) return null;

  const activeMonths = durationMonths ?? 1;
  const preview = getUpgradeBillingPreview({
    currentPlanName,
    currentPlanPrice,
    targetPlanName: targetPlan.name,
    targetPlanPrice: targetPlan.price,
    durationMonths: activeMonths,
    subscriptionDetails,
    invoices,
  });

  const durationLabel = `${preview.months} ${preview.months === 1 ? 'month' : 'months'}`;
  const hasPartialCredit = preview.isProratedUpgrade && preview.creditedAmount > 0;

  const modalContent = (
    <div
      className={`upgrade-billing-modal ${isPage ? 'upgrade-billing-modal-page-panel' : ''}`.trim()}
      role="dialog"
      aria-modal={isPage ? undefined : 'true'}
      aria-label={`Become a ${toDisplayName(targetPlan.name)}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="upgrade-billing-modal-hero">
        <button
          type="button"
          className="upgrade-billing-modal-close"
          onClick={onClose}
          disabled={isProcessing}
          aria-label={isPage ? 'Go back' : 'Close'}
        >
          {isPage ? <FiArrowLeft /> : <FiX />}
        </button>

        <div className="upgrade-billing-modal-hero-copy">
          <span className="upgrade-billing-modal-kicker">
            <FiZap aria-hidden />
            Contribution plan
          </span>
          <h3>Become a {toDisplayName(targetPlan.name)}</h3>
        </div>

        <div className="upgrade-billing-modal-price-card" aria-label="Amount due now">
          <span>Amount due now</span>
          <strong>{formatGhsAmount(preview.amountDue)}</strong>
          <small>
            {preview.isProratedUpgrade
              ? `Prorated through ${preview.periodEndLabel || 'the current term'}`
              : `Your benefits will be active for ${durationLabel} from today`}
          </small>
        </div>
      </div>

      {preview.isProratedUpgrade ? (
        <div className="upgrade-billing-modal-card upgrade-billing-modal-duration-card">
          <div className="upgrade-billing-modal-card-heading">
            <span className="upgrade-billing-modal-card-label">Current billing term</span>
            <strong>Unused paid time is credited automatically</strong>
          </div>
          <p>
            This charge changes your plan for the time already left in the current term.
            Renewals continue from {preview.periodEndLabel || 'your current renewal date'}.
          </p>
          {preview.providerFeeMessage ? (
            <p className="upgrade-billing-modal-fee-note">{preview.providerFeeMessage}</p>
          ) : null}
        </div>
      ) : (
        <div className="upgrade-billing-modal-card upgrade-billing-modal-duration-card">
          <div className="upgrade-billing-modal-card-heading">
            <span className="upgrade-billing-modal-card-label">Billing duration</span>
            <strong>Choose your contribution duration</strong>
          </div>
          <div
            className="upgrade-billing-modal-duration-options"
            role="radiogroup"
            aria-label="Billing duration"
          >
            {BILLING_DURATION_OPTIONS.map((months) => (
              <button
                key={months}
                type="button"
                className={`upgrade-billing-modal-duration-option ${activeMonths === months ? 'is-selected' : ''}`.trim()}
                role="radio"
                aria-checked={activeMonths === months}
                onClick={() => onDurationChange?.(months)}
                disabled={isProcessing}
              >
                <strong>{months}</strong>
                <span>{months === 1 ? 'month' : 'months'}</span>
              </button>
            ))}
          </div>
          {preview.providerFeeMessage ? (
            <p className="upgrade-billing-modal-fee-note">{preview.providerFeeMessage}</p>
          ) : null}
        </div>
      )}

      <div className="upgrade-billing-modal-card upgrade-billing-modal-payment-note">
        <p>{preview.primaryExplanation}</p>
        {hasPartialCredit ? (
          <div className="upgrade-billing-modal-credit">
            <FiCheckCircle aria-hidden />
            <span>Proration applied: unused current-plan time is credited.</span>
          </div>
        ) : null}
        {preview.periodEndLabel && preview.isProratedUpgrade ? (
          <div className="upgrade-billing-modal-window">
            <FiClock aria-hidden />
            <span>Current term renews {preview.periodEndLabel}.</span>
          </div>
        ) : null}
      </div>

      {error ? <p className="upgrade-billing-modal-error">{error}</p> : null}

      <div className="upgrade-billing-modal-actions">
        {!isPage ? (
          <button
            type="button"
            className="upgrade-billing-modal-btn upgrade-billing-modal-btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="upgrade-billing-modal-btn upgrade-billing-modal-btn-primary"
          onClick={onConfirm}
          disabled={isProcessing}
        >
          {isProcessing
            ? 'Starting checkout...'
            : `Pay ${formatGhsAmount(preview.amountDue)} and continue`}
        </button>
      </div>
    </div>
  );

  if (isPage) {
    return <main className="upgrade-billing-page">{modalContent}</main>;
  }

  return (
    <div
      className="upgrade-billing-modal-overlay"
      onClick={() => {
        if (!isProcessing) onClose?.();
      }}
    >
      {modalContent}
    </div>
  );
}
