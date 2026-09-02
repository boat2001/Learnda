import { useContext } from 'react';
import { ContentContext } from '../components/contexts/ContentContext';

export const useContent = () => {
  const context = useContext(ContentContext);
  
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }

  const {
    content,
    loading,
    error,
    featuredContent,
    trendingContent,
    personalizedContent,
    currentContent,
    pagination,
    
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
  } = context;

  // Custom hook functions
  const getContentStats = (contentId) => {
    const item = content.find(c => c.id === contentId);
    return item?.stats || null;
  };

  const isContentLiked = (contentId) => {
    const item = content.find(c => c.id === contentId);
    return item?.user_interactions?.liked || false;
  };

  const isContentSaved = (contentId) => {
    const item = content.find(c => c.id === contentId);
    return item?.user_interactions?.saved || false;
  };

  const getContentProgress = (contentId) => {
    const item = content.find(c => c.id === contentId);
    return item?.user_interactions?.progress || 0;
  };

  const getContentByType = (type) => {
    return content.filter(item => item.type === type);
  };

  const getPremiumContent = () => {
    return content.filter(item => item.is_premium);
  };

  const getFreeContent = () => {
    return content.filter(item => !item.is_premium);
  };

  const getContentByCourse = (courseName) => {
    return content.filter(item => item.course === courseName);
  };

  const getContentByLevel = (level) => {
    return content.filter(item => item.level === level);
  };

  return {
    // State
    content,
    loading,
    error,
    featuredContent,
    trendingContent,
    personalizedContent,
    currentContent,
    pagination,
    
    // Basic operations
    fetchContent,
    fetchContentById,
    getContentById,
    getContentList,
    fetchFeatured,
    fetchTrending,
    fetchPersonalized,
    
    // User interactions
    likeContent,
    saveContent,
    completeContent,
    trackViewTime,
    trackEngagement,
    
    // Comments
    addComment,
    getComments,
    upvoteComment,
    
    // Content management
    uploadContent,
    updateContent,
    deleteContent,
    getMyContent,
    
    // Search and filter
    searchContent,
    filterContent,
    getRelatedContent,
    
    // Helper functions
    getContentStats,
    isContentLiked,
    isContentSaved,
    getContentProgress,
    getContentByType,
    getPremiumContent,
    getFreeContent,
    getContentByCourse,
    getContentByLevel,
  };
};
