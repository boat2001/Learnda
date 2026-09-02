import api from './api';

export const contentService = {
  // Get all content with optional filters
  getAllContent: async (filters = {}) => {
    try {
      const response = await api.content.getAll(filters);
      
      if (response.success) {
        // Track content fetch
        await api.analytics.trackEvent('content_fetched', {
          filter_count: Object.keys(filters).length,
          content_count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get content error:', error);
      throw error;
    }
  },

  // Get content by ID
  getContentById: async (contentId) => {
    try {
      const response = await api.content.getById(contentId);
      
      if (response.success) {
        await api.analytics.trackEvent('content_viewed', {
          content_id: contentId,
          content_type: response.content.type,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get content by ID error:', error);
      throw error;
    }
  },

  // Get featured content
  getFeaturedContent: async () => {
    try {
      const response = await api.content.getFeatured();
      
      if (response.success) {
        await api.analytics.trackEvent('featured_content_fetched', {
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get featured content error:', error);
      throw error;
    }
  },

  // Get trending content
  getTrendingContent: async () => {
    try {
      const response = await api.content.getTrending();
      
      if (response.success) {
        await api.analytics.trackEvent('trending_content_fetched', {
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get trending content error:', error);
      throw error;
    }
  },

  // Get personalized content
  getPersonalizedContent: async (userId) => {
    try {
      const response = await api.content.getPersonalized(userId);
      
      if (response.success) {
        await api.analytics.trackEvent('personalized_content_fetched', {
          user_id: userId,
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      if (error?.status === 403) {
        return { success: true, content: [], data: [] };
      }

      console.error('Get personalized content error:', error);
      throw error;
    }
  },

  // Search content
  searchContent: async (query, filters = {}) => {
    try {
      const response = await api.content.search(query, filters);
      
      if (response.success) {
        await api.analytics.trackEvent('content_searched', {
          query,
          result_count: (response.content || response.results || []).length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Search content error:', error);
      throw error;
    }
  },

  // Like content
  likeContent: async (contentId) => {
    try {
      const response = await api.content.like(contentId);
      
      if (response.success) {
        await api.analytics.trackEvent('content_liked', {
          content_id: contentId,
          liked: response.liked,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Like content error:', error);
      throw error;
    }
  },

  // React with emoji to content
  reactToContent: async (contentId, emoji) => {
    try {
      const response = await api.content.react(contentId, emoji);
      if (response?.success) {
        await api.analytics.trackEvent('content_reacted', { content_id: contentId, emoji });
      }
      return response;
    } catch (error) {
      console.error('React content error:', error);
      throw error;
    }
  },

  // Save content to PLS
  saveContent: async (contentId) => {
    try {
      const response = await api.content.save(contentId);
      
      if (response.success) {
        await api.analytics.trackEvent('content_saved', {
          content_id: contentId,
          saved: response.saved,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Save content error:', error);
      throw error;
    }
  },

  // Share content
  shareContent: async (contentId) => {
    try {
      const response = await api.content.share(contentId);

      if (response.success) {
        await api.analytics.trackEvent('content_shared', {
          content_id: contentId,
        });
      }

      return response;
    } catch (error) {
      console.error('Share content error:', error);
      throw error;
    }
  },

  getShareCard: async (contentId) => {
    try {
      const blob = await api.content.getShareCard(contentId);
      return blob;
    } catch (error) {
      console.error('Get share card error:', error);
      throw error;
    }
  },

  // Get saved favorites
  getFavorites: async () => {
    try {
      const response = await api.content.getFavorites();
      return response;
    } catch (error) {
      console.error('Get favorites error:', error);
      throw error;
    }
  },

  // Mark content as completed
  completeContent: async (contentId, payloadOrDuration = 0) => {
    try {
      const response = await api.content.complete(contentId, payloadOrDuration);
      const duration =
        payloadOrDuration && typeof payloadOrDuration === 'object'
          ? Number(payloadOrDuration.duration_seconds || payloadOrDuration.duration || 0)
          : Number(payloadOrDuration || 0);
      
      if (response.success) {
        await api.analytics.trackEvent('content_completed', {
          content_id: contentId,
          duration,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Complete content error:', error);
      throw error;
    }
  },

  // Track content view time
  trackContentView: async (contentId, payloadOrDuration, progress = 0) => {
    try {
      const response = await api.content.trackView(contentId, payloadOrDuration, progress);
      const duration =
        payloadOrDuration && typeof payloadOrDuration === 'object'
          ? Number(payloadOrDuration.duration_seconds || payloadOrDuration.duration || 0)
          : Number(payloadOrDuration || 0);
      const progressValue =
        payloadOrDuration && typeof payloadOrDuration === 'object'
          ? Number(payloadOrDuration.progress_percentage || payloadOrDuration.progress || 0)
          : Number(progress || 0);
      
      if (response.success) {
        await api.analytics.trackEvent('content_view_tracked', {
          content_id: contentId,
          duration,
          progress_percentage: progressValue,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Track view error:', error);
      throw error;
    }
  },

  // Get comments for content
  getComments: async (contentId) => {
    try {
      const response = await api.content.getComments(contentId);
      
      if (response.success) {
        await api.analytics.trackEvent('comments_fetched', {
          content_id: contentId,
          comment_count: response.comments.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  },

  // Add comment
  addComment: async (contentId, content) => {
    try {
      const response = await api.content.addComment(contentId, content);
      
      if (response.success) {
        await api.analytics.trackEvent('comment_added', {
          content_id: contentId,
          comment_id: response.comment.id,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  },

  upvoteComment: async (commentId) => {
    try {
      const response = await api.comments.upvote(commentId);
      return response;
    } catch (error) {
      console.error('Upvote comment error:', error);
      throw error;
    }
  },

  deleteComment: async (commentId) => {
    try {
      const response = await api.comments.remove(commentId);
      return response;
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  },

  // Upload content
  uploadContent: async (formData) => {
    try {
      const response = await api.content.upload(formData);
      
      if (response.success) {
        await api.analytics.trackEvent('content_uploaded', {
          content_id: response.contentId,
          content_type: formData.get('content_type'),
        });
      }
      
      return response;
    } catch (error) {
      console.error('Upload content error:', error);
      throw error;
    }
  },

  updateContent: async (contentId, payload) => {
    try {
      const response = await api.content.update(contentId, payload);
      return response;
    } catch (error) {
      console.error('Update content error:', error);
      throw error;
    }
  },

  deleteContent: async (contentId) => {
    try {
      const response = await api.content.delete(contentId);
      return response;
    } catch (error) {
      console.error('Delete content error:', error);
      throw error;
    }
  },

  getMyContent: async () => {
    try {
      const response = await api.content.getMyContent();
      return response;
    } catch (error) {
      console.error('Get my content error:', error);
      throw error;
    }
  },

  // Get content statistics
  getContentStats: async (contentId) => {
    try {
      const response = await api.content.getStats(contentId);
      
      if (response.success) {
        await api.analytics.trackEvent('content_stats_fetched', {
          content_id: contentId,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get content stats error:', error);
      throw error;
    }
  },

  // Get content by course
  getContentByCourse: async (course) => {
    try {
      const response = await api.content.getAll({ course });
      
      if (response.success) {
        await api.analytics.trackEvent('course_content_fetched', {
          course,
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get course content error:', error);
      throw error;
    }
  },

  // Get content by level
  getContentByLevel: async (level) => {
    try {
      const response = await api.content.getAll({ level });
      
      if (response.success) {
        await api.analytics.trackEvent('level_content_fetched', {
          level,
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get level content error:', error);
      throw error;
    }
  },

  // Get premium content
  getPremiumContent: async () => {
    try {
      const response = await api.content.getAll({ is_premium: true });
      
      if (response.success) {
        await api.analytics.trackEvent('premium_content_fetched', {
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get premium content error:', error);
      throw error;
    }
  },

  // Get free content
  getFreeContent: async () => {
    try {
      const response = await api.content.getAll({ is_premium: false });
      
      if (response.success) {
        await api.analytics.trackEvent('free_content_fetched', {
          count: response.content.length,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Get free content error:', error);
      throw error;
    }
  },
};

export default contentService;
