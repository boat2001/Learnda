import PlanCard from './PlanCard';
import { PLANS } from '../../data/subscriptionPlans';
import './SmartGate.css';

// Shown inline when a user hits their daily download limit.
// Props:
//   onClose      — "Download again tomorrow" — dismisses without upgrading
//   onContribute — called when user clicks a plan CTA
//   downloadCount — how many downloads they've used today (optional, for personalised message)

export default function SmartGate({ onClose, onContribute, downloadCount }) {
  const paidPlans = [...PLANS]
    .filter((p) => Number(p.price || 0) > 0)
    .sort((a, b) => Number(b.price) - Number(a.price)); // Hero first

  const countMsg = downloadCount != null ? `${downloadCount} downloads today` : 'your downloads today';

  return (
    <div className="smart-gate" role="region" aria-label="Download limit reached">
      <div className="smart-gate__icon" aria-hidden="true">📥</div>
      <h3 className="smart-gate__title">That&apos;s your downloads for today</h3>
      <p className="smart-gate__body">
        You&apos;ve used {countMsg} — clearly Learnda is doing its job. Chip in to raise your
        daily limit, or come back tomorrow and pick up where you left off.
      </p>

      <div className="smart-gate__plans">
        {paidPlans.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan.name}
            price={plan.price}
            features={plan.features}
            highlight={plan.name === 'Master Student'}
            onUpgrade={() => {
              if (onContribute) onContribute(plan);
              window.dispatchEvent(
                new CustomEvent('openUpgradeModal', { detail: { ...plan, source: 'smart_gate' } })
              );
            }}
          />
        ))}
      </div>

      <button type="button" className="smart-gate__tomorrow" onClick={onClose}>
        I&apos;ll come back tomorrow
      </button>
    </div>
  );
}
