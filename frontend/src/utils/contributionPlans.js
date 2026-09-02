// Central mapping layer for the contribution model rebrand.
// Backend DB stores "Basic Student" / "Serious Student" / "Master Student" — never change those.
// All display changes go through this file only.

export const BACKEND_TO_DISPLAY = {
  'Basic Student':   'Free Learner',
  'Serious Student': 'Helper',
  'Master Student':  'Hero',
};

export const toDisplayName = (backendName) =>
  BACKEND_TO_DISPLAY[String(backendName || '').trim()] || String(backendName || '');

export const PLAN_COPY = {
  'Basic Student': {
    displayName: 'Free Learner',
    tagline:     'Use free, support later',
    description: 'Start learning with no payment required. Support Sharether when you can.',
    ctaLabel:    'Start as a Free Learner',
    color:       '#2a6f97',
  },
  'Serious Student': {
    displayName: 'Helper',
    tagline:     "Low on cash? We've got your back",
    description: 'Contribute GHS 5 and unlock more courses and more file downloads.',
    ctaLabel:    'Contribute GHS 5',
    color:       '#159ba4',
  },
  'Master Student': {
    displayName: 'Hero',
    tagline:     'Full support, full access',
    description: 'Contribute GHS 10 and unlock everything Sharether has to offer.',
    ctaLabel:    'Contribute GHS 10',
    color:       '#f4a261',
  },
};

export const getPlanCopy = (backendName) =>
  PLAN_COPY[String(backendName || '').trim()] || PLAN_COPY['Basic Student'];

