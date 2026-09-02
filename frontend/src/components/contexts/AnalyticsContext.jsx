import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import analyticsService from '../../services/analyticsService';

export const AnalyticsContext = createContext();

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
};

export const AnalyticsProvider = ({ children }) => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState({
    learningStats: null,
    usageStats: null,
    performanceStats: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize analytics
  const initializeAnalytics = useCallback(() => {
    analyticsService.initialize();
  }, []);

  useEffect(() => {
    initializeAnalytics();
  }, [initializeAnalytics]);

  // Track custom event
  const trackEvent = useCallback(async (eventName, properties = {}) => {
    try {
      const eventData = {
        ...properties,
        user_id: user?.id || null,
        timestamp: new Date().toISOString(),
        platform: 'web',
        session_id: localStorage.getItem('session_id') || null,
        url: window.location.href,
        referrer: document.referrer,
        user_agent: navigator.userAgent,
      };

      await analyticsService.trackEvent(eventName, eventData);

      // Log in development
      if (import.meta.env.DEV) {
        console.log(`[Analytics] ${eventName}:`, eventData);
      }
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  }, [user]);

  // Track page view
  const trackPageView = useCallback(async (page, properties = {}) => {
    try {
      const pageData = {
        ...properties,
        user_id: user?.id || null,
        session_id: localStorage.getItem('session_id') || null,
        timestamp: new Date().toISOString(),
        platform: 'web',
        title: document.title,
        url: window.location.href,
        referrer: document.referrer,
      };

      await analyticsService.trackPageView(page, pageData);
    } catch (err) {
      console.error('Error tracking page view:', err);
    }
  }, [user]);

  // Track content interaction
  const trackContentInteraction = useCallback(async (contentId, interactionType, details = {}) => {
    try {
      await trackEvent('content_interaction', {
        content_id: contentId,
        interaction_type: interactionType,
        ...details,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking content interaction:', err);
    }
  }, [trackEvent, user]);

  // Track learning session
  const trackLearningSession = useCallback(async (sessionData) => {
    try {
      await analyticsService.trackLearningSession({
        ...sessionData,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking learning session:', err);
    }
  }, [user]);

  // Track conversion
  const trackConversion = useCallback(async (conversionType, value = 0, details = {}) => {
    try {
      await analyticsService.trackConversion(conversionType, value, {
        ...details,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking conversion:', err);
    }
  }, [user]);

  // Track error
  const trackError = useCallback(async (errorData, context = {}) => {
    try {
      await analyticsService.trackError(errorData, {
        ...context,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking error:', err);
    }
  }, [user]);

  // Get learning statistics
  const getLearningStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await analyticsService.getLearningStats();
      
      if (response.success) {
        setAnalyticsData(prev => ({
          ...prev,
          learningStats: response.data,
        }));
        await trackEvent('learning_stats_fetched');
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      await trackError(err, { context: 'fetch_learning_stats' });
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [trackEvent, trackError]);

  // Get usage statistics
  const getUsageStats = useCallback(async (timeRange = '30d') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await analyticsService.getUsageStats(timeRange);
      
      if (response.success) {
        setAnalyticsData(prev => ({
          ...prev,
          usageStats: response.data,
        }));
        await trackEvent('usage_stats_fetched', { time_range: timeRange });
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      await trackError(err, { context: 'fetch_usage_stats' });
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [trackEvent, trackError]);

  // Track user flow
  const trackUserFlow = useCallback(async (flowName, step, details = {}) => {
    try {
      await analyticsService.trackUserFlow(flowName, step, {
        ...details,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking user flow:', err);
    }
  }, [user]);

  // Track performance metrics
  const trackPerformance = useCallback(async (metricName, value, details = {}) => {
    try {
      await analyticsService.trackPerformance(metricName, value, {
        ...details,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error tracking performance:', err);
    }
  }, [user]);

  const value = {
    analyticsData,
    loading,
    error,
    initializeAnalytics,
    trackEvent,
    trackPageView,
    trackContentInteraction,
    trackLearningSession,
    trackConversion,
    trackError,
    getLearningStats,
    getUsageStats,
    trackUserFlow,
    trackPerformance,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};
