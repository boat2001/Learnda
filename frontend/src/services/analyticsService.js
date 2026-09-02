import api from './api';
import authService from './authService';

export const analyticsService = {
  // Track custom event
  trackEvent: async (eventName, properties = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const eventData = {
        eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          platform: 'web',
          user_id: user?.id || null,
          session_id: localStorage.getItem('session_id') || null,
          url: window.location.href,
          referrer: document.referrer,
          user_agent: navigator.userAgent,
        },
      };
      
      // Send to backend
      const response = await api.analytics.trackEvent(eventName, eventData.properties);
      
      // Also send to Google Analytics (if configured)
      if (window.gtag) {
        window.gtag('event', eventName, eventData.properties);
      }
      
      return response;
    } catch (error) {
      console.error('Track event error:', error);
      // Don't throw error for analytics failures
    }
  },

  // Track page view
  trackPageView: async (page, properties = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const pageData = {
        page,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          platform: 'web',
          user_id: user?.id || null,
          session_id: localStorage.getItem('session_id') || null,
          title: document.title,
          url: window.location.href,
          referrer: document.referrer,
        },
      };
      
      // Send to backend
      const response = await api.analytics.trackPageView(page, pageData.properties);
      
      // Also send to Google Analytics
      if (window.gtag) {
        window.gtag('config', 'G-9MBDQZ48EH', {
          page_path: page,
          ...pageData.properties,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Track page view error:', error);
    }
  },

  // Track learning session
  trackLearningSession: async (sessionData) => {
    try {
      const user = authService.getCurrentUser();
      
      const sessionEvent = {
        eventName: 'learning_session',
        properties: {
          ...sessionData,
          timestamp: new Date().toISOString(),
          platform: 'web',
          user_id: user?.id || null,
          session_id: localStorage.getItem('session_id') || null,
          duration: sessionData.end_time - sessionData.start_time,
        },
      };
      
      return await analyticsService.trackEvent('learning_session', sessionEvent.properties);
    } catch (error) {
      console.error('Track learning session error:', error);
    }
  },

  // Track content interaction
  trackContentInteraction: async (contentId, interactionType, details = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const interactionData = {
        content_id: contentId,
        interaction_type: interactionType,
        ...details,
        timestamp: new Date().toISOString(),
        platform: 'web',
        user_id: user?.id || null,
      };
      
      return await analyticsService.trackEvent('content_interaction', interactionData);
    } catch (error) {
      console.error('Track content interaction error:', error);
    }
  },

  // Track conversion
  trackConversion: async (conversionType, value = 0, details = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const conversionData = {
        conversion_type: conversionType,
        value,
        ...details,
        timestamp: new Date().toISOString(),
        platform: 'web',
        user_id: user?.id || null,
      };
      
      // Send to backend
      const response = await analyticsService.trackEvent('conversion', conversionData);
      
      // Also send ecommerce data to Google Analytics
      if (window.gtag && value > 0) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-CONVERSION_ID',
          value,
          currency: 'GHS',
          transaction_id: details.transaction_id,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Track conversion error:', error);
    }
  },

  // Track error
  trackError: async (errorData, context = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const errorEvent = {
        eventName: 'error',
        properties: {
          error_message: errorData.message,
          error_stack: errorData.stack,
          error_name: errorData.name,
          ...context,
          timestamp: new Date().toISOString(),
          platform: 'web',
          user_id: user?.id || null,
          url: window.location.href,
        },
      };
      
      return await analyticsService.trackEvent('error', errorEvent.properties);
    } catch (error) {
      console.error('Track error error:', error);
    }
  },

  // Track user engagement
  trackEngagement: async (engagementType, details = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const engagementData = {
        engagement_type: engagementType,
        ...details,
        timestamp: new Date().toISOString(),
        platform: 'web',
        user_id: user?.id || null,
      };
      
      return await analyticsService.trackEvent('user_engagement', engagementData);
    } catch (error) {
      console.error('Track engagement error:', error);
    }
  },

  // Get user's learning statistics
  getLearningStats: async () => {
    try {
      const response = await api.analytics.getLearningStats();
      
      if (response.success) {
        await analyticsService.trackEvent('learning_stats_fetched');
      }
      
      return response;
    } catch (error) {
      console.error('Get learning stats error:', error);
      throw error;
    }
  },

  // Get usage statistics
  getUsageStats: async (timeRange = '30d') => {
    try {
      const response = await api.analytics.getUsageStats(timeRange);
      
      if (response.success) {
        await analyticsService.trackEvent('usage_stats_fetched', { time_range: timeRange });
      }
      
      return response;
    } catch (error) {
      console.error('Get usage stats error:', error);
      throw error;
    }
  },

  // Initialize analytics
  initialize: () => {
    // Generate session ID if not exists
    if (!localStorage.getItem('session_id')) {
      const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('session_id', sessionId);
    }
    
    // Track session start
    analyticsService.trackEvent('session_start', {
      session_id: localStorage.getItem('session_id'),
      first_visit: !localStorage.getItem('has_visited'),
    });
    
    // Mark as visited
    localStorage.setItem('has_visited', 'true');
    
    // Set up error tracking
    window.addEventListener('error', (event) => {
      analyticsService.trackError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });
    
    // Set up unhandled promise rejection tracking
    window.addEventListener('unhandledrejection', (event) => {
      analyticsService.trackError({
        message: event.reason?.message || 'Unhandled promise rejection',
        reason: event.reason,
      });
    });
  },

  // Track user flow
  trackUserFlow: async (flowName, step, details = {}) => {
    try {
      const user = authService.getCurrentUser();
      
      const flowData = {
        flow_name: flowName,
        step,
        ...details,
        timestamp: new Date().toISOString(),
        platform: 'web',
        user_id: user?.id || null,
      };
      
      return await analyticsService.trackEvent('user_flow', flowData);
    } catch (error) {
      console.error('Track user flow error:', error);
    }
  },

  // Track performance metrics
  trackPerformance: async (metricName, value, details = {}) => {
    try {
      const performanceData = {
        metric_name: metricName,
        value,
        ...details,
        timestamp: new Date().toISOString(),
        platform: 'web',
      };
      
      return await analyticsService.trackEvent('performance_metric', performanceData);
    } catch (error) {
      console.error('Track performance error:', error);
    }
  },
};

export default analyticsService;
