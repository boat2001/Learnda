import React, { createContext, useState, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { APP_EVENTS, APP_STATE_SCOPES } from '../../utils/appEvents';

export const SubscriptionContext = createContext();

export const useSubscriptionContext = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [currentPlan, setCurrentPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load subscription data
  const loadSubscriptionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load available plans
      const plansResponse = await api.subscription.getPlans();
      if (plansResponse.success) {
        setPlans(plansResponse.plans || plansResponse.data || []);
      }

      if (!userId) {
        return;
      }

      // Load current subscription
      const currentResponse = await api.subscription.getCurrentPlan();
      if (currentResponse.success) {
        const planData = currentResponse.plan || currentResponse.data;
        
        if (planData) {
          // Find matching plan from available plans
          const plan = (plansResponse.plans || plansResponse.data || []).find(
            p => p.id === planData.id || p.name === planData.name || p.name === planData.plan_name
          );
          
          setCurrentPlan({
            ...plan,
            ...planData,
            id: plan?.id || planData.id || planData.plan_id,
            name: plan?.name || planData.name || planData.plan_name,
          });
          setSubscriptionDetails(planData);
        } else {
          // Default to basic free plan
          const basicPlan = (plansResponse.plans || plansResponse.data || []).find(
            p => p.name === 'Basic Student'
          );
          setCurrentPlan({
            ...basicPlan,
            status: 'active',
            expires_at: null,
            started_at: new Date().toISOString(),
          });
        }
      }

      // Load invoices
      const invoicesResponse = await api.subscription.getInvoices();
      if (invoicesResponse.success) {
        setInvoices(invoicesResponse.invoices || invoicesResponse.data || []);
      }

      // Load payment methods
      const paymentMethodsResponse = await api.subscription.getPaymentMethods();
      if (paymentMethodsResponse.success) {
        setPaymentMethods(paymentMethodsResponse.payment_methods || paymentMethodsResponse.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCurrentPlan(null);
      setSubscriptionDetails(null);
      setInvoices([]);
      setPaymentMethods([]);
      loadSubscriptionData();
      return;
    }

    loadSubscriptionData();
  }, [userId, loadSubscriptionData]);

  useEffect(() => {
    if (!userId) return;

    const userPlan = user?.subscription?.plan || null;
    const userPlanName = user?.current_plan || userPlan?.name || null;
    if (!userPlanName && !userPlan) return;

    const matchingPlan = plans.find(
      (plan) =>
        (userPlan?.id && plan.id === userPlan.id) ||
        plan.name === userPlanName
    );

    setCurrentPlan((prev) => {
      const nextPlan = {
        ...(matchingPlan || {}),
        ...(userPlan || {}),
        id: userPlan?.id || matchingPlan?.id || prev?.id || null,
        name: userPlanName || matchingPlan?.name || prev?.name || "Basic Student",
      };

      if (prev?.id === nextPlan.id && prev?.name === nextPlan.name) {
        return prev;
      }

      return nextPlan;
    });
  }, [userId, user?.subscription?.plan, user?.current_plan, plans]);

  useEffect(() => {
    const handleStateChanged = (event) => {
      const scopes = event?.detail?.scopes || [];
      const shouldRefresh =
        scopes.length === 0 ||
        scopes.includes(APP_STATE_SCOPES.SUBSCRIPTION) ||
        scopes.includes(APP_STATE_SCOPES.PROFILE) ||
        scopes.includes(APP_STATE_SCOPES.SETTINGS);

      if (!shouldRefresh) return;
      loadSubscriptionData();
    };

    window.addEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
    return () => window.removeEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
  }, [loadSubscriptionData]);

  // Subscribe to a plan
  const subscribe = useCallback(async (planId, billingCycle = 'monthly', paymentMethod = null) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const response = await api.subscription.subscribe(planId, billingCycle, paymentMethod);
      
      if (response.success) {
        await loadSubscriptionData();
        // Track subscription event
        if (window.gtag) {
          window.gtag('event', 'purchase', {
            transaction_id: response.transaction_id,
            value: response.amount,
            currency: response.currency || 'GHS',
            items: [{
              item_id: planId,
              item_name: response.plan_name,
              price: response.amount,
              quantity: 1,
            }],
          });
        }
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, loadSubscriptionData]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const response = await api.subscription.cancel();
      
      if (response.success) {
        await loadSubscriptionData();
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, loadSubscriptionData]);

  // Upgrade subscription
  const upgradeSubscription = useCallback(async (newPlanId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const response = await api.subscription.upgrade(newPlanId);
      
      if (response.success) {
        await loadSubscriptionData();
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, loadSubscriptionData]);

  // Add payment method
  const addPaymentMethod = useCallback(async (paymentMethod) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const response = await api.subscription.addPaymentMethod(paymentMethod);
      
      if (response.success) {
        setPaymentMethods(prev => [...prev, response.payment_method]);
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Remove payment method
  const removePaymentMethod = useCallback(async (paymentMethodId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const response = await api.subscription.removePaymentMethod(paymentMethodId);
      
      if (response.success) {
        setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user has a specific feature
  const hasFeature = useCallback((featureKey) => {
    if (!currentPlan || !currentPlan.features) return false;
    
    const feature = currentPlan.features.find(
      f => f.feature_key === featureKey || f.key === featureKey
    );
    return feature ? feature.enabled : false;
  }, [currentPlan]);

  // Check if user has a specific plan or higher
  const hasPlanOrHigher = useCallback((planName) => {
    if (!currentPlan) return false;
    
    const planHierarchy = {
      'Basic Student': 1,
      'Serious Student': 2,
      'Master Student': 3,
      'Premium Contributor': 4,
    };
    
    const userPlanLevel = planHierarchy[currentPlan.name] || 0;
    const requiredPlanLevel = planHierarchy[planName] || 0;
    
    return userPlanLevel >= requiredPlanLevel;
  }, [currentPlan]);

  // Get plan features
  const getPlanFeatures = useCallback((planName) => {
    const plan = plans.find(p => p.name === planName);
    return plan ? plan.features : [];
  }, [plans]);

  // Calculate days until subscription expires
  const getDaysUntilExpiration = useCallback(() => {
    if (!subscriptionDetails || !subscriptionDetails.expires_at) return null;
    
    const expiresAt = new Date(subscriptionDetails.expires_at);
    const now = new Date();
    const diffTime = expiresAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }, [subscriptionDetails]);

  const value = useMemo(() => ({
    // State
    currentPlan,
    plans,
    subscriptionDetails,
    invoices,
    paymentMethods,
    loading,
    error,

    // Actions
    loadSubscriptionData,
    subscribe,
    cancelSubscription,
    upgradeSubscription,
    addPaymentMethod,
    removePaymentMethod,

    // Feature checks
    hasFeature,
    hasPlanOrHigher,
    getPlanFeatures,
    getDaysUntilExpiration,

    // Convenience
    refresh: loadSubscriptionData,
    isSubscribed: !!currentPlan && currentPlan.status === 'active',
    isTrial: subscriptionDetails?.is_trial || false,
    canCancel: currentPlan?.cancellable || false,
  }), [
    currentPlan, plans, subscriptionDetails, invoices, paymentMethods,
    loading, error,
    loadSubscriptionData, subscribe, cancelSubscription, upgradeSubscription,
    addPaymentMethod, removePaymentMethod,
    hasFeature, hasPlanOrHigher, getPlanFeatures, getDaysUntilExpiration,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
