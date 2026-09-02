import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiCheck,
  FiChevronLeft,
  FiClipboard,
  FiDownload,
  FiEye,
  FiFeather,
  FiFlag,
  FiGlobe,
  FiInfo,
  FiLock,
  FiMessageSquare,
  FiShare2,
  FiSmile,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { FaWhatsapp, FaXTwitter, FaTelegram } from 'react-icons/fa6';
import FormModal from '../components/common/FormModal';
import ConfettiOverlay from '../components/gamification/ConfettiOverlay';
import ContributionAppeal from '../components/subscription/ContributionAppeal';
import ShareToStudyGroupModal from '../components/studyGroups/ShareToStudyGroupModal';
import ShareToCommunityModal from '../components/community/ShareToCommunityModal';
import { formatOrdinalRank } from '../utils/formatOrdinalRank';
import useHeaderSheen from '../hooks/useHeaderSheen';
import { useAuth } from '../hooks/useAuth';
import { useGamification } from '../hooks/useGamification';
import api, { resolveUploadUrl } from '../services/api';
import './learn/Learn.css';
import './PLS/PLS.css';
import ProgressLeaderboardDrawer from './ProgressLeaderboardDrawer';
import './Progress.css';
import { RANK_NAMES, RANK_COLORS, XP_THRESHOLDS } from '../data/rankConfig';
import { FEATURE_FLAGS } from '../config/featureFlags';

// ── constants ─────────────────────────────────────────────────────────────────
const RARITY_COLORS = {
  legendary: '#fab82c',
  epic: '#8b5cf6',
  rare: '#3b82f6',
  uncommon: '#10b981',
  common: '#94a3b8',
};

function xpForLevel(lvl) { return XP_THRESHOLDS[lvl - 1] ?? 0; }
function xpNextLevel(lvl) { return XP_THRESHOLDS[lvl] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1]; }

function levelProgress(xp, level) {
  const base = xpForLevel(level);
  const next = xpNextLevel(level);
  return next > base ? Math.min(100, Math.round(((xp - base) / (next - base)) * 100)) : 100;
}

function resolveBadgeRarity(badge) {
  const fromCriteria = badge?.criteria && typeof badge.criteria === 'object' ? badge.criteria.rarity : null;
  if (fromCriteria && RARITY_COLORS[fromCriteria]) return fromCriteria;
  if (badge?.rarity && RARITY_COLORS[badge.rarity]) return badge.rarity;
  return 'common';
}

function formatEarnedDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function parseBadgeCriteria(badge) {
  const raw = badge?.criteria;
  if (raw == null) return {};
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Display order on Progress: onboarding → streaks → levels → community → mastery → secrets. */
const BADGE_CATEGORY_ORDER = {
  first_lesson: 0,
  streak: 10,
  level: 20,
  first_contribution: 30,
  perfect_quizzes: 40,
  lessons_per_day: 50,
};

function badgeProgressionKey(badge) {
  const c = parseBadgeCriteria(badge);
  const type = typeof c?.type === 'string' ? c.type : '';
  const value = Number(c?.value);
  const tier = Number.isFinite(value) ? value : 0;
  const category = Object.prototype.hasOwnProperty.call(BADGE_CATEGORY_ORDER, type)
    ? BADGE_CATEGORY_ORDER[type]
    : 999;
  const name = String(badge?.name || '').toLowerCase();
  return [category, tier, name];
}

function compareBadgeProgression(a, b) {
  const ka = badgeProgressionKey(a);
  const kb = badgeProgressionKey(b);
  for (let i = 0; i < 3; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function humanizeRarity(key) {
  if (!key || typeof key !== 'string') return 'Common';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatHowToEarn(criteria) {
  const type = criteria?.type;
  const value = Number(criteria?.value);
  const n = Number.isFinite(value) ? value : null;
  switch (type) {
    case 'streak':
      return n != null
        ? `Maintain a consecutive daily learning streak: complete a qualifying learning activity every day until you reach ${n} days in a row. Missing a day resets the streak.`
        : 'Maintain a consecutive daily learning streak by learning at least once per day.';
    case 'level':
      return n != null
        ? `Reach the ${RANK_NAMES[n] || `rank ${n}`} rank by earning enough total XP across lessons, practice, and other activities that award XP.`
        : 'Reach the required rank through total XP earned.';
    case 'first_lesson':
      return 'Complete any course lesson on Learnda. Your first completed lesson unlocks this badge.';
    case 'first_contribution':
      return 'Submit resources or suggestions through the contribution flow and have one submission reviewed and approved by the team.';
    case 'perfect_quizzes':
      return n != null
        ? `Earn a perfect score on at least ${n} separate quizzes or practice checks (each completion must be flawless to count).`
        : 'Earn perfect scores on the required number of quizzes or practice checks.';
    case 'lessons_per_day':
      return n != null
        ? `Within a single calendar day, complete at least ${n} course lessons. Progress is counted when lessons are marked complete.`
        : 'Complete multiple lessons within one calendar day.';
    default:
      return 'Keep learning, practicing, and engaging on Learnda. This badge unlocks automatically when the tracked conditions are met.';
  }
}

function BadgeModalHero({ badge }) {
  const [iconFailed, setIconFailed] = useState(false);
  const rarityColor = RARITY_COLORS[resolveBadgeRarity(badge)] || RARITY_COLORS.common;
  const iconSrc = badge.icon_url ? resolveUploadUrl(badge.icon_url) : '';
  return (
    <div className="pg-badge-modal__hero" style={{ '--badge-color': rarityColor }}>
      <div className="pg-badge-modal__hero-ring" aria-hidden="true" />
      <div className="pg-badge-modal__hero-icon">
        {iconSrc && !iconFailed ? (
          <img
            src={iconSrc}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <FiAward aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function BadgeDetailModal({ detail, onClose, displayName }) {
  const badge = detail?.badge;
  const earned = detail?.earned;
  const earnedAt = detail?.earnedAt;
  const earnedDateStr = earnedAt ? formatEarnedDate(earnedAt) : '';

  if (!detail || !badge) return null;

  const criteria = parseBadgeCriteria(badge);
  const rarity = resolveBadgeRarity(badge);
  const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.common;
  const standFor = String(badge.description || '').trim()
    || 'This badge celebrates progress on your learning journey with Learnda.';
  const howTo = formatHowToEarn(criteria);
  const xpReward = Number(badge.xp_reward) || 0;

  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={badge.name || 'Badge'}
      modalClassName="pg-badge-detail-modal"
      modalStyle={{ borderTopColor: rarityColor }}
    >
      <div className="pg-badge-modal" style={{ '--badge-rarity': rarityColor }}>
        <BadgeModalHero badge={badge} />
        <div className="pg-badge-modal__pills">
          <span className="pg-badge-modal__pill pg-badge-modal__pill--rarity" style={{ '--pill-accent': rarityColor }}>
            {humanizeRarity(rarity)}
          </span>
          {earned ? (
            <span className="pg-badge-modal__pill pg-badge-modal__pill--earned">
              <FiCheck aria-hidden="true" />
              {earnedDateStr ? `Earned ${earnedDateStr}` : 'Earned'}
            </span>
          ) : (
            <span className="pg-badge-modal__pill pg-badge-modal__pill--locked">
              <FiLock aria-hidden="true" />
              Not earned yet
            </span>
          )}
        </div>

        {earned ? (
          <div className="pg-badge-modal__recipient">
            <span className="pg-badge-modal__recipient-label">Awarded to</span>
            <span className="pg-badge-modal__recipient-name">{displayName}</span>
          </div>
        ) : null}

        <section className="pg-badge-modal__block">
          <h3 className="pg-badge-modal__block-title">
            <FiAward aria-hidden="true" />
            What it stands for
          </h3>
          <p className="pg-badge-modal__copy">{standFor}</p>
        </section>
        <section className="pg-badge-modal__block">
          <h3 className="pg-badge-modal__block-title">
            <FiTarget aria-hidden="true" />
            How to earn it
          </h3>
          <p className="pg-badge-modal__copy">{howTo}</p>
        </section>
        {xpReward > 0 && (
          <p className="pg-badge-modal__xp">
            <FiZap aria-hidden="true" />
            <span>
              <strong>{xpReward.toLocaleString()} bonus XP</strong>
              {' '}
              when you unlock this badge.
            </span>
          </p>
        )}
      </div>
    </FormModal>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function XpLevelBar({
  xp,
  level,
  serverProgressPct,
  serverXpInCurrentLevel,
  serverXpForNextLevel,
}) {
  const band = Number(serverXpForNextLevel);
  const inBand = Number(serverXpInCurrentLevel);
  const srvPct = Number(serverProgressPct);
  const hasServerBand = Number.isFinite(band) && band > 0 && Number.isFinite(srvPct);
  const pct = hasServerBand
    ? Math.min(100, Math.max(0, Math.round(srvPct)))
    : levelProgress(xp, level);
  const color = RANK_COLORS[level] || '#6366f1';
  const name = RANK_NAMES[level] || 'Unknown';
  const remaining = hasServerBand
    ? Math.max(0, band - (Number.isFinite(inBand) ? inBand : 0))
    : Math.max(0, xpNextLevel(level) - xp);
  const atMaxLevel = level >= 10;

  return (
    <div className="pg-xp-card">
      <div className="pg-xp-card__level" style={{ '--lv-color': color }}>
        <span className="pg-xp-card__level-num">{name.charAt(0)}</span>
      </div>
      <div className="pg-xp-card__info">
        <div className="pg-xp-card__header">
          <div className="pg-xp-card__name-block">
            <span className="pg-xp-card__rank-label">Rank</span>
            <span className="pg-xp-card__name" style={{ color }}>{name}</span>
          </div>
          {!atMaxLevel && (
            <span className="pg-xp-card__next-lv">
              → {RANK_NAMES[level + 1]}
            </span>
          )}
        </div>
        <div
          className="pg-xp-card__bar-wrap"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Rank progress: ${pct}%`}
        >
          <div className="pg-xp-card__bar" style={{ '--pct': `${pct}%`, '--lv-color': color }} />
        </div>
        <div className="pg-xp-card__meta">
          <span>{xp.toLocaleString()} XP</span>
          {!atMaxLevel ? (
            <span>{remaining.toLocaleString()} XP to {RANK_NAMES[level + 1]}</span>
          ) : (
            <span>Max rank reached!</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tooltip, color, onActivate }) {
  const valueText = typeof value === 'number' ? value.toLocaleString() : value;
  const body = (
    <>
      <div className="pg-stat__icon" style={color ? { '--stat-color': color } : {}}>
        {icon}
      </div>
      <div className="pg-stat__body">
        <div className="pg-stat__value">{valueText}</div>
        <div className="pg-stat__label">{label}</div>
      </div>
    </>
  );
  if (onActivate) {
    return (
      <button
        type="button"
        className={`pg-stat pg-stat--actionable${tooltip ? ' pg-stat--tipped' : ''}`}
        title={tooltip || undefined}
        onClick={onActivate}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={`pg-stat${tooltip ? ' pg-stat--tipped' : ''}`} title={tooltip || undefined}>
      {body}
    </div>
  );
}

function StatGroup({ title, children }) {
  return (
    <div className="pg-stat-group">
      <h2 className="pg-stat-group__title">{title}</h2>
      <div className="pg-stats-grid">{children}</div>
    </div>
  );
}

function StreakBar({ streak }) {
  const milestones = [3, 7, 14, 21, 30, 60, 100];
  const next = milestones.find((m) => m > streak) ?? null;
  const pct = next ? Math.min(100, Math.round((streak / next) * 100)) : 100;

  return (
    <div className="pg-streak-bar">
      <div className="pg-streak-bar__left">
        <FiZap className="pg-streak-bar__icon" aria-hidden="true" />
        <span className="pg-streak-bar__count">{streak}</span>
        <span className="pg-streak-bar__label">day streak</span>
      </div>
      <div className="pg-streak-bar__right">
        {next !== null ? (
          <>
            <div className="pg-streak-bar__track">
              <div className="pg-streak-bar__fill" style={{ '--spct': `${pct}%` }} />
            </div>
            <span className="pg-streak-bar__next">{next - streak} days to {next}-day milestone</span>
          </>
        ) : (
          <span className="pg-streak-bar__next">All milestones reached!</span>
        )}
      </div>
    </div>
  );
}

function BadgeItem({ badge, earned, earnedAt, onOpenDetails }) {
  const [iconFailed, setIconFailed] = useState(false);
  const rarity = resolveBadgeRarity(badge);
  const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.common;
  const iconSrc = badge.icon_url ? resolveUploadUrl(badge.icon_url) : '';
  const label = badge.name || 'Badge';
  const earnedDateStr = earnedAt ? formatEarnedDate(earnedAt) : '';

  return (
    <button
      type="button"
      className={`pg-badge ${earned ? 'pg-badge--earned' : 'pg-badge--locked'}`}
      style={{ '--badge-rarity': rarityColor }}
      onClick={() => onOpenDetails({ badge, earned, earnedAt })}
      aria-haspopup="dialog"
      aria-label={
        earned
          ? `${label}, earned${earnedDateStr ? ` on ${earnedDateStr}` : ''}. Open for details.`
          : `${label}, not earned yet. Open for how to earn.`
      }
    >
      <span className="pg-badge__rarity-bar" aria-hidden="true" />
      <span className="pg-badge__shine" aria-hidden="true" />
      <div className="pg-badge__icon-wrap">
        {earned ? (
          <span className="pg-badge__earned-mark" aria-hidden="true">
            <FiCheck />
          </span>
        ) : (
          <span className="pg-badge__lock-mark" aria-hidden="true">
            <FiLock />
          </span>
        )}
        <div
          className="pg-badge__icon"
          style={earned ? { '--badge-color': rarityColor } : { '--badge-color': RARITY_COLORS.common }}
        >
          {iconSrc && !iconFailed ? (
            <img
              src={iconSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <FiAward aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="pg-badge__label">{label}</div>
      {earned && earnedDateStr ? (
        <div className="pg-badge__date">Earned {earnedDateStr}</div>
      ) : (
        <div className="pg-badge__locked-pill">Not earned</div>
      )}
      <span className="pg-badge__tap-hint">Details</span>
    </button>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Progress() {
  const { user } = useAuth();
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();
  const firstName = useMemo(() => {
    const raw = String(user?.full_name || user?.name || 'there').trim();
    if (!raw) return 'there';
    return raw.split(/\s+/)[0] || 'there';
  }, [user?.full_name, user?.name]);

  const badgeDisplayName = useMemo(() => {
    const raw = String(user?.full_name || user?.name || '').trim();
    return raw || 'Learner';
  }, [user?.full_name, user?.name]);

  const {
    xp,
    level,
    streak,
    badges,
    earnedBadges,
    loading: gamLoading,
    leaderboard,
    leaderboardRank,
    refreshProgress,
    refreshBadges,
    refreshLeaderboard,
  } = useGamification();

  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeDetail, setBadgeDetail] = useState(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [spotlightWins, setSpotlightWins] = useState([]);
  const [pgConfettiActive, setPgConfettiActive] = useState(false);
  const pgConfettiShownRef = useRef(false);

  // Achievement share state
  const [achShareAward, setAchShareAward] = useState(null);
  const [achSgOpen, setAchSgOpen] = useState(false);
  const [achCmOpen, setAchCmOpen] = useState(false);
  const [achCopied, setAchCopied] = useState(false);

  const achSharePayload = useMemo(() => {
    if (!achShareAward) return null;
    const isStudent = achShareAward.award_type === 'student';
    const rankText = achShareAward.rank_of > 0
      ? `1st of ${Number(achShareAward.rank_of).toLocaleString()} ${isStudent ? 'students' : 'contributors'}`
      : 'Spotlight winner';
    return {
      kind: 'achievement',
      title: isStudent ? 'Student of the Week' : 'Contributor of the Month',
      subtitle: rankText,
      url: typeof window !== 'undefined' ? `${window.location.origin}/home` : '/home',
    };
  }, [achShareAward]);

  const handleAchSocialShare = async (award, platform) => {
    const isStudent = award.award_type === 'student';
    const rank = award.rank_of > 0
      ? `1st of ${Number(award.rank_of).toLocaleString()} ${isStudent ? 'students' : 'contributors'}`
      : 'top';
    const text = isStudent
      ? `I just won Student of the Week on Learnda! 🏆 ${rank} this week. Let's celebrate together.`
      : `I'm Contributor of the Month on Learnda! ⭐ ${rank} this month. Let's celebrate together.`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/home` : '/home';
    const full = `${text}\n${url}`;

    if (platform === 'native') {
      try { await navigator.share({ title: isStudent ? 'Student of the Week' : 'Contributor of the Month', text, url }); } catch { /* cancelled */ }
    } else if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(full);
        setAchCopied(true);
        setTimeout(() => setAchCopied(false), 2000);
      } catch { /* ignore */ }
    } else {
      const links = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(full)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      };
      if (links[platform]) window.open(links[platform], '_blank', 'noopener,noreferrer');
    }
  };

  const openLeaderboard = () => setLeaderboardOpen(true);
  const closeLeaderboard = () => setLeaderboardOpen(false);

  useEffect(() => {
    refreshProgress();
    refreshBadges();
    refreshLeaderboard('global', 'weekly');
  }, [refreshProgress, refreshBadges, refreshLeaderboard]);

  useEffect(() => {
    let cancelled = false;
    let confettiTimer = null;
    Promise.all([
      api.gamification.getProgress().catch(() => null),
      api.gamification.getOverview().catch(() => null),
      api.gamification.getSpotlights().catch(() => null),
    ]).then(([prog, ov, spots]) => {
      if (cancelled) return;
      if (prog?.success) setStats(prog);
      if (ov?.success) setOverview(ov);
      if (spots?.success && user?.id) {
        const wins = [];
        if (spots.student?.user_id && String(spots.student.user_id) === String(user.id)) wins.push(spots.student);
        if (spots.contributor?.user_id && String(spots.contributor.user_id) === String(user.id)) wins.push(spots.contributor);
        setSpotlightWins(wins);
        if (wins.length > 0 && !pgConfettiShownRef.current) {
          pgConfettiShownRef.current = true;
          confettiTimer = window.setTimeout(() => { if (!cancelled) setPgConfettiActive(true); }, 600);
        }
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (confettiTimer) window.clearTimeout(confettiTimer); };
  }, [user?.id]);

  const earnedMap = useMemo(() => {
    const map = {};
    earnedBadges.forEach((eb) => {
      const id = eb.badge_id != null ? String(eb.badge_id) : '';
      if (id) map[id] = eb.earned_at;
    });
    return map;
  }, [earnedBadges]);

  const progressBadges = useMemo(() => (Array.isArray(badges) ? badges : []), [badges]);

  const earnedBadgeCount = useMemo(
    () => progressBadges.filter((b) => earnedMap[String(b.id)] != null).length,
    [progressBadges, earnedMap],
  );

  const sortedBadges = useMemo(
    () => [...progressBadges].sort(compareBadgeProgression),
    [progressBadges],
  );

  const progressSnapshot = stats?.success ? stats : null;
  const displayXp = progressSnapshot != null
    ? (Number(progressSnapshot.xp ?? progressSnapshot.currentXP ?? 0) || 0)
    : xp;
  const displayLevel = progressSnapshot != null
    ? (Number(progressSnapshot.level ?? 1) || 1)
    : level;
  const displayStreak = progressSnapshot != null
    ? (Number(progressSnapshot.streak ?? 0) || 0)
    : streak;

  const levelProgressPct = Number(
    progressSnapshot?.progress_percentage ?? progressSnapshot?.progressPercentage ?? 0,
  ) || 0;
  const xpInCurrentLevel = Number(progressSnapshot?.xp_in_current_level ?? 0) || 0;
  const xpForNextLevel = Number(progressSnapshot?.xp_for_next_level ?? 0) || 0;
  const nextLevelThresholdXp = Number(progressSnapshot?.next_level_xp ?? 0) || 0;

  const totalLessons = stats?.total_lessons_completed ?? 0;
  const totalQuizzes = stats?.total_quizzes_completed ?? 0;
  const totalContributions = stats?.total_contributions ?? 0;
  const groupsJoined = overview?.groups_joined ?? 0;
  const networkActivenessScore = overview?.network_activeness_score ?? 0;
  const communityPosts = overview?.community_posts ?? 0;
  const communityReplies = overview?.community_replies ?? 0;
  const communityScore = overview?.community_engagement_score ?? 0;
  const filesViewed = overview?.files_viewed ?? 0;
  const filesDownloaded = overview?.files_downloaded ?? 0;
  const edutArticles = overview?.edutainment_articles ?? 0;
  const edutStories = overview?.edutainment_stories ?? 0;
  const edutFacts = overview?.edutainment_facts ?? 0;
  const edutQuotes = overview?.edutainment_quotes ?? 0;
  const edutJoculars = overview?.edutainment_joculars ?? 0;

  const rankLabel = formatOrdinalRank(leaderboardRank);
  const rankSub = leaderboardRank != null
    ? 'Your position among all learners ranked by total XP (same order as the leaderboard).'
    : 'Earn XP from lessons and practice to appear on the leaderboard.';

  const levelRowReady = progressSnapshot != null || !gamLoading;
  const streakRowReady = progressSnapshot != null || !gamLoading;

  return (
    <div className={`learn-redesign pls-page pg-page ${headerSheenReady ? 'page-header-sheen-ready' : ''}`}>
      <ConfettiOverlay active={pgConfettiActive} mode="fireworks" onDone={() => setPgConfettiActive(false)} />
      <div className={`pg-progress-layout ${leaderboardOpen ? 'pg-progress-layout--open' : ''}`}>
        <div className="pg-progress-main">
          <section className="pls-dashboard-header pg-dashboard-header">
            <div className="pls-dashboard-header-main">
              <div className="pg-dashboard-header-title-row">
                <h1 className="header-sheen-copy" key={`pg-header-title-${headerSheenCycle}`}>My Progress</h1>
                <button
                  type="button"
                  className={`pg-lb-header-toggle pg-lb-header-toggle--in-title${leaderboardOpen ? ' pg-lb-header-toggle--open' : ''}`}
                  onClick={() => setLeaderboardOpen((o) => !o)}
                  aria-expanded={leaderboardOpen}
                  aria-controls="pg-leaderboard-drawer"
                  title={leaderboardOpen ? 'Close leaderboard' : 'Open leaderboard'}
                >
                  <FiChevronLeft aria-hidden />
                  <span className="visually-hidden">
                    {leaderboardOpen ? 'Close leaderboard' : 'Open leaderboard'}
                  </span>
                </button>
              </div>
              <p className="pls-dashboard-tagline header-sheen-copy" key={`pg-header-tagline-${headerSheenCycle}`}>
                Your stats, streak, and badges in one place.
              </p>
            </div>
            <div className="pls-dashboard-header-meta">
              <div className="pls-meta-row pls-meta-inline pg-dashboard-header-meta-row">
                <span
                  className="pls-meta-pill header-sheen-copy"
                  key={`pg-pill-level-${headerSheenCycle}`}
                  style={{ '--pill-accent': RANK_COLORS[displayLevel] || '#6366f1' }}
                >
                  <span className="pg-pill-rank-prefix">Rank</span>{RANK_NAMES[displayLevel] || 'Newcomer'}
                </span>
                <span className="pls-meta-pill header-sheen-copy" key={`pg-pill-xp-${headerSheenCycle}`}>
                  {displayXp.toLocaleString()} XP
                </span>
                <span className="pls-meta-pill header-sheen-copy" key={`pg-pill-streak-${headerSheenCycle}`}>
                  <FiZap aria-hidden="true" style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  {displayStreak} day{displayStreak === 1 ? '' : 's'} streak
                </span>
                <button
                  type="button"
                  className="pls-meta-pill header-sheen-copy pg-lb-rank-pill"
                  key={`pg-pill-rank-${headerSheenCycle}`}
                  onClick={openLeaderboard}
                  title={rankSub}
                >
                  <FiTrendingUp className="pg-lb-rank-pill__icon" aria-hidden />
                  <span aria-hidden>{rankLabel}</span>
                  <span className="visually-hidden">Leaderboard rank {rankLabel}</span>
                </button>
                <button
                  type="button"
                  className={`pg-lb-header-toggle pg-lb-header-toggle--in-meta${leaderboardOpen ? ' pg-lb-header-toggle--open' : ''}`}
                  onClick={() => setLeaderboardOpen((o) => !o)}
                  aria-expanded={leaderboardOpen}
                  aria-controls="pg-leaderboard-drawer"
                  title={leaderboardOpen ? 'Close leaderboard' : 'Open leaderboard'}
                >
                  <FiChevronLeft aria-hidden />
                  <span className="visually-hidden">
                    {leaderboardOpen ? 'Close leaderboard' : 'Open leaderboard'}
                  </span>
                </button>
              </div>
            </div>
          </section>

      <section className="pg-section pg-level-streak-section" aria-label="Rank and streak">
        <div className="pg-level-streak-row">
          <div className="pg-level-streak-row__cell">
            {!levelRowReady ? (
              <div className="pg-shimmer pg-shimmer--bar" />
            ) : (
              <XpLevelBar
                xp={displayXp}
                level={displayLevel}
                serverProgressPct={progressSnapshot?.progress_percentage ?? progressSnapshot?.progressPercentage}
                serverXpInCurrentLevel={progressSnapshot?.xp_in_current_level}
                serverXpForNextLevel={progressSnapshot?.xp_for_next_level}
              />
            )}
          </div>
          <div className="pg-level-streak-row__cell">
            {!streakRowReady ? (
              <div className="pg-shimmer pg-shimmer--bar" />
            ) : (
              <StreakBar streak={displayStreak} />
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="pg-stats-grid pg-section">
          {[1, 2, 3, 4].map((i) => <div key={i} className="pg-shimmer pg-shimmer--stat" />)}
        </div>
      ) : (
        <StatGroup title="Standing &amp; rank">
          <StatCard
            icon={<FiTrendingUp />}
            label="Leaderboard rank"
            value={rankLabel}
            tooltip={rankSub}
            color="#6366f1"
            onActivate={openLeaderboard}
          />
          <StatCard
            icon={<FiTarget />}
            label="Rank progress"
            value={`${Math.round(levelProgressPct)}%`}
            tooltip="How far you are through the current rank band (from your saved XP on the server)."
            color="#0891b2"
          />
          <StatCard
            icon={<FiBarChart2 />}
            label="XP this rank"
            value={xpInCurrentLevel}
            tooltip={
              xpForNextLevel > 0
                ? `XP earned within this rank so far. This rank spans ${xpForNextLevel.toLocaleString()} XP total.`
                : undefined
            }
            color="#d97706"
          />
          <StatCard
            icon={<FiAward />}
            label="Badges earned"
            value={`${earnedBadgeCount} / ${progressBadges.length || '—'}`}
            tooltip="Badges you have unlocked out of every achievement on Learnda, including Speed Learner."
            color="#8b5cf6"
          />
        </StatGroup>
      )}

      {/* Learning activity */}
      {loading ? (
        <div className="pg-stats-grid pg-section">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="pg-shimmer pg-shimmer--stat" />)}
        </div>
      ) : (
        <StatGroup title="Learning Activity">
          <StatCard
            icon={<FiFlag />}
            label="Next rank at"
            value={nextLevelThresholdXp > 0 ? nextLevelThresholdXp.toLocaleString() : '—'}
            tooltip="Total cumulative XP required to reach the next rank."
            color="#6366f1"
          />
          <StatCard
            icon={<FiBookOpen />}
            label="Lessons Completed"
            value={totalLessons}
            color="#0891b2"
            tooltip="Distinct text or video lessons you have marked complete (from your completion history)."
          />
          <StatCard
            icon={<FiClipboard />}
            label="Practice Quizzes"
            value={totalQuizzes}
            color="#0d9488"
            tooltip="Distinct quizzes and past-paper items you have marked complete (from your completion history)."
          />
          <StatCard
            icon={<FiEye />}
            label="Files Viewed"
            value={filesViewed}
            color="#7c3aed"
            tooltip="Content views (lessons, materials, etc.) plus resource library file previews you opened while signed in."
          />
          <StatCard
            icon={<FiDownload />}
            label="Files Downloaded"
            value={filesDownloaded}
            color="#fab82c"
            tooltip="Content saves or bookmarks plus completed resource downloads tracked from your account."
          />
          <StatCard
            icon={<FiShare2 />}
            label="Contributions"
            value={totalContributions}
            tooltip="Approved contributions you uploaded (from your contributor record and progress)."
            color="#5b8439"
          />
        </StatGroup>
      )}

      {/* Edutainment */}
      {loading ? (
        <div className="pg-stats-grid pg-section">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="pg-shimmer pg-shimmer--stat" />)}
        </div>
      ) : (
        <StatGroup title="Edutainment">
          <StatCard icon={<FiBookOpen />} label="Articles" value={edutArticles} color="#4f46e5" />
          <StatCard icon={<FiFeather />} label="Stories" value={edutStories} color="#7c3aed" />
          <StatCard icon={<FiInfo />} label="Did You Know" value={edutFacts} color="#0891b2" />
          <StatCard icon={<FiMessageSquare />} label="Quotes" value={edutQuotes} color="#d97706" />
          <StatCard icon={<FiSmile />} label="Joculars" value={edutJoculars} color="#5b8439" />
        </StatGroup>
      )}

      {/* Study groups */}
      {FEATURE_FLAGS.studyGroups && (loading ? (
        <div className="pg-stats-grid pg-section">
          {[1, 2].map((i) => <div key={i} className="pg-shimmer pg-shimmer--stat" />)}
        </div>
      ) : (
        <StatGroup title="Study Groups">
          <StatCard icon={<FiUsers />} label="Groups Joined" value={groupsJoined} color="#8b5cf6" />
          <StatCard
            icon={<FiActivity />}
            label="Activeness score"
            value={networkActivenessScore}
            color="#0d9488"
            tooltip="Combines active group memberships and study-group messages you have posted (5 points per group, 1 per message)."
          />
        </StatGroup>
      ))}

      {/* Community engagement */}
      {FEATURE_FLAGS.community && (loading ? (
        <div className="pg-stats-grid pg-section">
          {[1, 2, 3].map((i) => <div key={i} className="pg-shimmer pg-shimmer--stat" />)}
        </div>
      ) : (
        <StatGroup title="Community Engagement">
          <StatCard icon={<FiMessageSquare />} label="Posts" value={communityPosts} color="#fab82c" />
          <StatCard icon={<FiMessageSquare />} label="Replies" value={communityReplies} color="#f97316" />
          <StatCard icon={<FiTrendingUp />} label="Engagement Score" value={communityScore} color="#fb6334" />
        </StatGroup>
      ))}

      {/* Badges */}
      <section className="pg-section" aria-label="Badges">
        <div className="pg-section-title">
          <h2>Badges</h2>
          <span className="pg-badge-count">
            {earnedBadgeCount} / {progressBadges.length} earned
          </span>
        </div>

        {gamLoading && progressBadges.length === 0 ? (
          <div className="pg-badge-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="pg-shimmer pg-shimmer--badge" />
            ))}
          </div>
        ) : progressBadges.length === 0 ? (
          <div className="pg-empty">
            <FiAward className="pg-empty__icon" />
            <p>No badges available yet. Keep learning to unlock them!</p>
          </div>
        ) : (
          <div className="pg-badge-grid">
            {sortedBadges.map((badge) => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                earned={earnedMap[String(badge.id)] != null}
                earnedAt={earnedMap[String(badge.id)]}
                onOpenDetails={setBadgeDetail}
              />
            ))}
          </div>
        )}
      </section>

      {/* Spotlight Achievements — shown only to the current winner */}
      {spotlightWins.length > 0 ? (
        <section className="pg-section pg-achievement-section" aria-label="Achievements">
          <div className="pg-section-title">
            <h2>Achievements</h2>
          </div>
          <div className="pg-achievement-list">
            {spotlightWins.map((award) => {
              const isStudent = award.award_type === 'student';
              return (
                <div key={award.award_id} className={`pg-achievement-card pg-achievement-card--${award.award_type}`}>
                  {/* Decorative background layers */}
                  <div className="pg-achievement-card__bg" aria-hidden="true" />
                  <div className="pg-achievement-card__shimmer" aria-hidden="true" />
                  <div className="pg-achievement-card__stars" aria-hidden="true">
                    <span className="pg-achievement-star">★</span>
                    <span className="pg-achievement-star">✦</span>
                    <span className="pg-achievement-star">★</span>
                    <span className="pg-achievement-star">✦</span>
                    <span className="pg-achievement-star">★</span>
                    <span className="pg-achievement-star">✦</span>
                  </div>

                  {/* Top ribbon */}
                  <div className="pg-achievement-card__ribbon" aria-hidden="true">
                    <span className="pg-achievement-card__ribbon-star">★</span>
                    <span className="pg-achievement-card__ribbon-text">{award.badge_label}</span>
                    <span className="pg-achievement-card__ribbon-star">★</span>
                  </div>

                  {/* Main content row */}
                  <div className="pg-achievement-card__inner">
                    {/* Medallion */}
                    <div className="pg-achievement-card__medallion">
                      <div className="pg-achievement-card__medallion-ring" />
                      <div className="pg-achievement-card__medallion-icon" role="img" aria-label={isStudent ? 'Trophy' : 'Star'}>
                        {isStudent ? '🏆' : '⭐'}
                      </div>
                    </div>

                    {/* Text body */}
                    <div className="pg-achievement-card__body">
                      <p className="pg-achievement-card__crown">🎉 Congratulations — you won!</p>
                      <h3 className="pg-achievement-card__title">
                        {isStudent ? 'Student of the Week' : 'Contributor of the Month'}
                      </h3>
                      <p className="pg-achievement-card__desc">
                        {isStudent
                          ? 'You finished 1st on the weekly XP leaderboard.'
                          : 'You led contributor impact this month.'}
                      </p>
                      {award.rank_of > 0 ? (
                        <p className="pg-achievement-card__rank">
                          1st of {Number(award.rank_of).toLocaleString()} {isStudent ? 'students' : 'contributors'}
                        </p>
                      ) : null}

                      {/* Stats row */}
                      <div className="pg-achievement-card__stats">
                        {award.achievement_label ? (
                          <div className="pg-achievement-card__score-wrap">
                            <span className="pg-achievement-card__score-value">{award.achievement_label}</span>
                            <span className="pg-achievement-card__score-label">
                              {isStudent ? 'weekly XP' : 'contributor score'}
                            </span>
                          </div>
                        ) : null}
                        <span className="pg-achievement-card__period">
                          {isStudent ? 'This Week' : 'This Month'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Share sheet */}
                  {achShareAward?.award_id === award.award_id ? (
                    <div className="pg-achievement-card__share-sheet">
                      <div className="pg-achievement-card__share-header">
                        <span>Share your achievement</span>
                        <button
                          type="button"
                          className="pg-achievement-card__share-close"
                          onClick={() => setAchShareAward(null)}
                          aria-label="Close share panel"
                        >
                          <FiX />
                        </button>
                      </div>
                      <div className="pg-achievement-card__share-targets">
                        {FEATURE_FLAGS.studyGroups && (
                          <button
                            type="button"
                            className="pg-achievement-card__share-target"
                            onClick={() => { setAchSgOpen(true); setAchShareAward(null); }}
                          >
                            <FiUsers aria-hidden />
                            <span>Study Group</span>
                          </button>
                        )}
                        {FEATURE_FLAGS.community && (
                          <button
                            type="button"
                            className="pg-achievement-card__share-target"
                            onClick={() => { setAchCmOpen(true); setAchShareAward(null); }}
                          >
                            <FiGlobe aria-hidden />
                            <span>Community</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="pg-achievement-card__share-target pg-achievement-card__share-target--wa"
                          onClick={() => handleAchSocialShare(award, 'whatsapp')}
                        >
                          <FaWhatsapp aria-hidden />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          className="pg-achievement-card__share-target pg-achievement-card__share-target--x"
                          onClick={() => handleAchSocialShare(award, 'twitter')}
                        >
                          <FaXTwitter aria-hidden />
                          <span>X</span>
                        </button>
                        <button
                          type="button"
                          className="pg-achievement-card__share-target pg-achievement-card__share-target--tg"
                          onClick={() => handleAchSocialShare(award, 'telegram')}
                        >
                          <FaTelegram aria-hidden />
                          <span>Telegram</span>
                        </button>
                        {typeof navigator !== 'undefined' && navigator.share ? (
                          <button
                            type="button"
                            className="pg-achievement-card__share-target"
                            onClick={() => handleAchSocialShare(award, 'native')}
                          >
                            <FiShare2 aria-hidden />
                            <span>Share</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="pg-achievement-card__share-target"
                          onClick={() => handleAchSocialShare(award, 'copy')}
                        >
                          {achCopied ? <FiCheck aria-hidden /> : <FiClipboard aria-hidden />}
                          <span>{achCopied ? 'Copied!' : 'Copy link'}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Share trigger button */}
                  <button
                    type="button"
                    className="pg-achievement-card__share-btn"
                    onClick={() => setAchShareAward(achShareAward?.award_id === award.award_id ? null : award)}
                    aria-expanded={achShareAward?.award_id === award.award_id}
                    aria-label="Share this achievement"
                  >
                    <FiShare2 aria-hidden />
                    Share your achievement
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

          <section className="pg-contribution-appeal-section" aria-label="Support Learnda">
            <ContributionAppeal showPlansCta />
          </section>

        </div>

        {leaderboardOpen ? (
          <button
            type="button"
            className="pg-lb-backdrop"
            aria-label="Close leaderboard"
            onClick={closeLeaderboard}
          />
        ) : null}

        <div className="pg-lb-drawer-wrap">
          <aside
            id="pg-leaderboard-drawer"
            className="pg-lb-drawer"
            aria-hidden={!leaderboardOpen}
          >
            <ProgressLeaderboardDrawer
              open={leaderboardOpen}
              onClose={closeLeaderboard}
              leaderboard={Array.isArray(leaderboard) ? leaderboard : []}
              leaderboardRank={leaderboardRank}
              userId={user?.id}
              loadingInitial={gamLoading && (!Array.isArray(leaderboard) || leaderboard.length === 0)}
              refreshLeaderboard={refreshLeaderboard}
            />
          </aside>
        </div>
      </div>

      <BadgeDetailModal
        detail={badgeDetail}
        displayName={badgeDisplayName}
        onClose={() => setBadgeDetail(null)}
      />

      <ShareToStudyGroupModal
        open={achSgOpen}
        onClose={() => setAchSgOpen(false)}
        sharePayload={achSharePayload}
      />
      <ShareToCommunityModal
        open={achCmOpen}
        onClose={() => setAchCmOpen(false)}
        sharePayload={achSharePayload}
      />
    </div>
  );
}
