import { useContext } from 'react';
import { GamificationContext } from '../components/contexts/GamificationContext';

export const useGamification = () => {
  const context = useContext(GamificationContext);
  
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }

  const {
    xp,
    level,
    streak,
    leaderboardRank,
    badges,
    earnedBadges,
    leaderboard,
    loading,
    error,
    
    refreshProgress,
    refreshBadges,
    refreshLeaderboard,
    getLeaderboard,

    addXp,
    levelUp,
    updateStreak,
    earnBadge,
    
    getXpHistory,
    getBadgeProgress,
    getLeaderboardEntry,
    
    shareAchievement,
    getNextMilestone,
  } = context;

  // Custom hook functions
  const getXpToNextLevel = () => {
    const xpRequirements = [
      0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000
    ];
    
    const currentRequirement = xpRequirements[level - 1] || 0;
    const nextRequirement = xpRequirements[level] || xpRequirements[xpRequirements.length - 1];
    
    return nextRequirement - xp + currentRequirement;
  };

  const getLevelProgress = () => {
    const xpRequirements = [
      0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000
    ];
    
    const currentRequirement = xpRequirements[level - 1] || 0;
    const nextRequirement = xpRequirements[level] || xpRequirements[xpRequirements.length - 1];
    
    const xpInLevel = xp - currentRequirement;
    const levelXpRange = nextRequirement - currentRequirement;
    
    return levelXpRange > 0 ? (xpInLevel / levelXpRange) * 100 : 100;
  };

  const getBadgeCounts = () => {
    const counts = {
      total: badges.length,
      earned: earnedBadges.length,
      remaining: badges.length - earnedBadges.length,
    };

    const byRarity = {};
    const byCategory = {};

    badges.forEach((badge) => {
      byRarity[badge.rarity] = (byRarity[badge.rarity] || 0) + 1;
      byCategory[badge.category] = (byCategory[badge.category] || 0) + 1;
    });

    return { ...counts, byRarity, byCategory };
  };

  const getUnearnedBadges = () => {
    const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));
    return badges.filter(badge => !earnedBadgeIds.has(badge.id));
  };

  const getRecentBadges = (limit = 5) => {
    const sorted = [...earnedBadges].sort((a, b) => 
      new Date(b.earned_at) - new Date(a.earned_at)
    );
    
    return sorted.slice(0, limit).map(earned => {
      const badge = badges.find(b => b.id === earned.badge_id);
      return badge ? { ...badge, earned_at: earned.earned_at } : null;
    }).filter(Boolean);
  };

  const getUserRank = () => {
    if (!leaderboard || leaderboard.length === 0) return null;
    
    // This would normally come from the backend
    const userEntry = leaderboard.find(entry => entry.is_current_user);
    return userEntry?.rank || null;
  };

  const getTopPerformers = (limit = 3) => {
    return leaderboard.slice(0, limit);
  };

  const calculateXpFromActivity = (activityType, metadata = {}) => {
    const xpRewards = {
      'content_view': 10,
      'content_complete': 50,
      'quiz_pass': 25,
      'daily_login': 15,
      'content_upload': 100,
      'comment_upvote': 20,
      'study_session': 5, // per 15 minutes
    };
    
    let baseXp = xpRewards[activityType] || 0;
    
    // Apply multipliers based on metadata
    if (metadata.is_premium) baseXp *= 1.5;
    if (metadata.difficulty === 'advanced') baseXp *= 1.2;
    if (metadata.streak_multiplier) baseXp *= metadata.streak_multiplier;
    
    return Math.round(baseXp);
  };

  const checkBadgeProgress = (badgeId) => {
    const badge = badges.find(b => b.id === badgeId);
    if (!badge) return null;
    
    const isEarned = earnedBadges.some(b => b.badge_id === badgeId);
    
    if (isEarned) {
      const earnedBadge = earnedBadges.find(b => b.badge_id === badgeId);
      return {
        earned: true,
        earned_at: earnedBadge.earned_at,
        progress: 100,
      };
    }
    
    // Calculate progress based on badge requirements
    let progress = 0;
    if (badge.progress_required && badge.current_progress) {
      progress = Math.min((badge.current_progress / badge.progress_required) * 100, 100);
    }
    
    return {
      earned: false,
      progress,
      remaining: badge.progress_required - (badge.current_progress || 0),
    };
  };

  return {
    // State
    xp,
    level,
    streak,
    leaderboardRank,
    badges,
    earnedBadges,
    leaderboard,
    loading,
    error,
    
    // Basic operations
    refreshProgress,
    refreshBadges,
    refreshLeaderboard,
    getLeaderboard,

    // XP and level operations
    addXp,
    levelUp,
    updateStreak,
    earnBadge,
    
    // Data retrieval
    getXpHistory,
    getBadgeProgress,
    getLeaderboardEntry,
    
    // Social features
    shareAchievement,
    getNextMilestone,
    
    // Helper functions
    getXpToNextLevel,
    getLevelProgress,
    getBadgeCounts,
    getUnearnedBadges,
    getRecentBadges,
    getUserRank,
    getTopPerformers,
    calculateXpFromActivity,
    checkBadgeProgress,
  };
};
