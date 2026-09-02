import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";
import { useAnalytics } from "../../hooks/useAnalytics";
import { usePLS } from "../../hooks/usePLS";
import { useGamification } from "../../hooks/useGamification";
import useHorizontalAutoScroll from "../../hooks/useHorizontalAutoScroll";
import api, { resolveUploadUrl } from "../../services/api";
import {
  FiArrowRight,
  FiAward,
  FiBookOpen,
  FiClipboard,
  FiDownload,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiHardDrive,
  FiMessageCircle,
  FiPlayCircle,
  FiShare2,
  FiSmile,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiThumbsUp,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  FaFacebookF,
  FaInstagram,
  FaQuestion,
  FaQuoteLeft,
  FaTelegram,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import "./Home.css";
import "../SharedPages.css";
import "../PLS/PLS.css";
import AuthenticatedHomeView from "./AuthenticatedHomeView";
import MomentsViewer from "./MomentsViewer";
import ConfettiOverlay from "../../components/gamification/ConfettiOverlay";
import { getPlanTierClass, isPaidPlan } from "../../utils/planTheme";
import ContributionAppeal from "../../components/subscription/ContributionAppeal";
import { lockBodyScroll } from "../../utils/bodyScrollLock";
import {
  LOGO_SRC,
  DAILY_TAKEN_STORAGE_PREFIX,
  WEEKLY_TAKEN_STORAGE_PREFIX,
  STUDY_OPENED_STORAGE_PREFIX,
  SPOTLIGHT_OPENED_STORAGE_PREFIX,
  EDUTAINMENT_DAILY_TYPES,
  HOME_TRENDING_TAGS,
  HOME_TRENDING_COURSE_FALLBACK_IMAGES,
  HOME_TRENDING_FILE_PREVIEW_DOWNLOAD_COUNTS,
  HOME_TRENDING_FILE_PREVIEW_VIEW_COUNTS,
  HOME_TRENDING_FILE_PREVIEW_SIZES,
  MODAL_REACTION_BURSTS,
  MODAL_REACTION_TONES,
  toTitleCase,
  normalizeType,
  DAILY_GREETINGS,
  DAILY_WELCOME_LINES,
  GREETINGS_BY_PERIOD,
  getLocalDateKey,
  getLocalWeekKey,
  getDailyHeaderMessage,
  getFirstSentence,
  toDisplayNameCase,
  clampPercent,
  getNumberOrFallback,
  PROGRESS_COLOR_STOPS,
  getProgressFillGradient,
  getRecentStudyGroups,
  getCourseRecommendation,
  RECOMMENDED_GROUP_POOL,
  getRecommendedStudyGroups,
  normalizeCategoryText,
  getContentImage,
  getContentBody,
  getContentPreview,
  getContentAuthor,
  getContentUploader,
  getHighlightStateKey,
  getReactionCountsFromItem,
  normalizeHomeTrendingText,
  getHomeTrendingCourseTitle,
  getHomeTrendingCourseCode,
  getHomeTrendingCourseCreditsText,
  getHomeTrendingCourseImage,
  buildHomeTrendingCourseCardModel,
  buildHomeTrendingFileCardModel,
  resolveHomeTrendingEdutCategory,
  formatCommentDate,
} from './homeUtils';
import { buildCoursePath, buildCourseRouteState, buildPracticePath } from '../../utils/courseRouting';
import { toDisplayName } from '../../utils/contributionPlans';
import { getSamplePracticeItemsForCourse } from '../../utils/samplePracticePapers';
import { buildPracticeSessionPath } from '../../utils/practiceSession';
import { LEARNDA_SOCIAL_GROUPS } from '../../utils/learndaSocials';
import { saveBlobAsFile, withDownloadLock } from '../../utils/downloadManager';
import { APP_EVENTS, APP_STATE_SCOPES } from '../../utils/appEvents';

const HOME_RECOMMENDED_PRACTICE_FALLBACKS = {
  quiz: `${import.meta.env.BASE_URL}learning-2.jpg`,
  exam: `${import.meta.env.BASE_URL}test-2.jpg`,
};

const normalizeHomePracticeText = (value = '') =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getHomePracticeItems = (response) => {
  const items = response?.content || response?.data?.content || response?.data || [];
  return Array.isArray(items) ? items : [];
};

const getHomePracticeThumbnail = (item = {}, type = 'quiz') =>
  item.thumbnail ||
  item.thumbnail_url ||
  item.image ||
  item.image_url ||
  item.cover_image ||
  item.coverImage ||
  HOME_RECOMMENDED_PRACTICE_FALLBACKS[type] ||
  HOME_RECOMMENDED_PRACTICE_FALLBACKS.quiz;

const mapHomeRecommendedPracticeItem = (item = {}, type = 'quiz', courseTitle = '') => {
  const id = item.id || item.content_id || item.uuid || item.slug;
  const fallbackPath = type === 'exam' ? '/resources/past-exams' : '/resources/past-quizzes';
  const thumbnail = getHomePracticeThumbnail(item, type);

  return {
    ...item,
    id,
    recommendationType: type,
    title: item.title || (type === 'exam' ? 'Past Exam' : 'Practice Quiz'),
    course: item.course || item.course_name || item.subject || courseTitle || '',
    thumbnail,
    image: thumbnail,
    imageFallback: HOME_RECOMMENDED_PRACTICE_FALLBACKS[type],
    destination: item.destination || (id ? buildPracticeSessionPath(id) : fallbackPath),
  };
};

const dedupeHomePracticeItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeHomePracticeText(item?.id || item?.title || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const matchesHomePracticeCourse = (item = {}, courseTitle = '') => {
  const target = normalizeHomePracticeText(courseTitle);
  if (!target) return false;
  const source = normalizeHomePracticeText(
    [item.course, item.course_name, item.subject, item.title, item.description].filter(Boolean).join(' ')
  );
  if (!source) return false;
  return source.includes(target) || target.includes(source);
};

const SOCIAL_PROMPT_SESSION_KEY = 'learnda_social_prompt_seen_session_v1';
const SOCIAL_PROMPT_STORAGE_PREFIX = 'learnda_social_prompt_v1';
const SPOTLIGHT_PROMPT_STORAGE_PREFIX = 'learnda_spotlight_prompt_seen_v1';
const SPOTLIGHT_SESSION_KEY = 'learnda_spotlight_prompt_session_v1';

const SOCIAL_PROMPT_ICONS = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  telegram: FaTelegram,
  tiktok: FaTiktok,
  whatsapp: FaWhatsapp,
  x: FaXTwitter,
  youtube: FaYoutube,
};

const getSocialPromptUserKey = (user) => {
  const userId = user?.id || user?.user_id || user?.email || user?.phone || 'member';
  return `${SOCIAL_PROMPT_STORAGE_PREFIX}:${userId}`;
};

const readSocialPromptState = (key) => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeSocialPromptState = (key, patch) => {
  if (typeof window === 'undefined') return;
  try {
    const previous = readSocialPromptState(key);
    window.localStorage.setItem(key, JSON.stringify({ ...previous, ...patch }));
  } catch {
    // Ignore storage failures.
  }
};

const getSpotlightPromptUserKey = (user) => {
  const userId = user?.id || user?.user_id || user?.email || user?.phone || 'member';
  return `${SPOTLIGHT_PROMPT_STORAGE_PREFIX}:${userId}`;
};

const readSpotlightPromptState = (user) => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getSpotlightPromptUserKey(user));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeSpotlightPromptSeen = (user, awardId) => {
  if (typeof window === 'undefined' || !awardId) return;
  try {
    const key = getSpotlightPromptUserKey(user);
    const previous = readSpotlightPromptState(user);
    window.localStorage.setItem(key, JSON.stringify({
      ...previous,
      [awardId]: Date.now(),
    }));
  } catch {
    // Ignore storage failures.
  }
};

