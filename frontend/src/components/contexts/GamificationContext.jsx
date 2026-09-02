import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import XpToast from '../gamification/XpToast';
import LevelUpModal from '../gamification/LevelUpModal';
import BadgeUnlockModal from '../gamification/BadgeUnlockModal';
import StreakMilestone, { isStreakMilestone } from '../gamification/StreakMilestone';

export const GamificationContext = createContext();

export const GamificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(() => {
    try { return Number(localStorage.getItem('shr_streak') || 0); } catch { return 0; }
  });
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  const [badges, setBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Celebration state
  const [xpToasts, setXpToasts] = useState([]);
  const [levelUpLevel, setLevelUpLevel] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [streakMilestone, setStreakMilestone] = useState(null);
  const toastIdRef = useRef(0);
  const prevStreakRef = useRef(0);

  useEffect(() => {
    if (user) return;
    setXp(0);
    setLevel(1);
    setStreak(0);
    setLeaderboardRank(null);
    setLeaderboard([]);
    setBadges([]);
    setEarnedBadges([]);
    setError(null);
    try { localStorage.removeItem('shr_streak'); } catch {
      // Local storage can be unavailable in privacy-restricted contexts.
    }
  }, [user]);

  // Auto-fetch progress whenever the authenticated user changes
  useEffect(() => {
    if (user?.id) refreshProgress();
  }, [user?.id]);

  const refreshProgress = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.gamification.getProgress();
      if (response.success) {
        setXp(Number(response.xp ?? response.currentXP ?? 0) || 0);
        setLevel(Number(response.level ?? 1) || 1);
        const newStreak = Number(response.streak ?? 0) || 0;
        setStreak(newStreak);
        try { localStorage.setItem('shr_streak', String(newStreak)); } catch {
          // Local storage can be unavailable in privacy-restricted contexts.
        }
        prevStreakRef.current = newStreak;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshBadges = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [badgesRes, earnedRes] = await Promise.all([
        api.gamification.getBadges(),
        api.gamification.getEarnedBadges(),
      ]);
      if (badgesRes.success) setBadges(Array.isArray(badgesRes.badges) ? badgesRes.badges : []);
      if (earnedRes.success) {
        const rows = Array.isArray(earnedRes.badges) ? earnedRes.badges : [];
        setEarnedBadges(
          rows
            .map((row) => ({
              id: row.id,
              badge_id: row.badge_id ?? row.badgeId ?? row.badge?.id,
              earned_at: row.earned_at ?? row.earnedAt,
              badge: row.badge,
            }))
            .filter((row) => row.badge_id != null)
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshLeaderboard = useCallback(async (type = 'global', timeFrame = 'weekly', opts = {}) => {
    const silent = Boolean(opts && typeof opts === 'object' && opts.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await api.gamification.getLeaderboard(type, timeFrame);
      if (response.success) {
        const nextLeaderboard = Array.isArray(response.leaderboard) ? response.leaderboard : [];
        const nextRank = Number(response.current_user_rank ?? 0);
        setLeaderboard(nextLeaderboard);
        setLeaderboardRank(Number.isFinite(nextRank) && nextRank > 0 ? Math.round(nextRank) : null);
      }
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const getLeaderboard = useCallback(async (filters = {}) => {
    const type = filters.type || 'global';
    const timeFrame = filters.timeFrame || 'weekly';
    return api.gamification.getLeaderboard(type, timeFrame);
  }, []);

  const _pushXpToast = useCallback((amount, opts = {}) => {
    const id = ++toastIdRef.current;
    setXpToasts((prev) => [...prev, { id, amount, ...opts }]);
  }, []);

  const _removeToast = useCallback((id) => {
    setXpToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Called after any XP event — processes the server response to fire celebrations
  const _handleXpResponse = useCallback((response, amount) => {
    const didLevelUp = Boolean(response.levelUp || response.level_up);
    const newLevelVal = Number(response.newLevel || response.new_level || level);
    const streakPayload = response.streak ?? response.current_streak;
    const newStreak =
      streakPayload !== undefined && streakPayload !== null
        ? Number(streakPayload)
        : Number.NaN;
    const newBadges = Array.isArray(response.newBadges) ? response.newBadges : [];

    // Sync state
    const syncedXp = Number(response.xp ?? response.currentXP ?? response.newXP ?? NaN);
    setXp((prev) => (Number.isFinite(syncedXp) ? syncedXp : prev + amount));
    if (didLevelUp && Number.isFinite(newLevelVal) && newLevelVal > 0) {
      setLevel(newLevelVal);
    }
    if (Number.isFinite(newStreak) && newStreak >= 0) {
      setStreak(newStreak);
      try { localStorage.setItem('shr_streak', String(newStreak)); } catch {
        // Local storage can be unavailable in privacy-restricted contexts.
      }
    }

    const resolvedStreak = Number.isFinite(newStreak) && newStreak >= 0 ? newStreak : streak;

    // XP toast
    _pushXpToast(amount, { levelUp: didLevelUp, newLevel: newLevelVal });

    // Level-up modal
    if (didLevelUp) {
      setLevelUpLevel(newLevelVal);
    }

    // Streak milestone (only fire once per new milestone value)
    if (resolvedStreak > prevStreakRef.current && isStreakMilestone(resolvedStreak)) {
      setStreakMilestone(resolvedStreak);
    }
    prevStreakRef.current = resolvedStreak;

    // Badge modals — queue them so they show one at a time
    if (newBadges.length > 0) {
      setBadgeQueue((prev) => [...prev, ...newBadges]);
      refreshBadges();
    }
  }, [level, streak, _pushXpToast, refreshBadges]);

  const addXp = useCallback(async (amount, reason) => {
    if (!user) return;
    try {
      const response = await api.gamification.addXp(amount, reason);
      if (response.success) {
        api.invalidateCache(['/gamification/progress']);
        _handleXpResponse(response, amount);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [user, _handleXpResponse]);

  // Called from LessonViewer / PracticeSession after a content.complete response
  // that includes `gamification` data returned directly from the backend
  const handleContentComplete = useCallback((gamificationPayload) => {
    if (!gamificationPayload) return;
    const amount = Number(gamificationPayload.xp_awarded || 0);
    if (amount <= 0) return;
    _handleXpResponse(
      {
        xp: xp + amount,
        levelUp: gamificationPayload.level_up,
        newLevel: gamificationPayload.new_level,
        streak: gamificationPayload.streak,
        newBadges: gamificationPayload.new_badges || [],
      },
      amount
    );
  }, [xp, _handleXpResponse]);

  const value = useMemo(
    () => ({
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
      handleContentComplete,
      updateStreak: () => {},
      earnBadge: () => {},
      getXpHistory: () => Promise.resolve({ history: [] }),
      getBadgeProgress: () => null,
      getLeaderboardEntry: () => null,
      shareAchievement: () => {},
      getNextMilestone: () => null,
    }),
    [
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
      handleContentComplete,
    ],
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}

      {/* Global celebration layers — rendered once at app root */}
      <XpToast toasts={xpToasts} onRemove={_removeToast} />

      {levelUpLevel != null && (
        <LevelUpModal
          level={levelUpLevel}
          onClose={() => setLevelUpLevel(null)}
        />
      )}

      {badgeQueue.length > 0 && (
        <BadgeUnlockModal
          badge={badgeQueue[0]}
          onClose={() => setBadgeQueue((prev) => prev.slice(1))}
        />
      )}

      {streakMilestone != null && (
        <StreakMilestone
          streak={streakMilestone}
          onClose={() => setStreakMilestone(null)}
        />
      )}
    </GamificationContext.Provider>
  );
};
