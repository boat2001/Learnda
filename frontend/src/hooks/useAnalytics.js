// useAnalytics.js
import { useCallback, useEffect } from 'react';
import analyticsService from '../services/analyticsService';
import { useAuth } from './useAuth';

// Create a standalone analytics hook that doesn't depend on useAuth
export function useAnalytics(user = null) {
  // user parameter is optional, passed from consuming components
  
  // Page view tracking is handled globally by PageViewTracker in App.jsx

  const trackEvent = useCallback((eventName, properties = {}) => {
    const eventProperties = {
      ...properties,
      user_id: user?.id || null,
      timestamp: new Date().toISOString(),
      platform: 'web',
      url: window.location.href,
      user_agent: navigator.userAgent
    };

    // Send to analytics service
    analyticsService.trackEvent(eventName, eventProperties);

    // Also log to console in development
    // if (process.env.NODE_ENV === 'development') {
    //   console.log(`[Analytics] ${eventName}:`, eventProperties);
    // }
  }, [user?.id]);

  const trackContentInteraction = useCallback((contentId, interactionType, metadata = {}) => {
    trackEvent('content_interaction', {
      content_id: contentId,
      interaction_type: interactionType,
      ...metadata
    });
  }, [trackEvent]);

  const trackSubscriptionEvent = useCallback((planId, eventType, metadata = {}) => {
    trackEvent('subscription_event', {
      plan_id: planId,
      event_type: eventType,
      ...metadata
    });
  }, [trackEvent]);

  const trackGamificationEvent = useCallback((eventType, metadata = {}) => {
    trackEvent('gamification_event', {
      event_type: eventType,
      ...metadata
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackContentInteraction,
    trackSubscriptionEvent,
    trackGamificationEvent
  };
}

// Context-based version for components that don't have access to auth
export function useAnalyticsWithContext() {
  const { user } = useAuth(); // This is OK - analytics CAN consume auth
  return useAnalytics(user);
}