function LearndaSocialPrompt({ isOpen, onClose, onEngage, onViewAll }) {
  if (!isOpen) return null;

  return (
    <div className="learnda-social-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="learnda-social-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learnda-social-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="learnda-social-modal-close"
          onClick={onClose}
          aria-label="Close social media prompt"
        >
          <FiX />
        </button>

        <div className="learnda-social-modal-hero">
          <span className="learnda-social-modal-kicker">Stay connected</span>
          <h2 id="learnda-social-title">Follow Learnda where each channel fits best.</h2>
          <p>
            Pick the right place for handles, messages and updates, videos, photos, and cute community moments.
          </p>
        </div>

        <div className="learnda-social-modal-groups">
          {LEARNDA_SOCIAL_GROUPS.map((group) => (
            <section key={group.group} className="learnda-social-modal-group">
              <div className="learnda-social-modal-group-header">
                <h3>{group.group}</h3>
                {group.desc ? <p>{group.desc}</p> : null}
              </div>
              <div className="learnda-social-modal-grid">
                {group.channels.map((channel) => {
                  const Icon = SOCIAL_PROMPT_ICONS[channel.iconKey] || FiShare2;
                  return (
                    <article
                      key={`${group.group}-${channel.name}`}
                      className="learnda-social-modal-card"
                      style={{
                        '--social-color': channel.color,
                        '--social-bg': channel.bg,
                        '--social-border': channel.border,
                      }}
                    >
                      <div className="learnda-social-modal-card-main">
                        <span className="learnda-social-modal-icon" aria-hidden="true">
                          <Icon />
                        </span>
                        <div>
                          <strong>{channel.name}</strong>
                          <span>{channel.handle}</span>
                        </div>
                      </div>
                      <p>{channel.purpose}</p>
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="learnda-social-modal-cta"
                        onClick={() => onEngage?.({ ...channel, group: group.group })}
                      >
                        {channel.cta}
                        <FiArrowRight aria-hidden="true" />
                      </a>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="learnda-social-modal-actions">
          <button type="button" className="learnda-social-modal-secondary" onClick={onClose}>
            Maybe later
          </button>
          <button type="button" className="learnda-social-modal-primary" onClick={onViewAll}>
            View all socials
          </button>
        </div>
      </section>
    </div>
  );
}

function SpotlightPromptModal({ spotlight, onClose, onCelebrate, onShare }) {
  const [confettiActive, setConfettiActive] = useState(false);

  if (!spotlight) return null;

  const Icon = spotlight.awardType === 'contributor' ? FiStar : FiAward;
  const count = Math.max(0, Number(spotlight.celebrationCount || 0));
  const celebrated = Boolean(spotlight.hasCelebrated);
  const actionLabel = celebrated
    ? (spotlight.awardType === 'contributor' ? 'Congratulated!' : 'Celebrated!')
    : (spotlight.awardType === 'contributor' ? 'Congratulate' : 'Celebrate');

  const handleCelebrate = () => {
    if (celebrated) return;
    setConfettiActive(true);
    onCelebrate(spotlight.awardType);
  };

  return (
    <div className="spotlight-modal-backdrop" role="presentation" onClick={onClose}>
      <ConfettiOverlay active={confettiActive} mode="fireworks" onDone={() => setConfettiActive(false)} />
      <section
        className={`spotlight-modal is-${spotlight.awardType || 'student'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="spotlight-modal-close" onClick={onClose} aria-label="Close spotlight">
          <FiX />
        </button>
        <div className="spotlight-modal-header">
          <span className="spotlight-modal-icon"><Icon /></span>
          <div>
            <span className="spotlight-modal-kicker">{spotlight.badgeLabel}</span>
            <h2 id="spotlight-modal-title">{spotlight.title}</h2>
          </div>
          <strong className="spotlight-modal-score">{spotlight.achievementLabel}</strong>
        </div>
        <div className="spotlight-modal-person">
          <img src={spotlight.image} alt={spotlight.name} loading="lazy" decoding="async" />
          <div>
            <strong>{spotlight.name}</strong>
            <span>{spotlight.college}</span>
            <span>{spotlight.program}</span>
            <span>{spotlight.level}</span>
          </div>
        </div>
        <p className="spotlight-modal-body">{spotlight.body}</p>
        <div className="spotlight-modal-actions">
          <button
            type="button"
            className={`spotlight-modal-primary${celebrated ? ' is-celebrated' : ''}`}
            onClick={handleCelebrate}
            disabled={celebrated}
            aria-pressed={celebrated}
          >
            <Icon /> {actionLabel} <span>{count.toLocaleString()}</span>
          </button>
          <a
            className="spotlight-modal-secondary"
            href={spotlight.shareUrl}
            onClick={(event) => {
              event.preventDefault();
              onShare(spotlight.awardType);
            }}
          >
            <FiShare2 /> Share this win
          </a>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();
  const { courses: plsCourses, files: plsFiles } = usePLS();
  const { xp = 0, streak = 0 } = useGamification();
  const navigate = useNavigate();

  const [homeFeed, setHomeFeed] = useState([]);
  const [homeTrendingCollections, setHomeTrendingCollections] = useState({
    courses: [],
    files: [],
  });
  const [spotlightAwards, setSpotlightAwards] = useState(null);
  const [rawCourseItems, setRawCourseItems] = useState([]);
  const [homeRecommendations, setHomeRecommendations] = useState(null);
  const [homeCourseMeta, setHomeCourseMeta] = useState({ missingProfile: false });
  const [activeModal, setActiveModal] = useState(null);
  const [showSocialPrompt, setShowSocialPrompt] = useState(false);
  const [activeSpotlightPromptKey, setActiveSpotlightPromptKey] = useState(null);
  const [spotlightPromptShownThisMount, setSpotlightPromptShownThisMount] = useState(false);
  const [popupFeatureFlags, setPopupFeatureFlags] = useState({
    socialSubscriptionPopup: false,
    spotlightPopup: false,
  });
  const [winnerConfettiActive, setWinnerConfettiActive] = useState(false);
  const winnerConfettiShownRef = useRef(false);
  const [modalReactions, setModalReactions] = useState({ likes: 0, comments: 0, shares: 0 });
  const [modalComments, setModalComments] = useState([]);
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingLike, setIsSubmittingLike] = useState(false);
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);
  const [modalSyncing, setModalSyncing] = useState(false);
  const [hasLikedModal, setHasLikedModal] = useState(false);
  const [modalFeedback, setModalFeedback] = useState("");
  const [dailyTakenState, setDailyTakenState] = useState({});
  const [weeklyTakenState, setWeeklyTakenState] = useState({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialType, setViewerInitialType] = useState('quote');
  const [viewerInitialItemId, setViewerInitialItemId] = useState(null);
  const [consumedState, setConsumedState] = useState({});
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [studyOpenedState, setStudyOpenedState] = useState({});
  const [spotlightOpenedState, setSpotlightOpenedState] = useState({});
  const [homeTrendingDownloadId, setHomeTrendingDownloadId] = useState(null);
  const [reactionBurst, setReactionBurst] = useState({ key: "", nonce: 0 });
  const [headerSheenReady, setHeaderSheenReady] = useState(false);
  const [headerSheenCycle, setHeaderSheenCycle] = useState(0);
  const [academicScopeOverride, setAcademicScopeOverride] = useState(null);
  const headerScrollArmedRef = useRef(false);
  const homeTrendingRailRef = useRef(null);
  const homeTrendingSegmentRefs = useRef({});

  const displayName = user?.full_name || "there";
  const firstNameToken = String(displayName).trim().split(/\s+/)[0] || "there";
  const firstName = toDisplayNameCase(firstNameToken);
  const userKey = user?.id || user?.uuid || user?.email || user?.username || displayName;
  const dailyHeader = getDailyHeaderMessage({ userKey, firstName });
  const dailyTakenStorageKey = `${DAILY_TAKEN_STORAGE_PREFIX}${getLocalDateKey()}`;
  const weeklyTakenStorageKey = `${WEEKLY_TAKEN_STORAGE_PREFIX}${getLocalWeekKey()}`;
  const studyOpenedStorageKey = `${STUDY_OPENED_STORAGE_PREFIX}${getLocalDateKey()}`;
  const spotlightOpenedStorageKey = `${SPOTLIGHT_OPENED_STORAGE_PREFIX}${getLocalWeekKey()}`;
  const headerGreetingLine = `${dailyHeader.greeting}, ${firstName}. ${dailyHeader.welcome}`;
  const planRaw   = currentPlan?.name || user?.subscription?.plan?.name || user?.current_plan || "Basic Student";
  const planLabel  = toDisplayName(planRaw);
  const showContributionAppeal = !isPaidPlan(planRaw);
  const levelRaw = academicScopeOverride?.level || user?.academic_level || user?.level || user?.study_level || "100";
  const levelLabel = normalizeType(levelRaw).includes("level") ? toTitleCase(levelRaw) : `Level ${levelRaw}`;
  const levelValue = levelLabel.replace(/^level\s*/i, "").trim() || levelRaw.toString();

  const semesterRaw = toTitleCase(academicScopeOverride?.semester || user?.current_semester || user?.semester || "Semester 1");
  const semesterLabel = normalizeType(semesterRaw).includes("semester") ? semesterRaw : `Semester ${semesterRaw}`;
  const semesterValue = String(semesterLabel).match(/\d+/)?.[0] || "1";

  useEffect(() => {
    let cancelled = false;

    api.publicConfig.get()
      .then((response) => {
        if (cancelled) return;
        const features = response?.config?.features || {};
        setPopupFeatureFlags({
          socialSubscriptionPopup: features.social_subscription_popup === true,
          spotlightPopup: features.spotlight_popup === true,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPopupFeatureFlags({
          socialSubscriptionPopup: false,
          spotlightPopup: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleStateChanged = (event) => {
      const scopes = event?.detail?.scopes || [];
      if (!scopes.includes(APP_STATE_SCOPES.ACADEMIC)) return;

      const academic = event?.detail?.academic || {};
      setAcademicScopeOverride({
        level: academic.level || levelValue,
        semester: academic.semester || semesterValue,
      });
    };

    window.addEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
    return () => window.removeEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
  }, [levelValue, semesterValue]);

  useEffect(() => {
    const activateHeaderSheen = () => {
      window.requestAnimationFrame(() => {
        setHeaderSheenReady(true);
        setHeaderSheenCycle((previous) => previous + 1);
      });
    };

    if (document.readyState === "complete") {
      activateHeaderSheen();
      return undefined;
    }

    const handleLoad = () => {
      window.removeEventListener("load", handleLoad);
      activateHeaderSheen();
    };

    window.addEventListener("load", handleLoad);

    return () => {
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || window.pageYOffset || 0;

      if (scrollTop > 40) {
        headerScrollArmedRef.current = true;
        return;
      }

      if (scrollTop <= 6 && headerScrollArmedRef.current) {
        headerScrollArmedRef.current = false;
        setHeaderSheenCycle((previous) => previous + 1);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const programLabel = toTitleCase(
    user?.course_of_study || user?.program || user?.department || "Performing Arts (Primary Education)"
  );
  const collegeLabel = toTitleCase(
    user?.college || user?.institution || user?.school || user?.campus || "Foso College of Education"
  );
  const locationLabel = toTitleCase(
    user?.location || user?.city || user?.region || user?.state || user?.country || ""
  );
  const learningStats = user?.learning_stats || user?.stats || {};
  const lessonsCompleted = Math.max(
    0,
    Math.round(
      getNumberOrFallback(
        learningStats?.lessons_completed ??
          learningStats?.completed_lessons ??
          user?.lessons_completed ??
          user?.completed_lessons ??
          user?.progress?.lessons_completed,
        0
      )
    )
  );
  const learningCompletionPercent = clampPercent(
    getNumberOrFallback(
      learningStats?.course_completion_pct ??
        learningStats?.course_progress_pct ??
        user?.course_completion_pct ??
        user?.progress_percentage ??
        user?.progress?.course_completion_pct,
      0
    )
  );
  const hasLearningActivity = lessonsCompleted > 0 || learningCompletionPercent > 0;

  const practiceAttempts = Math.max(
    0,
    Math.round(
      getNumberOrFallback(
        learningStats?.practice_attempts ??
          learningStats?.quiz_attempts ??
          learningStats?.tests_attempted ??
          user?.practice_attempts ??
          user?.quiz_attempts ??
          user?.tests_attempted ??
          user?.attempts_count,
        0
      )
    )
  );
  const practiceBestScore = clampPercent(
    getNumberOrFallback(
      learningStats?.best_practice_score ??
        learningStats?.best_score ??
        user?.best_practice_score ??
        user?.best_score ??
        user?.quiz_best_score,
      0
    )
  );
  const practiceCompletionPercent = clampPercent(
    getNumberOrFallback(learningStats?.practice_completion_pct ?? user?.practice_completion_pct, 0)
  );
  const hasPracticeActivity = practiceAttempts > 0 || practiceBestScore > 0 || practiceCompletionPercent > 0;

  const recommendedCourse = useMemo(() => {
    const selectedLevel = String(levelValue || "").match(/\d+/)?.[0] || "";
    const selectedSemester = String(semesterValue || "").match(/\d+/)?.[0] || "";
    const matchesCurrentScope = (course = {}) => {
      const levelCandidates = [
        ...(Array.isArray(course?.levels) ? course.levels : []),
        course?.level,
        ...(Array.isArray(course?.offering_filters) ? course.offering_filters.map((item) => item?.level) : []),
      ]
        .map((value) => String(value || "").match(/\d+/)?.[0])
        .filter(Boolean);
      const semesterCandidates = [
        ...(Array.isArray(course?.semesters) ? course.semesters : []),
        course?.semester,
        ...(Array.isArray(course?.offering_filters) ? course.offering_filters.map((item) => item?.semester) : []),
      ]
        .map((value) => String(value || "").match(/\d+/)?.[0])
        .filter(Boolean);

      const levelMatches = !levelCandidates.length || !selectedLevel || levelCandidates.includes(selectedLevel);
      const semesterMatches = !semesterCandidates.length || !selectedSemester || semesterCandidates.includes(selectedSemester);
      return levelMatches && semesterMatches;
    };
    const liveCourse =
      (homeTrendingCollections.courses || []).find((course) => (course?.title || course?.name) && matchesCurrentScope(course)) ||
      (homeTrendingCollections.courses || []).find((course) => course?.title || course?.name);
    if (liveCourse) {
      const level = Array.isArray(liveCourse?.levels) ? liveCourse.levels[0] : liveCourse?.level;
      const semester = Array.isArray(liveCourse?.semesters) ? liveCourse.semesters[0] : liveCourse?.semester;
      const creditsText = String(liveCourse?.credits || "").trim();
      return {
        title: toTitleCase(liveCourse?.title || liveCourse?.name || ""),
        code: getHomeTrendingCourseCode(liveCourse),
        credits: creditsText ? (/credit/i.test(creditsText) ? creditsText : `${creditsText} Credits`) : "",
        audience: [programLabel, level ? `Level ${level}` : "", semester ? `Semester ${semester}` : ""]
          .filter(Boolean)
          .join(" • "),
        thumbnail: liveCourse?.thumbnail_url || liveCourse?.thumbnail || liveCourse?.image || liveCourse?.image_url || null,
        progress: clampPercent(getNumberOrFallback(liveCourse?.progress ?? liveCourse?.progress_percentage, 0)),
      };
    }

    if (isAuthenticated) {
      return {};
    }

    return getCourseRecommendation({ account: user, programLabel, levelValue });
  }, [homeTrendingCollections.courses, isAuthenticated, levelValue, programLabel, semesterValue, user]);
  // Progress of the specific course shown on the study card, so the bar reflects
  // that course rather than a global/placeholder completion figure.
  const recommendedCourseProgress = clampPercent(
    getNumberOrFallback(recommendedCourse?.progress ?? recommendedCourse?.progress_percentage, 0)
  );
  const recentStudyGroups = useMemo(() => getRecentStudyGroups(user, 1), [user]);
  const recommendedStudyGroups = useMemo(
    () =>
      getRecommendedStudyGroups(
        {
          college: collegeLabel,
          program: programLabel,
          level: levelValue,
          location: locationLabel,
        },
        1
      ),
    [collegeLabel, programLabel, levelValue, locationLabel]
  );
  const shouldStartLearning = !hasLearningActivity;
  const shouldStartPractice = !hasPracticeActivity;
  const shouldJoinStudyGroups = recentStudyGroups.length === 0;
  const displayedStudyGroups = useMemo(
    () => (shouldJoinStudyGroups ? recommendedStudyGroups : recentStudyGroups),
    [shouldJoinStudyGroups, recommendedStudyGroups, recentStudyGroups]
  );

  const planKey =
    currentPlan?.id ||
    currentPlan?.name ||
    user?.subscription?.plan?.id ||
    user?.subscription?.plan?.name ||
    user?.current_plan ||
    "guest";

  const planTierClass = getPlanTierClass(planRaw);
  const isMasterPlan  = normalizeType(planRaw).includes("master");
  const pickupArtUrl = `url(${import.meta.env.BASE_URL}learn.jpg)`;
  const practiceArtUrl = `url(${import.meta.env.BASE_URL}test-2.jpg)`;
  const pickupCourseImage = recommendedCourse.thumbnail
    ? resolveUploadUrl(recommendedCourse.thumbnail)
    : `${import.meta.env.BASE_URL}learn.jpg`;
  const practiceCourseImage = recommendedCourse.thumbnail
    ? resolveUploadUrl(recommendedCourse.thumbnail)
    : `${import.meta.env.BASE_URL}test-2.jpg`;
  const groupsArtUrl = `url(${import.meta.env.BASE_URL}group-1.jpg)`;
  const groupsCourseImage = `${import.meta.env.BASE_URL}group-1.jpg`;
  const weeklyArticleImage = `${import.meta.env.BASE_URL}learning-1.jpg`;
  const weeklyStoryImage = `${import.meta.env.BASE_URL}learning-2.jpg`;
  const hasPickupProgress = recommendedCourseProgress > 0 || !shouldStartLearning;
  const pickupHeaderText = hasPickupProgress ? "Pick up where you left off" : "Start Learning here";
  const pickupCourseName =
    recommendedCourse.title ||
    (homeCourseMeta.missingProfile ? "Complete your academic profile" : "Current semester courses");
  const pickupCourseCode =
    recommendedCourse.code ||
    (homeCourseMeta.missingProfile ? "Profile incomplete" : "Course map");
  const pickupCourseCredits =
    recommendedCourse.credits ||
    (homeCourseMeta.missingProfile ? "Set program, level, and semester" : "Awaiting mapped courses");
  const pickupCourseAudience =
    recommendedCourse.audience ||
    [programLabel, levelValue ? `Level ${levelValue}` : ""].filter(Boolean).join(" • ");
  const pickupCtaLabel = hasPickupProgress ? "Continue learning" : "Let's go";
  const practiceHeaderText = shouldStartPractice ? "Start Testing Yourself" : "Continue practicing";
  const practiceCourseName = `${pickupCourseName} (Quiz)`;
  const practiceAttemptLabel = `${shouldStartPractice ? 0 : practiceAttempts || 12} attempts`;
  const practiceBestScoreLabel = `Best score ${Math.round(
    shouldStartPractice ? 0 : practiceBestScore || 83
  )}%`;
  const practiceCtaLabel = shouldStartPractice ? "Let's dive in" : "Continue practicing";
  const groupsHeaderText = shouldJoinStudyGroups ? "Join Study Groups" : "Recent Study Groups";
  const pickupProgress = clampPercent(
    recommendedCourseProgress || (shouldStartLearning ? 0 : learningCompletionPercent)
  );
  const practiceProgress = shouldStartPractice
    ? 0
    : clampPercent(practiceCompletionPercent || practiceBestScore || 54);
  const normalizedPickupProgress = clampPercent(pickupProgress);
  const normalizedPracticeProgress = clampPercent(practiceProgress);
  const pickupProgressFill = getProgressFillGradient(normalizedPickupProgress);
  const practiceProgressFill = getProgressFillGradient(normalizedPracticeProgress);
  const pickupLeft = 100 - normalizedPickupProgress;
  const practiceLeft = 100 - normalizedPracticeProgress;

  useEffect(() => {
    if (!isAuthenticated) {
      trackEvent("home_landing_view", { is_authenticated: false });
      return;
    }

    trackEvent("home_view", {
      is_authenticated: true,
      plan: planLabel || "visitor",
    });
  }, [isAuthenticated, planKey, planLabel, trackEvent]);

  useEffect(() => {
    let active = true;

    const loadContent = () => {
      // Fire all requests immediately — handle each as it resolves so the UI
      // updates incrementally instead of waiting for the slowest response.
      const courseFilters = { limit: 8, level: levelValue, semester: semesterValue };
      const contentP   = api.content.getAll({ limit: 120 }).catch(() => null);
      const coursesP   = (isAuthenticated
        ? api.subjects.getAll()
        : Promise.resolve(null)
      ).catch(() => null);
      const resourcesP = api.resources.getFiles(isAuthenticated ? courseFilters : { limit: 8 }).catch(() => null);
      const spotlightP = api.gamification.getSpotlights().catch(() => null);

      contentP.then((res) => {
        if (!active) return;
        const feedItems = (res?.content || res?.data?.content || res?.items || [])
          .filter((item) => [
            'edutainment',
            'blog',
            'article',
            'story',
            'fact',
            'quote',
            'jocular',
            'joke',
          ].includes(String(item?.type || '').toLowerCase()));
        setHomeFeed(Array.isArray(feedItems) ? feedItems : []);
      });

      coursesP.then((res) => {
        if (!active) return;
        const courseItems = res?.courses || res?.data?.courses || res?.data || [];
        setHomeCourseMeta({ missingProfile: Boolean(res?.data?.missing_profile) });
        const items = Array.isArray(courseItems) ? courseItems : [];
        setRawCourseItems(items);
        setHomeTrendingCollections((prev) => ({ ...prev, courses: items }));
      });

      resourcesP.then((res) => {
        if (!active) return;
        const fileItems = res?.files || res?.data?.files || res?.data || [];
        setHomeTrendingCollections((prev) => ({
          ...prev,
          files: Array.isArray(fileItems) ? fileItems : [],
        }));
      });

      spotlightP.then((res) => {
        if (!active) return;
        setSpotlightAwards(res?.success ? res : null);
      });

      // Warm caches for likely next-navigation targets
      if (isAuthenticated) {
        api.prefetch('/gamification/progress', 30000);
        api.prefetch('/pls/dashboard', 60000);
        api.prefetch('/courses/current', 60000);       // Learn / PLS pages
        api.prefetch('/subscription/current', 300000); // upgrade modal, settings
        api.prefetch('/gamification/leaderboard?type=global&timeFrame=weekly', 120000);
      } else {
        // Guest users: warm content that appears on landing pages
        api.prefetch('/subscription/plans', 600000);   // pricing / upgrade modal
      }
    };

    loadContent();
    return () => {
      active = false;
    };
  }, [isAuthenticated, levelValue, planKey, programLabel, semesterValue]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;

    const buildRecommendations = async () => {
      let textLesson = null;
      let videoLesson = null;
      let textLessonCourse = null;
      let videoLessonCourse = null;

      // === LESSONS ===
      // 1. Try PLS saved items (same data as PLS courses page)
      const plsText = plsCourses.find((c) => {
        const t = (c.content_type || c.type || '').toLowerCase();
        return t === 'text_lesson' || t === 'lesson' || (t.includes('text') && !t.includes('video'));
      });
      if (plsText) {
        const lessonNumber = plsText.lesson_number || plsText.lessonNumber || plsText.order || plsText.lesson_order;
        textLessonCourse = plsText;
        textLesson = {
          id: plsText.content_id || plsText.id,
          title: toTitleCase(plsText.title || ''),
          courseName: toTitleCase(plsText.course || plsText.course_name || ''),
          code: getHomeTrendingCourseCode(plsText),
          creditsText: getHomeTrendingCourseCreditsText(plsText),
          image: getHomeTrendingCourseImage(plsText, 0),
          imageFallback: HOME_TRENDING_COURSE_FALLBACK_IMAGES[0],
          lessons: 1,
          exercises: 0,
          videos: 0,
          lessonLabel: lessonNumber ? `Lesson ${lessonNumber}` : 'Text lesson',
          duration: plsText.duration || (plsText.duration_minutes ? `${plsText.duration_minutes} min` : ''),
        };
      }
      
      const plsVideo = plsCourses.find((c) => {
        const t = (c.content_type || c.type || '').toLowerCase();
        return t === 'video' || t === 'video_lesson' || t.includes('video');
      });
      if (plsVideo) {
        const lessonNumber = plsVideo.lesson_number || plsVideo.lessonNumber || plsVideo.order || plsVideo.lesson_order;
        videoLessonCourse = plsVideo;
        videoLesson = {
          id: plsVideo.content_id || plsVideo.id,
          title: toTitleCase(plsVideo.title || ''),
          courseName: toTitleCase(plsVideo.course || plsVideo.course_name || ''),
          code: getHomeTrendingCourseCode(plsVideo),
          creditsText: getHomeTrendingCourseCreditsText(plsVideo),
          image: getHomeTrendingCourseImage(plsVideo, 1),
          imageFallback: HOME_TRENDING_COURSE_FALLBACK_IMAGES[1],
          lessons: 0,
          exercises: 0,
          videos: 1,
          lessonLabel: lessonNumber ? `Lesson ${lessonNumber}` : 'Video lesson',
          duration: plsVideo.duration || (plsVideo.duration_minutes ? `${plsVideo.duration_minutes} min` : ''),
        };
      }

      // 2. Fall back to getLessons across enrolled courses, then catalog
      if (!textLesson || !videoLesson) {
        if (!active) return;
        let courseCandidates = [...rawCourseItems];
        if (courseCandidates.length === 0) {
          const catalogItems = [];
          courseCandidates = Array.isArray(catalogItems) ? catalogItems : [];
        }
        if (!active) return;

        const shuffled = [...courseCandidates];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const notStarted = shuffled.filter((c) => !(c.progress || c.progress_percentage));
        const candidates = notStarted.length > 0 ? notStarted : shuffled;
        const pool = candidates.slice(0, 6).filter((c) => c.id || c.course_id);

        // Fetch all candidate course lessons in parallel instead of sequential loops
        const lessonResults = await Promise.all(
          pool.map((course) => {
            const courseId = course.id || course.course_id;
            return api.subjects.getLessons(course.slug || courseId).catch(() => null).then((res) => ({
              course,
              courseId,
              lessons: res?.data?.lessons || res?.lessons || [],
            }));
          })
        );
        if (!active) return;

        let usedCourseId = textLesson?.courseId;

        if (!textLesson) {
          for (const { course, courseId, lessons } of lessonResults) {
            const found =
              lessons.find((l) => {
                const t = (l.type || '').toLowerCase();
                return (t === 'text_lesson' || t === 'lesson') && !l.completed;
              }) ||
              lessons.find((l) => {
                const t = (l.type || '').toLowerCase();
                return !t.includes('video') && !l.completed && l.title && l.id;
              });
            if (found) {
              const courseModel = buildHomeTrendingCourseCardModel(course, 0);
              const lessonNumber = found.lesson_number || found.lessonNumber || found.order || found.lesson_order;
              textLessonCourse = course;
              textLesson = {
                id: found.id,
                title: toTitleCase(found.title || ''),
                courseName: courseModel.title,
                courseId,
                code: courseModel.code,
                creditsText: courseModel.creditsText,
                image: courseModel.image,
                imageFallback: courseModel.imageFallback,
                lessons: Math.max(1, courseModel.lessons),
                exercises: courseModel.exercises,
                videos: courseModel.videos,
                lessonLabel: lessonNumber ? `Lesson ${lessonNumber}` : 'Text lesson',
                duration: found.duration || (found.duration_minutes ? `${found.duration_minutes} min` : ''),
              };
              usedCourseId = courseId;
              break;
            }
          }
        }

        if (!videoLesson) {
          for (const { course, courseId, lessons } of lessonResults) {
            if (courseId === usedCourseId) continue;
            const found =
              lessons.find((l) => {
                const t = (l.type || '').toLowerCase();
                return (t === 'video' || t === 'video_lesson') && !l.completed;
              }) ||
              lessons.find((l) => {
                const t = (l.type || '').toLowerCase();
                return t.includes('video') && !l.completed && l.title && l.id;
              });
            if (found) {
              const courseModel = buildHomeTrendingCourseCardModel(course, 1);
              const lessonNumber = found.lesson_number || found.lessonNumber || found.order || found.lesson_order;
              videoLessonCourse = course;
              videoLesson = {
                id: found.id,
                title: toTitleCase(found.title || ''),
                courseName: courseModel.title,
                courseId,
                code: courseModel.code,
                creditsText: courseModel.creditsText,
                image: courseModel.image,
                imageFallback: courseModel.imageFallback,
                lessons: courseModel.lessons,
                exercises: courseModel.exercises,
                videos: Math.max(1, courseModel.videos),
                lessonLabel: lessonNumber ? `Lesson ${lessonNumber}` : 'Video lesson',
                duration: found.duration || (found.duration_minutes ? `${found.duration_minutes} min` : ''),
              };
              break;
            }
          }
        }
      }

      // === QUIZ / EXAM ===
      const practiceCourseSource =
        textLessonCourse ||
        videoLessonCourse ||
        rawCourseItems.find((course) => getHomeTrendingCourseTitle(course) !== 'Untitled Course') ||
        null;
      const practiceCourseTitle = [
        textLesson?.courseName,
        videoLesson?.courseName,
        practiceCourseSource ? getHomeTrendingCourseTitle(practiceCourseSource) : '',
      ]
        .map((value) => String(value || '').trim())
        .find((value) => value && value !== 'Untitled Course');

      const getCoursePracticeRecommendation = async (type, apiType) => {
        const sampleItems = practiceCourseTitle
          ? getSamplePracticeItemsForCourse(practiceCourseTitle, apiType)
          : [];
        let apiItems = [];

        if (practiceCourseTitle && active) {
          const response = await api.content
            .getAll({ type: apiType, course: practiceCourseTitle, limit: 4 })
            .catch(() => null);
          apiItems = getHomePracticeItems(response);
        }

        const mapped = dedupeHomePracticeItems(
          [...apiItems, ...sampleItems]
            .filter(Boolean)
            .map((item) => mapHomeRecommendedPracticeItem(item, type, practiceCourseTitle))
        );

        if (mapped.length) return mapped[0];

        const plsMatch = plsFiles.find((file) => {
          const fileType = (file.content_type || file.type || file.category || '').toLowerCase();
          const matchesType =
            type === 'quiz'
              ? fileType === 'quiz' || fileType.includes('quiz') || (fileType.includes('test') && !fileType.includes('lesson'))
              : fileType === 'past_question' || fileType === 'exam' || fileType.includes('past') || fileType.includes('exam');
          return matchesType && (!practiceCourseTitle || matchesHomePracticeCourse(file, practiceCourseTitle));
        });
        if (plsMatch) return mapHomeRecommendedPracticeItem(plsMatch, type, practiceCourseTitle);

        const feedMatch = homeFeed.find((file) => {
          const fileType = (file.type || file.content_type || file.category || '').toLowerCase();
          const matchesType =
            type === 'quiz'
              ? fileType === 'quiz'
              : fileType === 'past_question' || fileType === 'exam';
          return matchesType && (!practiceCourseTitle || matchesHomePracticeCourse(file, practiceCourseTitle));
        });
        if (feedMatch) return mapHomeRecommendedPracticeItem(feedMatch, type, practiceCourseTitle);

        if (!active) return null;
        const response = await api.content.getAll({ type: apiType, limit: 1 }).catch(() => null);
        const genericItems = getHomePracticeItems(response);
        return genericItems[0] ? mapHomeRecommendedPracticeItem(genericItems[0], type, practiceCourseTitle) : null;
      };

      let [quiz, exam] = await Promise.all([
        getCoursePracticeRecommendation('quiz', 'quiz'),
        getCoursePracticeRecommendation('exam', 'past_question'),
      ]);

      if (!quiz) {
        const plsQuizFile = plsFiles.find((f) => {
          const t = (f.content_type || f.type || f.category || '').toLowerCase();
          return t === 'quiz' || t.includes('quiz') || (t.includes('test') && !t.includes('lesson'));
        });
        quiz = plsQuizFile ? mapHomeRecommendedPracticeItem(plsQuizFile, 'quiz', practiceCourseTitle) : null;
      }

      if (!exam) {
        const plsExamFile = plsFiles.find((f) => {
          const t = (f.content_type || f.type || f.category || '').toLowerCase();
          return t === 'past_question' || t === 'exam' || t.includes('past') || t.includes('exam');
        });
        exam = plsExamFile ? mapHomeRecommendedPracticeItem(plsExamFile, 'exam', practiceCourseTitle) : null;
      }

      const group = displayedStudyGroups[0] || recommendedStudyGroups[0] || null;

      if (active) {
        setHomeRecommendations({ textLesson, videoLesson, quiz, exam, group });
      }
    };

    buildRecommendations();
    return () => {
      active = false;
    };
  }, [isAuthenticated, rawCourseItems, plsCourses, plsFiles, homeFeed, displayedStudyGroups, recommendedStudyGroups, levelValue, semesterValue]);

  useEffect(() => {
    const readStorageMap = (key) => {
      if (typeof window === "undefined") return {};
      try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : {};
      } catch {
        return {};
      }
    };

    const dailyMap = readStorageMap(dailyTakenStorageKey);
    const weeklyMap = readStorageMap(weeklyTakenStorageKey);
    setDailyTakenState(dailyMap);
    setWeeklyTakenState(weeklyMap);
    setConsumedState({ ...weeklyMap, ...dailyMap });
    setStudyOpenedState(readStorageMap(studyOpenedStorageKey));
    setSpotlightOpenedState(readStorageMap(spotlightOpenedStorageKey));
  }, [dailyTakenStorageKey, weeklyTakenStorageKey, studyOpenedStorageKey, spotlightOpenedStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!activeModal) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [activeModal]);

  useEffect(() => {
    if (!showSocialPrompt) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [showSocialPrompt]);

  useEffect(() => {
    if (!activeSpotlightPromptKey) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [activeSpotlightPromptKey]);

  useEffect(() => {
    if (!viewerOpen) return undefined;
    return lockBodyScroll();
  }, [viewerOpen]);

  useEffect(() => {
    if (!popupFeatureFlags.socialSubscriptionPopup || !isAuthenticated || !user || activeModal || showSocialPrompt || activeSpotlightPromptKey || spotlightPromptShownThisMount || typeof window === "undefined") {
      return undefined;
    }

    try {
      if (window.sessionStorage.getItem(SOCIAL_PROMPT_SESSION_KEY) === "true") {
        return undefined;
      }

      const storageKey = getSocialPromptUserKey(user);
      const state = readSocialPromptState(storageKey);

      // Never show again once the user has engaged (clicked/followed)
      if (state.lastEngagedAt) {
        return undefined;
      }

      // Show at most once per week (beginning of week) for non-interactors
      const currentWeekKey = getLocalWeekKey();
      if (state.shownWeek === currentWeekKey) {
        return undefined;
      }

      const hasNeverSeen = !state.hasSeen;
      const timer = window.setTimeout(() => {
        setShowSocialPrompt(true);
        window.sessionStorage.setItem(SOCIAL_PROMPT_SESSION_KEY, "true");
        writeSocialPromptState(storageKey, {
          hasSeen: true,
          lastShownAt: Date.now(),
          shownWeek: currentWeekKey,
        });
        trackEvent("learnda_social_prompt_shown", {
          reason: hasNeverSeen ? "first_home_visit" : "weekly_reminder",
        });
      }, hasNeverSeen ? 900 : 1600);

      return () => window.clearTimeout(timer);
    } catch {
      return undefined;
    }
  }, [activeModal, activeSpotlightPromptKey, isAuthenticated, popupFeatureFlags.socialSubscriptionPopup, showSocialPrompt, spotlightPromptShownThisMount, trackEvent, user]);

  const closeSocialPrompt = () => {
    const storageKey = getSocialPromptUserKey(user);
    const state = readSocialPromptState(storageKey);
    writeSocialPromptState(storageKey, {
      dismissedAt: Date.now(),
      dismissCount: Number(state.dismissCount || 0) + 1,
    });
    setShowSocialPrompt(false);
    trackEvent("learnda_social_prompt_dismissed");
  };

  const handleSocialPromptEngage = (channel) => {
    writeSocialPromptState(getSocialPromptUserKey(user), {
      lastEngagedAt: Date.now(),
      lastEngagedChannel: channel?.name || "",
    });
    trackEvent("learnda_social_prompt_engaged", {
      channel: channel?.name || "unknown",
      cta: channel?.cta || "",
    });
  };

  const viewAllSocialsFromPrompt = () => {
    writeSocialPromptState(getSocialPromptUserKey(user), {
      lastEngagedAt: Date.now(),
      lastEngagedChannel: "Our Socials",
    });
    setShowSocialPrompt(false);
    trackEvent("learnda_social_prompt_view_all");
    navigate("/our-socials");
  };

  const writeStorageMap = (key, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  };

  const markDailyItemTaken = useCallback((key) => {
    if (!key) return;
    setConsumedState((previous) => (previous[key] ? previous : { ...previous, [key]: true }));
    setDailyTakenState((previous) => {
      const next = { ...previous, [key]: true };
      writeStorageMap(dailyTakenStorageKey, next);
      return next;
    });
  }, [dailyTakenStorageKey]);

  const markWeeklyItemTaken = useCallback((key) => {
    if (!key) return;
    setConsumedState((previous) => (previous[key] ? previous : { ...previous, [key]: true }));
    setWeeklyTakenState((previous) => {
      const next = { ...previous, [key]: true };
      writeStorageMap(weeklyTakenStorageKey, next);
      return next;
    });
  }, [weeklyTakenStorageKey]);

  const markConsumedFromItem = useCallback(
    (item) => {
      if (!item) return;
      const stateKey = item.stateKey || item.key;
      if (!stateKey) return;
      const key = String(item.key || '');
      if (key === 'article' || key === 'story' || key.startsWith('article-') || key.startsWith('story-')) {
        markWeeklyItemTaken(stateKey);
      } else {
        markDailyItemTaken(stateKey);
      }
    },
    [markDailyItemTaken, markWeeklyItemTaken]
  );

  const openMomentsViewer = useCallback(
    (item) => {
      const type = item?.key && EDUTAINMENT_DAILY_TYPES.includes(item.key) ? item.key : "quote";
      setViewerInitialType(type);
      setViewerInitialItemId(item?.contentId || item?.id || null);
      setViewerOpen(true);
      if (item) markConsumedFromItem(item);
    },
    [markConsumedFromItem]
  );

  const closeMomentsViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const markStudyOpened = (key) => {
    if (!key) return;
    setStudyOpenedState((previous) => {
      const next = { ...previous, [key]: true };
      writeStorageMap(studyOpenedStorageKey, next);
      return next;
    });
  };

  const updateSpotlightAward = (key, patch) => {
    if (!key) return;
    setSpotlightAwards((previous) => ({
      ...(previous || { success: true }),
      [key]: {
        ...((previous && previous[key]) || {}),
        ...patch,
      },
    }));
  };

  const markSpotlightOpened = async (key) => {
    if (!key) return;
    const spotlight = key === "contributor" ? contributorSpotlight : studentSpotlight;
    setSpotlightOpenedState((previous) => {
      const next = { ...previous, [key]: true };
      writeStorageMap(spotlightOpenedStorageKey, next);
      return next;
    });
    if (!spotlight?.awardId) return;
    // Suppress the popup for this award since the user already saw/engaged with it on the homepage
    writeSpotlightPromptSeen(user, spotlight.awardId);

    const currentCount = Math.max(0, Number(spotlight.celebrationCount || 0));
    if (!spotlight.hasCelebrated) {
      updateSpotlightAward(key, {
        celebration_count: currentCount + 1,
        has_celebrated: true,
      });
    }

    try {
      const response = await api.gamification.celebrateSpotlight({
        awardId: spotlight.awardId,
        awardType: spotlight.awardType || key,
        targetUserId: spotlight.userId,
      });
      if (response?.success) {
        updateSpotlightAward(key, {
          celebration_count: response.celebration_count,
          has_celebrated: true,
        });
        api.invalidateCache(['/gamification/spotlights']);
      }
    } catch {
      // Keep the optimistic celebration; the next spotlight fetch will reconcile it.
    }
  };

  const shareSpotlight = async (key) => {
    const spotlight = key === "contributor" ? contributorSpotlight : studentSpotlight;
    if (!spotlight) return;

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = spotlight.shareUrl?.startsWith("http")
      ? spotlight.shareUrl
      : `${baseUrl}${spotlight.shareUrl || `/home?spotlight=${encodeURIComponent(spotlight.awardId || key)}`}`;
    const shareText = spotlight.shareText || `${spotlight.name} is being celebrated on Learnda. Join the applause.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: spotlight.title || "Learnda Spotlight",
          text: shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      }
      trackEvent("spotlight_shared", {
        award_type: key,
        award_id: spotlight.awardId,
      });
    } catch {
      // Ignore cancelled native share sheets.
    }
  };

  const buildFallbackModalItem = (item) => ({
    ...item,
    stateKey: item.key,
    showImage: Boolean(item.imageUrl),
    reactions: item.reactions || { likes: 0, comments: 0, shares: 0 },
    body: item.body || item.preview || item.title,
    title: item.title || item.label,
    category: item.category || item.label,
    uploader: item.uploader || "Learnda",
  });

  const quoteSource = homeFeed.find((item) => normalizeCategoryText(item?.category || item?.type || "").includes("quote"));
  const factSource = homeFeed.find((item) => normalizeCategoryText(item?.category || item?.type || "").includes("fact"));
  const jokeSource = homeFeed.find((item) => {
    const category = normalizeCategoryText(item?.category || item?.type || "");
    return category.includes("joke") || category.includes("jocular");
  });

  const dailyHighlights = useMemo(() => {
    const defaults = [
      buildFallbackModalItem({
        key: "quote",
        label: "Quote for the day",
        category: "Quote for the day",
        title: getContentAuthor(quoteSource, "Learnda Quote"),
        body: getContentBody(quoteSource, "Consistency compounds. Keep showing up."),
        author: getContentAuthor(quoteSource, "Learnda"),
        imageUrl: getContentImage(quoteSource),
        icon: FaQuoteLeft,
        reactions: getReactionCountsFromItem(quoteSource, "quote"),
        contentId: quoteSource?.id || null,
      }),
      buildFallbackModalItem({
        key: "fact",
        label: "Did you know",
        category: "Fact of the day",
        title: getFirstSentence(getContentPreview(factSource, "A quick study fact"), "A quick study fact"),
        body: getContentBody(factSource, "Spacing out revision improves recall over time."),
        imageUrl: getContentImage(factSource),
        icon: FaQuestion,
        reactions: getReactionCountsFromItem(factSource, "fact"),
        contentId: factSource?.id || null,
      }),
      buildFallbackModalItem({
        key: "joke",
        label: "Spice up your day",
        category: "Light moment",
        title: getFirstSentence(getContentPreview(jokeSource, "Campus humor"), "Campus humor"),
        body: getContentBody(jokeSource, "A little humor makes long study days easier."),
        imageUrl: getContentImage(jokeSource),
        icon: FiSmile,
        reactions: getReactionCountsFromItem(jokeSource, "joke"),
        contentId: jokeSource?.id || null,
      }),
    ];

    return defaults.map((item) => ({
      ...item,
      stateKey: getHighlightStateKey(item.key, item, item.key),
    }));
  }, [quoteSource, factSource, jokeSource]);

  const weeklyHighlights = useMemo(() => {
    const articleSource = homeFeed.find((item) => resolveHomeTrendingEdutCategory(item) === "articles");
    const storySource = homeFeed.find((item) => resolveHomeTrendingEdutCategory(item) === "stories");

    const highlights = [
      buildFallbackModalItem({
        key: "article",
        label: "Today's article",
        title: articleSource?.title || "A practical article for this week",
        preview: getFirstSentence(getContentPreview(articleSource, "Keep your momentum steady this week."), "Keep your momentum steady this week."),
        body: getContentBody(articleSource, "Keep your momentum steady this week."),
        author: getContentAuthor(articleSource, ""),
        imageUrl: getContentImage(articleSource),
        icon: FiFileText,
        reactions: getReactionCountsFromItem(articleSource, "article"),
        contentId: articleSource?.id || null,
      }),
      buildFallbackModalItem({
        key: "story",
        label: "Today's story",
        title: storySource?.title || "A campus story worth reading",
        preview: getFirstSentence(getContentPreview(storySource, "A short story with a practical lesson."), "A short story with a practical lesson."),
        body: getContentBody(storySource, "A short story with a practical lesson."),
        author: getContentAuthor(storySource, ""),
        imageUrl: getContentImage(storySource),
        icon: FiPlayCircle,
        reactions: getReactionCountsFromItem(storySource, "story"),
        contentId: storySource?.id || null,
      }),
    ];

    return highlights.map((item) => ({
      ...item,
      stateKey: getHighlightStateKey(item.key, item, item.key),
    }));
  }, [homeFeed]);

  const articleHighlight = weeklyHighlights.find((item) => item.key === "article") || null;
  const storyHighlight = weeklyHighlights.find((item) => item.key === "story") || null;

  const itemsByType = useMemo(() => {
    const todayByType = {
      quote: dailyHighlights[0],
      fact: dailyHighlights[1],
      joke: dailyHighlights[2],
      article: articleHighlight,
      story: storyHighlight,
    };

    const matchType = (item, type) => {
      const cat = resolveHomeTrendingEdutCategory(item);
      if (type === "quote") return cat === "quotes";
      if (type === "fact") return cat === "facts";
      if (type === "joke") return cat === "jocular";
      if (type === "article") return cat === "articles";
      if (type === "story") return cat === "stories";
      return false;
    };

    const result = {};
    EDUTAINMENT_DAILY_TYPES.forEach((type) => {
      const today = todayByType[type];
      const todayContentId = today?.contentId;
      const baseList = today ? [today] : [];
      const extras = homeFeed
        .filter((source) => matchType(source, type))
        .filter((source) => source?.id && source.id !== todayContentId)
        .slice(0, 10 - baseList.length)
        .map((source, idx) => {
          const isLongType = type === "article" || type === "story";
          return {
            key: type,
            label: today?.label || type,
            category: today?.category || type,
            title: isLongType
              ? source.title || getFirstSentence(getContentPreview(source, ""), "")
              : getFirstSentence(getContentPreview(source, source.title || ""), source.title || ""),
            preview: getFirstSentence(getContentPreview(source, ""), ""),
            body: getContentBody(source, ""),
            author: getContentAuthor(source, ""),
            imageUrl: getContentImage(source),
            icon: today?.icon,
            reactions: getReactionCountsFromItem(source, type),
            contentId: source.id || null,
            stateKey: getHighlightStateKey(`${type}-extra-${idx + 1}`, source, `${type}-extra-${idx + 1}`),
            showImage: Boolean(getContentImage(source)),
            uploader: 'Learnda',
          };
        });
      const combined = baseList.concat(extras).map((item, index) => ({
        ...item,
        sortIndex: index,
        consumed: Boolean(consumedState[item.stateKey || item.key]),
      }));
      const hasUnconsumed = combined.some((item) => !item.consumed);
      result[type] = (hasUnconsumed
        ? [...combined].sort((left, right) => {
            if (left.consumed !== right.consumed) return left.consumed ? 1 : -1;
            return left.sortIndex - right.sortIndex;
          })
        : combined
      ).map(({ sortIndex, ...item }) => item);
    });
    return result;
  }, [dailyHighlights, articleHighlight, storyHighlight, homeFeed, consumedState]);

  const dailyHighlightsForViewer = useMemo(
    () => EDUTAINMENT_DAILY_TYPES.map((type) => itemsByType[type]?.[0]).filter(Boolean),
    [itemsByType]
  );

  // Count of unconsumed ("new") items per edutainment type, for the Home
  // explore cards' CTA labels (e.g. "3 new quotes").
  const newContentCounts = useMemo(() => {
    const counts = {};
    EDUTAINMENT_DAILY_TYPES.forEach((type) => {
      const list = itemsByType[type] || [];
      counts[type] = list.filter((item) => !item.consumed).length;
    });
    return counts;
  }, [itemsByType]);
  const ArticleIcon = FiFileText;
  const StoryIcon = FiPlayCircle;

  const spotlights = useMemo(() => {
    const student = homeFeed.find((item) => normalizeCategoryText(item?.category || "").includes("student"));
    const contributor = homeFeed.find((item) => normalizeCategoryText(item?.category || "").includes("contributor"));
    const studentAward = spotlightAwards?.student || null;
    const contributorAward = spotlightAwards?.contributor || null;

    return {
      student: {
        awardId: studentAward?.award_id || "student:fallback",
        awardType: "student",
        userId: studentAward?.user_id || studentAward?.id || null,
        title: studentAward?.title || student?.title || "Student of the Week",
        name: studentAward?.name || student?.author_name || student?.author?.name || null,
        college: studentAward?.college || student?.college || student?.institution || "Foso College of Education",
        program: studentAward?.program || student?.program || student?.programme_category || "Performing Arts (Primary)",
        level: studentAward?.level || levelLabel,
        body:
          studentAward?.body ||
          getContentBody(student, "This learner finished first on the weekly XP leaderboard and showed strong consistency, focus, and engagement."),
        image: studentAward?.image || getContentImage(student) || `${import.meta.env.BASE_URL}learn.jpg`,
        badgeLabel: studentAward?.badge_label || "Weekly #1",
        achievementLabel: studentAward?.achievement_label || `${Math.max(1, Number(streak || 0))}x streak`,
        celebrationCount: Number(studentAward?.celebration_count || 0),
        hasCelebrated: Boolean(studentAward?.has_celebrated),
        shareUrl: studentAward?.share_url || "/home?spotlight=student",
        shareText: studentAward?.share_text || "Learnda is celebrating a student who topped the weekly XP leaderboard. Join the applause.",
        publishedAt: studentAward?.published_at || null,
      },
      contributor: {
        awardId: contributorAward?.award_id || "contributor:fallback",
        awardType: "contributor",
        userId: contributorAward?.user_id || contributorAward?.id || null,
        title: contributorAward?.title || contributor?.title || "Contributor of the Month",
        name: contributorAward?.name || contributor?.author_name || contributor?.author?.name || null,
        subtitle: contributorAward?.college || contributor?.subtitle || "Learnda Creator",
        college: contributorAward?.college || contributor?.college || contributor?.institution || "Learnda community",
        program: contributorAward?.program || contributor?.program || programLabel,
        level: contributorAward?.level || levelLabel,
        body:
          contributorAward?.body ||
          getContentBody(contributor, "Shared quality content, maintained high engagement, and helped peers throughout the month."),
        image: contributorAward?.image || getContentImage(contributor) || `${import.meta.env.BASE_URL}test-2.jpg`,
        badgeLabel: contributorAward?.badge_label || "Monthly impact",
        achievementLabel: contributorAward?.achievement_label || `${Math.max(0, Number(xp || 0)).toLocaleString()} XP`,
        celebrationCount: Number(contributorAward?.celebration_count || 0),
        hasCelebrated: Boolean(contributorAward?.has_celebrated),
        shareUrl: contributorAward?.share_url || "/home?spotlight=contributor",
        shareText: contributorAward?.share_text || "Learnda is celebrating a contributor whose content helped learners this month. Share the win.",
        publishedAt: contributorAward?.published_at || null,
        scoreBreakdown: contributorAward?.score_breakdown || null,
      },
    };
  }, [homeFeed, levelLabel, programLabel, spotlightAwards, streak, xp]);

  const studentSpotlight = spotlights.student;
  const contributorSpotlight = spotlights.contributor;
  const studentSpotlightImage = studentSpotlight.image;
  const contributorSpotlightImage = contributorSpotlight.image;
  const studentCongratulateLabel = "Celebrate";
  const contributorCongratulateLabel = "Congratulate";
  const activeSpotlightPrompt = activeSpotlightPromptKey === "contributor" ? contributorSpotlight : activeSpotlightPromptKey === "student" ? studentSpotlight : null;

  // Poll celebration counts every 30 s so other users' clicks show up in real time
  useEffect(() => {
    const studentId = studentSpotlight?.awardId;
    const contributorId = contributorSpotlight?.awardId;
    const ids = [studentId, contributorId].filter(
      (id) => id && !String(id).includes(':fallback')
    );
    if (!ids.length) return undefined;

    const pollCounts = async () => {
      try {
        api.invalidateCache(['/gamification/spotlights/counts']);
        const response = await api.gamification.getSpotlightCounts(ids);
        if (!response?.success || !response.counts) return;
        setSpotlightAwards((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          if (next.student && response.counts[studentId] !== undefined) {
            next.student = { ...next.student, celebration_count: Number(response.counts[studentId]) };
          }
          if (next.contributor && response.counts[contributorId] !== undefined) {
            next.contributor = { ...next.contributor, celebration_count: Number(response.counts[contributorId]) };
          }
          return next;
        });
      } catch { /* ignore */ }
    };

    const timerId = setInterval(pollCounts, 30000);
    return () => clearInterval(timerId);
  }, [studentSpotlight?.awardId, contributorSpotlight?.awardId]);

  // Detect if the logged-in user is the current spotlight winner
  const isStudentWinner = Boolean(user?.id && studentSpotlight?.userId && String(studentSpotlight.userId) === String(user.id));
  const isContributorWinner = Boolean(user?.id && contributorSpotlight?.userId && String(contributorSpotlight.userId) === String(user.id));
  const isSpotlightWinner = isStudentWinner || isContributorWinner;

  // Fire congratulatory confetti on the home page for the winner (once per session)
  useEffect(() => {
    if (!isSpotlightWinner || winnerConfettiShownRef.current) return;
    winnerConfettiShownRef.current = true;
    const t = window.setTimeout(() => setWinnerConfettiActive(true), 1200);
    return () => window.clearTimeout(t);
  }, [isSpotlightWinner]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !user ||
      !popupFeatureFlags.spotlightPopup ||
      spotlightPromptShownThisMount ||
      activeSpotlightPromptKey ||
      activeModal ||
      showSocialPrompt ||
      viewerOpen ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    try {
      if (window.sessionStorage.getItem(SPOTLIGHT_SESSION_KEY)) return undefined;
    } catch {}

    const seenState = readSpotlightPromptState(user);
    const nextKey = studentSpotlight?.awardId && !seenState[studentSpotlight.awardId]
      ? "student"
      : contributorSpotlight?.awardId && !seenState[contributorSpotlight.awardId]
        ? "contributor"
        : null;

    if (!nextKey) return undefined;

    // The winner should not see the modal — they shouldn't celebrate themselves
    if (nextKey === "student" && isStudentWinner) return undefined;
    if (nextKey === "contributor" && isContributorWinner) return undefined;

    const timer = window.setTimeout(() => {
      const spotlight = nextKey === "student" ? studentSpotlight : contributorSpotlight;
      if (!spotlight?.awardId) return;
      writeSpotlightPromptSeen(user, spotlight.awardId);
      try { window.sessionStorage.setItem(SPOTLIGHT_SESSION_KEY, '1'); } catch {}
      setSpotlightPromptShownThisMount(true);
      setActiveSpotlightPromptKey(nextKey);
      trackEvent("spotlight_prompt_shown", {
        award_type: nextKey,
        award_id: spotlight.awardId,
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeModal,
    activeSpotlightPromptKey,
    contributorSpotlight,
    isAuthenticated,
    isContributorWinner,
    isStudentWinner,
    popupFeatureFlags.spotlightPopup,
    showSocialPrompt,
    spotlightPromptShownThisMount,
    studentSpotlight,
    trackEvent,
    user,
    viewerOpen,
  ]);

  const homeTrendingSections = useMemo(() => {
    const courses = (homeTrendingCollections.courses || []).slice(0, 6).map((item, index) =>
      buildHomeTrendingCourseCardModel(item, index)
    );
    const courseMetaMap = new Map(
      courses.map((item) => [normalizeHomeTrendingText(item.title), item])
    );
    const files = (homeTrendingCollections.files || []).slice(0, 6).map((item, index) =>
      buildHomeTrendingFileCardModel(item, index, courseMetaMap, courses)
    );
    return HOME_TRENDING_TAGS.map((tag) => ({
      key: tag.key,
      label: tag.label,
      items: tag.key === "courses" ? courses : files,
    }));
  }, [homeTrendingCollections]);

  const visibleHomeTrendingSections = useMemo(
    () => homeTrendingSections.filter((section) => section.items.length > 0),
    [homeTrendingSections]
  );

  const { activeIndex: activeHomeTrendingIndex } = useHorizontalAutoScroll(homeTrendingRailRef, {
    enabled: visibleHomeTrendingSections.length > 1,
    interval: 4800,
    itemCount: visibleHomeTrendingSections.length,
    pauseOnInteractionMs: 5200,
    trackActiveIndex: true,
  });

  const activeHomeTrendingLabel =
    visibleHomeTrendingSections[Math.min(activeHomeTrendingIndex, Math.max(visibleHomeTrendingSections.length - 1, 0))]
      ?.label ||
    visibleHomeTrendingSections[0]?.label ||
    "Trending";

  const openModalFromItem = (item, marker) => {
    if (!item) return;
    const stateKey = item.stateKey || item.key || marker;
    if (marker === "daily") markDailyItemTaken(stateKey);
    if (marker === "weekly") markWeeklyItemTaken(stateKey);
    setShowCommentComposer(false);
    setCommentDraft("");
    setModalFeedback("");
    setHasLikedModal(false);
    setReactionBurst({ key: "", nonce: 0 });
    setActiveModal({
      ...item,
      key: item.key || marker,
      showImage: item.showImage ?? Boolean(item.imageUrl || getContentImage(item)),
      imageUrl: item.imageUrl || getContentImage(item) || null,
      uploader: item.uploader || getContentUploader(item, "Learnda"),
      mediaLabel: item.mediaLabel || item.title || item.label,
      reactions: item.reactions || { likes: 0, comments: 0, shares: 0 },
      contentId: item.contentId || item.id || null,
    });
    setModalReactions(item.reactions || { likes: 0, comments: 0, shares: 0 });
    setModalComments([]);
  };

  const openDailyModal = (item) => openModalFromItem(item, "daily");
  const openWeeklyModal = (item) => openModalFromItem(item, "weekly");
  const closeActiveModal = () => setActiveModal(null);
  const hasModalImage = Boolean(activeModal?.showImage);

  useEffect(() => {
    if (!activeModal?.contentId) return undefined;
    let active = true;

    const loadModalData = async () => {
      setModalSyncing(true);
      try {
        const [commentsResponse, interactionsResponse] = await Promise.all([
          api.content.getComments(activeModal.contentId).catch(() => null),
          api.content.getInteractions(activeModal.contentId).catch(() => null),
        ]);
        if (!active) return;
        setModalComments(commentsResponse?.comments || []);
        setModalReactions(
          interactionsResponse?.reactions ||
          activeModal.reactions ||
          { likes: 0, comments: 0, shares: 0 }
        );
      } finally {
        if (active) setModalSyncing(false);
      }
    };

    loadModalData();
    return () => {
      active = false;
    };
  }, [activeModal]);

  const modalActions = [
    { key: "likes", label: "Like", icon: FiThumbsUp },
    { key: "comments", label: "Comment", icon: FiMessageCircle },
    { key: "shares", label: "Share", icon: FiShare2 },
  ];

  const triggerReactionBurst = (key) => {
    setReactionBurst({ key, nonce: Date.now() });
  };

  const handleLikeReaction = async () => {
    if (!activeModal) return;
    triggerReactionBurst("likes");
    setHasLikedModal(true);
    setModalReactions((previous) => ({ ...previous, likes: (previous.likes || 0) + 1 }));
    if (activeModal.contentId) {
      setIsSubmittingLike(true);
      try {
        await api.content.like(activeModal.contentId);
      } catch {
        // keep optimistic like
      } finally {
        setIsSubmittingLike(false);
      }
    }
  };

  const handleToggleCommentComposer = () => {
    setShowCommentComposer((previous) => !previous);
  };

  const handleShareReaction = async () => {
    if (!activeModal) return;
    triggerReactionBurst("shares");
    setModalReactions((previous) => ({ ...previous, shares: (previous.shares || 0) + 1 }));
    setModalFeedback("Shared from Learnda.");
    if (activeModal.contentId) {
      setIsSubmittingShare(true);
      try {
        await api.content.share(activeModal.contentId);
      } catch {
        // keep optimistic share
      } finally {
        setIsSubmittingShare(false);
      }
    }
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content || !activeModal) return;

    setIsSubmittingComment(true);
    try {
      if (activeModal.contentId) {
        await api.content.addComment(activeModal.contentId, content).catch(() => null);
      }
      const nextComment = {
        id: `local-${Date.now()}`,
        author_name: displayName,
        created_at: new Date().toISOString(),
        content,
      };
      setModalComments((previous) => [nextComment, ...previous]);
      setModalReactions((previous) => ({ ...previous, comments: (previous.comments || 0) + 1 }));
      setCommentDraft("");
      setShowCommentComposer(false);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const openStudySection = (key, path, state = undefined) => {
    markStudyOpened(key);
    navigate(path, state ? { state } : undefined);
  };

  const openSpotlightCard = (key, path) => {
    const spotlight = key === 'contributor' ? contributorSpotlight : studentSpotlight;
    if (user && spotlight?.awardId) {
      writeSpotlightPromptSeen(user, spotlight.awardId);
    }
    navigate(path);
  };

  const openHomeTrendingCourse = (item) => {
    navigate(buildCoursePath(item), { state: buildCourseRouteState(item) });
  };
  const openHomeRecommendedPractice = (item) => {
    if (item?.destination) {
      navigate(item.destination, item.toState ? { state: item.toState } : undefined);
      return;
    }

    const fallbackCourse = {
      id: item?.courseId || item?.id,
      title: item?.courseName || item?.title,
      code: item?.code,
      creditsText: item?.creditsText,
      image: item?.image,
      imageFallback: item?.imageFallback,
      lessons: item?.lessons,
      exercises: item?.exercises,
      videos: item?.videos,
    };
    navigate(buildPracticePath(fallbackCourse), { state: buildCourseRouteState(fallbackCourse) });
  };
  const openHomeTrendingFile = () => navigate('/resources');
  const downloadHomeTrendingFile = async (item) => {
    if (!item?.sourceFileId) {
      openHomeTrendingFile(item);
      return;
    }
    await withDownloadLock(
      async () => {
        setHomeTrendingDownloadId(item.sourceFileId);
        try {
          await api.resources.trackView(item.sourceFileId);
          const blob = await api.resources.downloadFile(item.sourceFileId);
          saveBlobAsFile(blob, item.fileName || `${item.courseName || "learnda-file"}.pdf`);
        } catch {
          openHomeTrendingFile(item);
        } finally {
          setHomeTrendingDownloadId(null);
        }
      }
    );
  };
  const renderHomeTrendingCard = (sectionKey, item, index) => {
    if (sectionKey === "courses") {
      return (
        <button
          key={`course-${item.id || index}`}
          type="button"
          className="home-trending-card home-trending-course-card"
          onClick={() => openHomeTrendingCourse(item)}
        >
          <div className="home-trending-course-image">
            <img
              src={item.image || item.imageFallback}
              alt={item.title}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const target = event.currentTarget;
                if (target.dataset.fallbackApplied === "true") return;
                target.dataset.fallbackApplied = "true";
                target.src = item.imageFallback;
              }}
            />
          </div>
          <strong className="home-trending-course-title">{item.title}</strong>
          <p className="home-trending-course-meta">
            <span>{item.code}</span>
            <span>{item.creditsText}</span>
          </p>
          <div className="home-trending-course-pills">
            <span>{Math.max(0, item.lessons)} Lessons</span>
            <span>{Math.max(0, item.exercises)} Exercises</span>
            <span>{Math.max(0, item.videos)} Videos</span>
          </div>
        </button>
      );
    }

    if (sectionKey === "files") {
      return (
        <article
          key={`file-${item.id || index}`}
          className={`home-trending-card home-trending-file-card pls-file-item-${item.questionTone}`}
          role="button"
          tabIndex={0}
          onClick={() => openHomeTrendingFile(item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openHomeTrendingFile(item);
            }
          }}
        >
          <div className="home-trending-file-row-top">
            <div className={`home-trending-file-icon tone-${item.questionTone}`} aria-hidden="true">
              <FiFileText />
            </div>
            <div className="home-trending-file-top-meta">
              <span className="home-trending-file-top-pill category-pill">{item.questionType}</span>
              <span className="home-trending-file-top-pill uploader" title={item.uploader}>
                {item.uploader}
              </span>
            </div>
          </div>
          <div className="home-trending-file-divider" aria-hidden="true" />
          <p className="home-trending-file-course" title={item.courseName}>{item.courseName}</p>
          <div className="home-trending-file-row-split">
            <span className="home-trending-file-pill">{item.year}</span>
            <span className="home-trending-file-pill">{item.subType}</span>
          </div>
          <div className="home-trending-file-stats">
            <span className="home-trending-file-stat"><FiDownload />{item.downloads.toLocaleString()}</span>
            <span className="home-trending-file-stat"><FiEye />{item.views.toLocaleString()}</span>
            <span className="home-trending-file-stat"><FiHardDrive />{item.fileSize}</span>
          </div>
          <div className="home-trending-file-divider" aria-hidden="true" />
          <div className="home-trending-file-actions">
            <button
              type="button"
              className="home-trending-file-action"
              onClick={(event) => {
                event.stopPropagation();
                downloadHomeTrendingFile(item);
              }}
              disabled={Boolean(homeTrendingDownloadId)}
            >
              <FiDownload />
              <span>{homeTrendingDownloadId === item.sourceFileId ? "Downloading..." : "Download"}</span>
            </button>
            <button
              type="button"
              className="home-trending-file-action"
              onClick={(event) => {
                event.stopPropagation();
                openHomeTrendingFile(item);
              }}
            >
              <FiEye />
              <span>View</span>
            </button>
          </div>
        </article>
      );
    }

    return null;
  };

  return (
    <>
      <AuthenticatedHomeView
        home={{
          isAuthenticated,
          planTierClass,
          headerSheenReady,
          headerSheenCycle,
          headerGreetingLine,
          firstName,
          isMasterPlan,
          planLabel,
          levelLabel,
          semesterLabel,
          dailyHighlights: dailyHighlightsForViewer,
          newContentCounts,
          consumedState,
          openMomentsViewer,
          prefersReducedMotion,
          dailyTakenState,
          openDailyModal,
          articleHighlight,
          storyHighlight,
          weeklyTakenState,
          openWeeklyModal,
          toTitleCase,
          ArticleIcon,
          StoryIcon,
          weeklyArticleImage,
          weeklyStoryImage,
          studentSpotlightImage,
          contributorSpotlightImage,
          studyOpenedState,
          pickupArtUrl,
          pickupCourseImage,
          pickupHeaderText,
          pickupCourseName,
          pickupCourseCode,
          pickupCourseCredits,
          pickupCourseAudience,
          normalizedPickupProgress,
          pickupProgressFill,
          pickupLeft,
          openStudySection,
          pickupCtaLabel,
          practiceArtUrl,
          practiceCourseImage,
          practiceHeaderText,
          practiceCourseName,
          practiceAttemptLabel,
          practiceBestScoreLabel,
          normalizedPracticeProgress,
          practiceProgressFill,
          practiceLeft,
          practiceCtaLabel,
          groupsArtUrl,
          groupsCourseImage,
          groupsHeaderText,
          displayedStudyGroups,
          logoSrc: LOGO_SRC,
          spotlightOpenedState,
          studentSpotlight,
          contributorSpotlight,
          isStudentWinner,
          isContributorWinner,
          studentCongratulateLabel,
          contributorCongratulateLabel,
          markSpotlightOpened,
          shareSpotlight,
          activeHomeTrendingLabel,
          homeTrendingRailRef,
          homeTrendingSections,
          visibleHomeTrendingSections,
          homeTrendingSegmentRefs,
          renderHomeTrendingCard,
          openHomeRecommendedPractice,
          openSpotlightCard,
          programLabel,
          activeModal,
          closeActiveModal,
          hasModalImage,
          modalSyncing,
          modalActions,
          modalReactions,
          modalFeedback,
          reactionBurst,
          modalComments,
          showCommentComposer,
          commentDraft,
          setCommentDraft,
          setShowCommentComposer,
          isSubmittingLike,
          isSubmittingShare,
          isSubmittingComment,
          hasLikedModal,
          handleLikeReaction,
          handleToggleCommentComposer,
          handleShareReaction,
          handleSubmitComment,
          toDisplayNameCase,
          formatCommentDate,
          modalReactionBursts: MODAL_REACTION_BURSTS,
          homeRecommendations,
        }}
      />

      {showContributionAppeal ? (
        <section className="home-contribution-section" aria-label="Contribute to Learnda">
          <ContributionAppeal className="page-contribution-appeal" heading="Contribute to Learnda" showPlansCta />
        </section>
      ) : null}

      <LearndaSocialPrompt
        isOpen={showSocialPrompt}
        onClose={closeSocialPrompt}
        onEngage={handleSocialPromptEngage}
        onViewAll={viewAllSocialsFromPrompt}
      />
      <SpotlightPromptModal
        spotlight={activeSpotlightPrompt}
        onClose={() => setActiveSpotlightPromptKey(null)}
        onCelebrate={markSpotlightOpened}
        onShare={shareSpotlight}
      />
      <ConfettiOverlay active={winnerConfettiActive} mode="fireworks" onDone={() => setWinnerConfettiActive(false)} />
      <MomentsViewer
        open={viewerOpen}
        initialType={viewerInitialType}
        initialItemId={viewerInitialItemId}
        itemsByType={itemsByType}
        onClose={closeMomentsViewer}
        onMarkConsumed={markConsumedFromItem}
        currentUser={user}
      />
    </>
  );
}
