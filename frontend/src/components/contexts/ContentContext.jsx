import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import contentService from '../../services/contentService';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';

export const ContentContext = createContext();

export const ContentProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentPlan, hasFeature, loading: subscriptionLoading } = useSubscription();
  const [content, setContent] = useState([]);
  const [featuredContent, setFeaturedContent] = useState([]);
  const [trendingContent, setTrendingContent] = useState([]);
  const [personalizedContent, setPersonalizedContent] = useState([]);
  const [currentContent, setCurrentContent] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleResponse = (response, setter) => {
    if (response?.success) {
      setter(response.content || response.data || []);
      if (typeof response.total !== 'undefined') {
        setPagination({
          total: response.total || 0,
          page: response.page || 1
        });
      }
      return response.content || response.data || [];
    }

    throw new Error(response?.error || 'Request failed');
  };

  const fetchContent = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await contentService.getAllContent(filters);
      return handleResponse(response, setContent);
    } catch (err) {
      setError(err.message || 'Failed to load content');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContentById = useCallback(async (contentId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await contentService.getContentById(contentId);
      if (response?.success) {
        setCurrentContent(response.content);
        return response.content;
      }

      throw new Error(response?.error || 'Failed to load content');
    } catch (err) {
      setError(err.message || 'Failed to load content');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getContentById = useCallback(async (contentId) => {
    const response = await contentService.getContentById(contentId);
    return response?.content || null;
  }, []);

  const getContentList = useCallback(async (filters = {}) => {
    const response = await contentService.getAllContent(filters);
    return {
      data: response?.content || [],
      total: response?.total || 0
    };
  }, []);

  const fetchFeatured = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await contentService.getFeaturedContent();
      return handleResponse(response, setFeaturedContent);
    } catch (err) {
      setError(err.message || 'Failed to load featured content');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await contentService.getTrendingContent();
      return handleResponse(response, setTrendingContent);
    } catch (err) {
      setError(err.message || 'Failed to load trending content');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersonalized = useCallback(async () => {
    if (!user) return [];
    if (subscriptionLoading || !currentPlan) return [];
    if (!hasFeature('personalization')) {
      setPersonalizedContent([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await contentService.getPersonalizedContent(user.id);
      return handleResponse(response, setPersonalizedContent);
    } catch (err) {
      setError(err.message || 'Failed to load personalized content');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, currentPlan, hasFeature, subscriptionLoading]);

  useEffect(() => {
    fetchFeatured();
    fetchTrending();
  }, [fetchFeatured, fetchTrending]);

  useEffect(() => {
    if (user) {
      fetchPersonalized();
    }
  }, [user, fetchPersonalized]);

  const likeContent = async (contentId) => {
    const response = await contentService.likeContent(contentId);
    const liked = response?.liked;

    if (typeof liked === 'boolean') {
      const update = (list) =>
        list.map((item) =>
          item.id === contentId
            ? {
                ...item,
                user_interactions: {
                  ...item.user_interactions,
                  liked
                }
              }
            : item
        );

      setContent((prev) => update(prev));
      setFeaturedContent((prev) => update(prev));
      setTrendingContent((prev) => update(prev));
      setPersonalizedContent((prev) => update(prev));
    }

    return response;
  };

  const saveContent = async (contentId) => {
    const response = await contentService.saveContent(contentId);
    const saved = response?.saved;

    if (typeof saved === 'boolean') {
      const update = (list) =>
        list.map((item) =>
          item.id === contentId
            ? {
                ...item,
                user_interactions: {
                  ...item.user_interactions,
                  saved
                }
              }
            : item
        );

      setContent((prev) => update(prev));
      setFeaturedContent((prev) => update(prev));
      setTrendingContent((prev) => update(prev));
      setPersonalizedContent((prev) => update(prev));
    }

    return response;
  };

  const completeContent = async (contentId, payloadOrDuration = 0) => {
    const response = await contentService.completeContent(contentId, payloadOrDuration);
    return response;
  };

  const trackViewTime = async (contentId, payloadOrDuration = 0) => {
    return contentService.trackContentView(contentId, payloadOrDuration);
  };

  const trackEngagement = async (contentId, action, payload = {}) => {
    if (action === 'complete') {
      return completeContent(contentId, payload);
    }

    if (action === 'progress') {
      return contentService.trackContentView(contentId, payload);
    }

    return contentService.trackContentView(contentId, payload);
  };

  const addComment = async (contentId, body) => {
    const response = await contentService.addComment(contentId, body);
    return response?.comment || null;
  };

  const getComments = async (contentId) => {
    const response = await contentService.getComments(contentId);
    return response?.comments || [];
  };

  const upvoteComment = async (commentId) => {
    return contentService.upvoteComment(commentId);
  };

  const uploadContent = async (formData) => contentService.uploadContent(formData);
  const updateContent = async (contentId, payload) => contentService.updateContent(contentId, payload);
  const deleteContent = async (contentId) => contentService.deleteContent(contentId);
  const getMyContent = async () => contentService.getMyContent();

  const searchContent = async (query, filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await contentService.searchContent(query, filters);
      return handleResponse(response, setContent);
    } catch (err) {
      setError(err.message || 'Search failed');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const filterContent = async (filters = {}) => fetchContent(filters);

  const getRelatedContent = async (filters = {}) => {
    const response = await contentService.getAllContent(filters);
    return response?.content || [];
  };

  const value = useMemo(() => ({
    content,
    featuredContent,
    trendingContent,
    personalizedContent,
    currentContent,
    pagination,
    loading,
    error,
    fetchContent,
    fetchContentById,
    getContentById,
    getContentList,
    fetchFeatured,
    fetchTrending,
    fetchPersonalized,
    likeContent,
    saveContent,
    completeContent,
    trackViewTime,
    trackEngagement,
    addComment,
    getComments,
    upvoteComment,
    uploadContent,
    updateContent,
    deleteContent,
    getMyContent,
    searchContent,
    filterContent,
    getRelatedContent,
  }), [
    content, featuredContent, trendingContent, personalizedContent,
    currentContent, pagination, loading, error,
    fetchContent, fetchContentById, getContentById, getContentList,
    fetchFeatured, fetchTrending, fetchPersonalized,
    likeContent, saveContent, completeContent, trackViewTime,
    trackEngagement, addComment, getComments, upvoteComment,
    uploadContent, updateContent, deleteContent, getMyContent,
    searchContent, filterContent, getRelatedContent,
  ]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};
