import api from './api';
import authService from './authService';

export const subscriptionService = {
  // Get all available plans
  getPlans: async (options = {}) => {
    try {
      const response = await api.subscription.getPlans(options);
      if (!response) {
        return { success: false, plans: [] };
      }
      
      if (response.success) {
        await api.analytics.trackEvent('plans_fetched', {
          plan_count: response.plans.length,
        });
      }
      
      return response;
    } catch (error) {
      if (!options?.silent) {
        console.error('Get plans error:', error);
      }
      if (options?.allowFailure) {
        return { success: false, plans: [] };
      }
      throw error;
    }
  },

  // Get current subscription plan
  getCurrentPlan: async () => {
    try {
      const response = await api.subscription.getCurrentPlan();
      
      if (response.success) {
        // Update local user data with plan info
        const user = authService.getCurrentUser();
        if (user && response.plan) {
          user.subscription_plan = response.plan.name;
          user.plan_features = response.plan.features;
          authService.updateLocalUser(user);
        }
        
        await api.analytics.trackEvent('current_plan_fetched', {
          plan_name: response.plan?.name || 'none',
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get current plan error:', error);
      throw error;
    }
  },

  // Get current subscription (returns subscription object with plan_id, status, etc.)
  getCurrentSubscription: async () => {
    try {
      const response = await api.subscription.getCurrentPlan();
      
      if (response.success && response.subscription) {
        return response.subscription;
      }
      
      return null;
    } catch (error) {
      console.error('Get current subscription error:', error);
      throw error;
    }
  },

  // Subscribe to a plan
  subscribe: async (planData) => {
    try {
      const response = await api.subscription.subscribe(
        planData.planId,
        planData.billingCycle,
        planData.paymentMethod
      );
      
      if (response.success) {
        // Update local user data
        const user = authService.getCurrentUser();
        if (user) {
          user.subscription_plan = response.plan.name;
          user.plan_features = response.plan.features;
          user.subscription_status = 'active';
          authService.updateLocalUser(user);
        }
        
        await api.analytics.trackEvent('subscription_created', {
          plan_name: response.plan.name,
          billing_cycle: planData.billingCycle,
          amount: response.amount,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Subscribe error:', error);
      throw error;
    }
  },

  // Cancel subscription
  cancelSubscription: async () => {
    try {
      const response = await api.subscription.cancel();
      
      if (response.success) {
        // Update local user data
        const user = authService.getCurrentUser();
        if (user) {
          user.subscription_status = 'cancelled';
          authService.updateLocalUser(user);
        }
        
        await api.analytics.trackEvent('subscription_cancelled');
      }
      
      return response;
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  },

  // Upgrade subscription
  upgradeSubscription: async (newPlanId) => {
    try {
      const user = authService.getCurrentUser();
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      const response = await api.subscription.upgrade(newPlanId);
      
      if (response.success) {
        // Update local user data
        if (user) {
          user.subscription_plan = response.plan.name;
          user.plan_features = response.plan.features;
          authService.updateLocalUser(user);
        }
        
        await api.analytics.trackEvent('subscription_upgraded', {
          from_plan: currentPlan.plan?.name,
          to_plan: response.plan.name,
          upgrade_amount: response.upgradeAmount,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Upgrade subscription error:', error);
      throw error;
    }
  },

  // Get invoices
  getInvoices: async () => {
    try {
      const response = await api.subscription.getInvoices();
      
      if (response.success) {
        await api.analytics.trackEvent('invoices_fetched', {
          invoice_count: response.invoices.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get invoices error:', error);
      throw error;
    }
  },

  // Get payment methods
  getPaymentMethods: async () => {
    try {
      const response = await api.subscription.getPaymentMethods();
      
      if (response.success) {
        await api.analytics.trackEvent('payment_methods_fetched', {
          method_count: (response.payment_methods || response.paymentMethods || []).length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get payment methods error:', error);
      throw error;
    }
  },

  // Add payment method
  addPaymentMethod: async (paymentMethod) => {
    try {
      const response = await api.subscription.addPaymentMethod(paymentMethod);
      
      if (response.success) {
        await api.analytics.trackEvent('payment_method_added', {
          method_type: paymentMethod.type,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Add payment method error:', error);
      throw error;
    }
  },

  // Check if user has feature access
  hasFeatureAccess: async (featureKey) => {
    try {
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      if (!currentPlan.success || !currentPlan.plan) {
        return false;
      }
      
      const hasAccess = currentPlan.plan.features?.some(
        feature => (feature.feature_key || feature.key) === featureKey && feature.enabled
      );
      
      return hasAccess || false;
    } catch (error) {
      console.error('Check feature access error:', error);
      return false;
    }
  },

  // Check if user can contribute
  canContribute: async () => {
    try {
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      if (!currentPlan.success || !currentPlan.plan) {
        return false;
      }
      
      // Check if plan allows contributions
      const canContribute = subscriptionService.hasFeatureAccess('can_contribute');
      
      return canContribute;
    } catch (error) {
      console.error('Check can contribute error:', error);
      return false;
    }
  },

  // Get revenue share percentage
  getRevenueShare: async () => {
    try {
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      if (!currentPlan.success || !currentPlan.plan) {
        return 0;
      }
      
      // Revenue share based on plan
      const revenueShares = {
        'Serious Student': 50,
        'Master Student': 60,
      };
      
      return revenueShares[currentPlan.plan.name] || 0;
    } catch (error) {
      console.error('Get revenue share error:', error);
      return 0;
    }
  },

  // Check if user can access premium content
  canAccessPremium: async () => {
    try {
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      if (!currentPlan.success || !currentPlan.plan) {
        return false;
      }
      
      // Basic plan cannot access premium content
      if (currentPlan.plan.name === 'Basic Student') {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Check premium access error:', error);
      return false;
    }
  },

  // Get plan limits (like PLS storage)
  getPlanLimits: async () => {
    try {
      const currentPlan = await subscriptionService.getCurrentPlan();
      
      if (!currentPlan.success || !currentPlan.plan) {
        return null;
      }
      
      const limits = {
        'Basic Student': {
          pls_items: 10,
          storage_mb: 100,
          downloads_per_day: 3,
          can_comment: false,
          can_contribute: false,
        },
        'Serious Student': {
          pls_items: Infinity,
          storage_mb: 1000,
          downloads_per_day: 15,
          can_comment: true,
          can_contribute: true,
        },
        'Master Student': {
          pls_items: Infinity,
          storage_mb: 5000,
          downloads_per_day: Infinity,
          can_comment: true,
          can_contribute: true,
        },
      };
      
      return limits[currentPlan.plan.name] || limits['Basic Student'];
    } catch (error) {
      console.error('Get plan limits error:', error);
      return null;
    }
  },

  // Get trial information
  getTrialInfo: async () => {
    try {
      const user = authService.getCurrentUser();
      
      if (!user) {
        return null;
      }
      
      // Check if user has active trial
      const response = await api.subscription.getCurrentPlan();
      
      if (response.success && response.plan) {
        return {
          has_trial: response.plan.trial_ends_at && new Date(response.plan.trial_ends_at) > new Date(),
          trial_ends_at: response.plan.trial_ends_at,
          days_remaining: response.plan.trial_ends_at 
            ? Math.ceil((new Date(response.plan.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
            : 0,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Get trial info error:', error);
      return null;
    }
  },
};

export default subscriptionService;
