const SUBSCRIPTION_PLANS = {
  BASIC_STUDENT: {
    features: [
      { key: 'text_lessons', enabled: true, config: { depth: 'basic', visual: 'static' } },
      { key: 'premium_content', enabled: false, config: {} },
      { key: 'commenting', enabled: false, config: {} },
      { key: 'contributions', enabled: false, config: {} },
      { key: 'personalization', enabled: false, config: {} },
      { key: 'save_to_pls', enabled: true, config: {} },
      { key: 'unlimited_pls', enabled: false, config: {} }
    ]
  },
  SERIOUS_STUDENT: {
    features: [
      { key: 'text_lessons', enabled: true, config: { depth: 'enhanced', visual: 'animated' } },
      { key: 'premium_content', enabled: true, config: {} },
      { key: 'commenting', enabled: true, config: {} },
      { key: 'contributions', enabled: true, config: {} },
      { key: 'personalization', enabled: true, config: {} },
      { key: 'save_to_pls', enabled: true, config: {} },
      { key: 'unlimited_pls', enabled: true, config: {} }
    ]
  },
  MASTER_STUDENT: {
    features: [
      { key: 'text_lessons', enabled: true, config: { depth: 'advanced', visual: 'interactive' } },
      { key: 'premium_content', enabled: true, config: {} },
      { key: 'commenting', enabled: true, config: {} },
      { key: 'contributions', enabled: true, config: {} },
      { key: 'personalization', enabled: true, config: {} },
      { key: 'save_to_pls', enabled: true, config: {} },
      { key: 'unlimited_pls', enabled: true, config: {} }
    ]
  }
};

module.exports = {
  SUBSCRIPTION_PLANS
};
