import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import { toDisplayName } from '../../utils/contributionPlans';
import PlanCard from './PlanCard';
import ContributionAppeal from './ContributionAppeal';
import './Subscription.css';

export default function UpgradePrompt({
  trigger = 'feature',
  feature = null,
  plan = null,
  title = 'Open up more of Sharether',
  message = 'Chip in what fits and unlock this — plus everything that comes with it',
  showClose = true,
  onClose,
  onUpgrade,
}) {
  const { isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();
  
  const [showPlans, setShowPlans] = useState(false);

  const getUpgradeMessage = () => {
    if (plan) {
      return `This one is included from ${toDisplayName(plan)} upwards.`;
    }
    
    if (feature) {
      const featureMessages = {
        'personalization': 'Personalized learning recommendations',
        'commenting': 'Join discussions and ask questions',
        'contributions': 'Contribute content and earn XP',
        'unlimited_pls': 'Unlimited Personal Learning Space',
        'premium_content': 'Access to premium content',
        'advanced_analytics': 'Advanced learning analytics',
        'study_groups': 'Join study groups',
      };
      
      return `Chip in to unlock ${(featureMessages[feature] || feature).toLowerCase()}`;
    }
    
    return message;
  };

  const getRequiredPlan = () => {
    if (plan) return plan;
    
    // Map features to required plans
    const featureToPlan = {
      'personalization': 'Serious Student',
      'commenting': 'Serious Student',
      'contributions': 'Serious Student',
      'unlimited_pls': 'Serious Student',
      'premium_content': 'Serious Student',
      'advanced_analytics': 'Master Student',
      'study_groups': 'Master Student',
    };
    
    return featureToPlan[feature] || 'Serious Student';
  };

  const getFeatureIcon = () => {
    const icons = {
      'personalization': '🎯',
      'commenting': '💬',
      'contributions': '⭐',
      'unlimited_pls': '📚',
      'premium_content': '🔓',
      'advanced_analytics': '📊',
      'study_groups': '👥',
    };
    return icons[feature] || '🚀';
  };

  const handleUpgradeClick = () => {
    if (!isAuthenticated) {
      trackEvent('upgrade_auth_required', { trigger, feature, required_plan: getRequiredPlan() });
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
      onClose?.();
      return;
    }

    setShowPlans(true);
    trackEvent('upgrade_prompt_clicked', { trigger, feature, required_plan: getRequiredPlan() });
  };

  const handlePlanSelect = (planName) => {
    trackEvent('upgrade_plan_selected', { 
      current_plan: currentPlan?.name,
      new_plan: planName,
      trigger,
      feature,
    });
    
    if (onUpgrade) {
      onUpgrade(planName);
    } else {
      window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: planName.toLowerCase().replace(' ', '_') }));
    }
    
    setShowPlans(false);
    onClose?.();
  };

  const renderPlanComparison = () => {
    const requiredPlan = getRequiredPlan();
    
    const plans = [
      {
        name: currentPlan?.name || 'Basic Student',
        type: 'current',
        description: 'What you have now',
      },
      {
        name: requiredPlan,
        type: 'required',
        description: 'What you unlock',
      },
    ];

    const featureComparison = {
      'Serious Student': [
        'Limited PLS (20 items)',
        'Lessons for core courses',
        'Download files (5/day)',
        'View more files on-site (10/day)',
        'Practice past questions (10/day)',
        'Join study groups for core courses',
        'Contribute files and edutainment',
        // 'Earn cash rewards (1/day)',
        // '50% contribution revenue share',
      ],
      'Master Student': [
        'Unlimited PLS',
        'Lessons for all courses',
        'Download files (10/day)',
        'View files on-site (15/day)',
        'Practice past questions (20/day)',
        'Create and join study groups',
        'Contribute all content',
        'Access to new features first',
        // 'Earn more cash rewards (2/day)',
        'Bonus XP for content you create',
      ],
    };

    return (
      <div className="plan-comparison">
        <div className="comparison-header">
          <h4>What opens up</h4>
          <p>Here&apos;s what you have now, and what chipping in adds</p>
        </div>
        
        <div className="comparison-grid">
          {plans.map(plan => (
            <div key={plan.name} className={`comparison-plan ${plan.type}`}>
              <div className="plan-header">
                <h5>{plan.type === 'current' ? 'Your current plan' : toDisplayName(plan.name)}</h5>
                <span className="plan-type">{plan.description}</span>
              </div>
              
              <div className="plan-features">
                <ul>
                  {(featureComparison[plan.name] || []).map((feature, index) => (
                    <li key={index}>
                      <span className="feature-icon">
                        {plan.type === 'required' ? '✓' : plan.type === 'current' ? '✓' : '○'}
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUpgradePlans = () => {
    const requiredPlan = getRequiredPlan();
    
    const plans = [
      {
        name: 'Serious Student',
        price: 0.5,
        features: [
          'Animated illustrations',
          'Interactive past questions',
          'Unlimited PLS',
          'Comment & contribute',
          'XP rewards for your content',
        ],
        recommended: requiredPlan === 'Serious Student',
      },
      {
        name: 'Master Student',
        price: 1,
        features: [
          'Advanced visuals',
          'Mock exams',
          'Study groups',
          'Contribute lessons/videos',
          'Bonus XP for your content',
          'Ask questions to lecturers',
        ],
        recommended: requiredPlan === 'Master Student',
      },
    ];

    return (
      <div className="upgrade-plans-modal">
        <ContributionAppeal />
        <div className="plans-header">
          <h3>Pick what fits your budget</h3>
          <p>Any amount keeps Sharether running — and opens up more for you</p>
          {showClose && (
            <button 
              className="close-plans"
              onClick={() => setShowPlans(false)}
            >
              ×
            </button>
          )}
        </div>
        
        <div className="plans-grid">
          {plans.map(plan => (
            <div key={plan.name} className="plan-card-wrapper">
              <PlanCard
                plan={plan.name}
                price={plan.price}
                features={plan.features}
                highlight={plan.recommended}
                current={currentPlan?.name === plan.name}
                onUpgrade={() => handlePlanSelect(plan.name)}
              />
            </div>
          ))}
        </div>
        
        <div className="plans-footer">
          <button 
            className="back-btn"
            onClick={() => setShowPlans(false)}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  };

  if (showPlans) {
    return renderUpgradePlans();
  }

  return (
    <div className="upgrade-prompt">
      <div className="prompt-content">
        <div className="prompt-icon">
          {getFeatureIcon()}
        </div>
        
        <div className="prompt-text">
          <h3>{title}</h3>
          <p>{getUpgradeMessage()}</p>
        </div>
        
        <div className="prompt-actions">
          <button 
            className="upgrade-btn primary"
            onClick={handleUpgradeClick}
          >
            {isAuthenticated ? 'See the plans' : 'Sign up free'}
          </button>

          {showClose && onClose && (
            <button
              className="upgrade-btn secondary"
              onClick={onClose}
            >
              Not right now
            </button>
          )}
        </div>
        
        {showClose && onClose && (
          <button 
            className="prompt-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
      
      {renderPlanComparison()}
    </div>
  );
}