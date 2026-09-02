import { useState, useRef, useEffect, useCallback, memo } from "react";
import { toDisplayName } from "../../utils/contributionPlans";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PiSidebar } from "react-icons/pi";
import {
  FiSearch,
  FiBell,
  FiBookOpen,
  FiMoon,
  FiSun,
  FiMenu,
  FiUserPlus,
  FiBarChart2,
  FiMessageCircle,
  FiUsers,
  FiHelpCircle,
  FiDownload,
  FiShare2,
  FiUser,
  FiLogOut,
  FiTrendingUp,
  FiStar,
  FiAward,
  FiUploadCloud,
  FiFileText,
  FiPlayCircle,
  FiClipboard,
  FiLayers,
  FiX,
  FiShield,
} from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";
import { useAnalytics } from "../../hooks/useAnalytics";
import api from "../../services/api";
import contentService from "../../services/contentService";
import {
  applyThemePreference,
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
} from "../../utils/theme";
import { ONBOARDING_STEPS } from "../../utils/onboarding";
import { loadRegistrationDraft } from "../../utils/registrationDraft";
import { getUserDisplayContact } from "../../utils/displayContact";
import { formatDisplayName } from "../../utils/helpers";
import { getNotificationDisplay } from "../../utils/notifications";
import { buildCoursePath, buildCourseRouteState } from "../../utils/courseRouting";
import { buildPracticeSessionPath } from "../../utils/practiceSession";
import { searchSamplePracticeItems } from "../../utils/samplePracticePapers";
import AuthModal from "../auth/AuthModal";
import ConfirmModal from "../common/ConfirmModal";
import CommunityForumPicker from "../community/CommunityForumPicker";
import UserAvatar from "../common/UserAvatar";
import { FEATURE_FLAGS } from "../../config/featureFlags";
import "./Header.css";

const LOGO_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
const LOGO_DARK_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
const GLOBAL_SEARCH_MIN_CHARS = 2;
const GLOBAL_SEARCH_DEBOUNCE_MS = 90;
const GLOBAL_SEARCH_SECONDARY_DELAY_MS = 120;

const GLOBAL_SEARCH_SECTIONS = [
  { key: "courses", label: "Courses", icon: <FiBookOpen /> },
  { key: "textLessons", label: "Text lessons", icon: <FiBookOpen /> },
  { key: "videos", label: "Videos", icon: <FiPlayCircle /> },
  { key: "files", label: "Files", icon: <FiFileText /> },
  { key: "practiceQuizzes", label: "Practice quizzes", icon: <FiClipboard /> },
  { key: "practiceExams", label: "Practice exams", icon: <FiClipboard /> },
  { key: "articles", label: "Articles", icon: <FiFileText /> },
  { key: "stories", label: "Stories", icon: <FiPlayCircle /> },
  { key: "facts", label: "Facts", icon: <FiStar /> },
  { key: "quotes", label: "Quotes", icon: <FiAward /> },
  { key: "jocular", label: "Jokes", icon: <FiMessageCircle /> },
  FEATURE_FLAGS.studyGroups && { key: "groups", label: "Study groups", icon: <FiUsers /> },
].filter(Boolean);
const GLOBAL_SEARCH_SECTION_ORDER = GLOBAL_SEARCH_SECTIONS.map((section) => section.key);
const CONTENT_SEARCH_SECTION_KEYS = [
  "textLessons",
  "videos",
  "practiceQuizzes",
  "practiceExams",
  "articles",
  "stories",
  "facts",
  "quotes",
  "jocular",
];
const createEmptySearchResults = () =>
  Object.fromEntries(GLOBAL_SEARCH_SECTION_ORDER.map((key) => [key, []]));

const normalizeSearchText = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getList = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const getItemTitle = (item = {}) =>
  item.title || item.name || item.course_name || item.course || item.file_name || item.full_name || "Untitled";

const getCourseCode = (item = {}) => item.code || item.course_code || item.short_code || "";

const dedupeSearchItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeSearchText(`${item.kind || item.type || ""}:${item.id || item.course_id || item.slug || getItemTitle(item)}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const matchesQuery = (item = {}, query = "") => {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  const haystack = normalizeSearchText(
    [
      item.title,
      item.name,
      item.course,
      item.course_name,
      item.course_title,
      item.subject,
      item.code,
      item.course_code,
      item.file_name,
      item.description,
      item.summary,
      item.category,
      item.type,
      item.tags,
    ]
      .flat()
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
};

const getTypeValue = (...values) => normalizeSearchText(values.find(Boolean) || "");

const getMetadataValue = (item = {}, key) => item?.metadata?.[key] || "";

const getEdutainmentSectionKey = (item = {}) => {
  const category = getTypeValue(
    item.normalized_category,
    getMetadataValue(item, "normalized_category"),
    item.category,
    getMetadataValue(item, "category")
  );
  const tone = getTypeValue(item.tone, getMetadataValue(item, "tone"));
  const tags = [
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item?.metadata?.tags) ? item.metadata.tags : []),
  ];
  const source = normalizeSearchText(
    [item.type, item.subtype, item.category, getMetadataValue(item, "category"), tone, ...tags, item.title]
      .filter(Boolean)
      .join(" ")
  );

  if (category === "jocular" || tone === "joke" || source.includes("joke") || source.includes("jocular")) {
    return "jocular";
  }
  if (
    category === "facts" ||
    tone === "fact" ||
    source.includes("did you know") ||
    source.includes("fact")
  ) {
    return "facts";
  }
  if (category === "stories" || tone === "story" || source.includes("story")) return "stories";
  if (category === "quotes" || tone === "quote" || source.includes("quote")) return "quotes";
  return "articles";
};

const isEdutainmentItem = (item = {}) => {
  const type = getTypeValue(item.type);
  const subtype = getTypeValue(item.subtype);
  const category = getTypeValue(
    item.normalized_category,
    getMetadataValue(item, "normalized_category"),
    item.category,
    getMetadataValue(item, "category")
  );
  const tone = getTypeValue(item.tone, getMetadataValue(item, "tone"));
  const edutainmentTypes = new Set([
    "edutainment",
    "article",
    "blog",
    "story",
    "fact",
    "quote",
    "jocular",
    "joke",
  ]);

  return (
    edutainmentTypes.has(type) ||
    edutainmentTypes.has(subtype) ||
    ["articles", "stories", "facts", "quotes", "jocular"].includes(category) ||
    ["article", "story", "fact", "quote", "joke"].includes(tone)
  );
};

const getContentKind = (item = {}) => {
  const type = getTypeValue(item.type);
  const subtype = getTypeValue(item.subtype);
  const contentType = getTypeValue(item.content_type);

  if (type.includes("past") || type.includes("exam") || subtype.includes("past") || subtype.includes("exam")) {
    return "exam";
  }
  if (type.includes("quiz") || subtype.includes("quiz")) return "quiz";
  if (contentType === "eduvhibe video" || type === "eduvhibe video") return "eduvhibe_video";
  if (contentType.includes("video") || type.includes("video")) return "video";
  if (isEdutainmentItem(item)) return "edutainment";
  return "lesson";
};

const getContentSearchSectionKey = (item = {}) => {
  const kind = getContentKind(item);
  if (kind === "quiz") return "practiceQuizzes";
  if (kind === "exam") return "practiceExams";
  if (kind === "video" || kind === "eduvhibe_video") return "videos";
  if (kind === "edutainment") return getEdutainmentSectionKey(item);
  return "textLessons";
};

const groupContentSearchItems = (items = []) => {
  const grouped = Object.fromEntries(CONTENT_SEARCH_SECTION_KEYS.map((key) => [key, []]));

  items.forEach((item) => {
    const sectionKey = getContentSearchSectionKey(item);
    if (grouped[sectionKey]?.length < 6) grouped[sectionKey].push(item);
  });

  return grouped;
};

function GlobalSearchPanel({
  query,
  loading,
  results,
  error,
  onClear,
  onClose,
  onOpenResult,
}) {
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= GLOBAL_SEARCH_MIN_CHARS;
  const sections = GLOBAL_SEARCH_SECTIONS.map((section) => ({ ...section, items: results?.[section.key] || [] }));
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div id="global-search-panel" className="global-search-panel" role="dialog" aria-label="Global search results">
      <div className="global-search-panel-head">
        <div>
          <strong>{hasQuery ? `Search results for "${trimmed}"` : "Search Learnda"}</strong>
          <span>{hasQuery ? `${total} matches across learning content` : "Type at least 2 characters to search."}</span>
        </div>
        <button type="button" className="global-search-close" onClick={onClose} aria-label="Close search results">
          <FiX />
        </button>
      </div>

      {!hasQuery ? (
        <div className="global-search-hint">
          <FiLayers />
          <p>Find courses, text lessons, videos, files, practice sets, groups, and edutainment without leaving this page.</p>
        </div>
      ) : loading && total === 0 ? (
        <div className="global-search-loading">Searching...</div>
      ) : error && total === 0 ? (
        <div className="global-search-empty">
          <p>{error}</p>
        </div>
      ) : total === 0 ? (
        <div className="global-search-empty">
          <p>No matching content yet.</p>
          <button type="button" onClick={onClear}>Clear search</button>
        </div>
      ) : (
        <div className="global-search-results">
          {loading ? <div className="global-search-inline-loading">Updating results...</div> : null}
          {sections.map((section) =>
            section.items.length ? (
              <section key={section.key} className={`global-search-section is-${section.key}`}>
                <div className="global-search-section-title">
                  <span>{section.icon}</span>
                  <strong>{section.label}</strong>
                  <em>{section.items.length}</em>
                </div>
                <div className="global-search-items">
                  {section.items.map((item, index) => {
                    const title = getItemTitle(item);
                    const code = getCourseCode(item);
                    const meta = item.meta || item.course || item.course_name || item.category || item.type || "";
                    const image = item.image || item.thumbnail || item.thumbnail_url || item.cover_image || item.image_url;
                    return (
                      <button
                        key={`${section.key}-${item.id || item.course_id || item.slug || index}`}
                        type="button"
                        className={`global-search-card global-search-card-${section.key}`}
                        onClick={() => onOpenResult(section.key, item)}
                      >
                        {image ? (
                          <span className="global-search-thumb">
                            <img src={image} alt="" loading="lazy" decoding="async" />
                          </span>
                        ) : (
                          <span className="global-search-thumb is-icon" aria-hidden="true">
                            {section.icon}
                          </span>
                        )}
                        <span className="global-search-card-copy">
                          <strong>{title}</strong>
                          <span>{[code, meta].filter(Boolean).join(" • ") || section.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function Header({ onToggleSidebar, toggleButtonRef, currentTheme, onThemeToggle }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authOnboardingStep, setAuthOnboardingStep] = useState(null);
  const [authReturnOnClose, setAuthReturnOnClose] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSurface, setSearchSurface] = useState("desktop");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState(createEmptySearchResults);
  const [plans, setPlans] = useState([]);
  const [upgradingPlan, setUpgradingPlan] = useState(null);
  const { user, isAuthenticated, nextStep, logout, checkAuth } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const location = useLocation();

  const notificationsRef = useRef(null);
  const menuRef = useRef(null);
  const accountRef = useRef(null);
  const searchRef = useRef(null);
  const menuSearchRef = useRef(null);
  const searchCacheRef = useRef(new Map());
  const searchRequestIdRef = useRef(0);
  const handledPaymentCallbackRef = useRef(new Set());
  const effectiveTheme = currentTheme || resolveThemePreference(getStoredThemePreference());

  useEffect(() => {
    if (!currentTheme) {
      applyThemePreference(getStoredThemePreference());
    }
  }, [currentTheme]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextQuery = params.get("q") || "";
    setSearchQuery(nextQuery);
  }, [location.search]);

  useEffect(() => {
    const handleOpenAuthModal = (event) => {
      const detail = event?.detail;
      const nextMode =
        typeof detail === "string"
          ? detail
          : detail?.mode || "login";
      const nextOnboardingStep =
        typeof detail === "object" && detail
          ? detail.forceOnboardingStep || null
          : null;
      const shouldReturnOnClose = Boolean(
        typeof detail === "object" && detail?.returnOnClose
      );
      setAuthMode(nextMode);
      setAuthOnboardingStep(nextOnboardingStep);
      setAuthReturnOnClose(shouldReturnOnClose);
      setShowAuthModal(true);
    };

    window.addEventListener("openAuthModal", handleOpenAuthModal);
    return () => window.removeEventListener("openAuthModal", handleOpenAuthModal);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
      const insideDesktopSearch = searchRef.current && searchRef.current.contains(event.target);
      const insideMenuSearch = menuSearchRef.current && menuSearchRef.current.contains(event.target);
      if (!insideDesktopSearch && !insideMenuSearch) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const normalizedQuery = normalizeSearchText(query);

    if (!searchOpen || query.length < GLOBAL_SEARCH_MIN_CHARS) {
      setSearchLoading(false);
      setSearchError("");
      setSearchResults(createEmptySearchResults());
      return undefined;
    }

    const cachedResults = searchCacheRef.current.get(normalizedQuery);
    if (cachedResults) {
      setSearchResults(cachedResults);
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const sampleItems = searchSamplePracticeItems(query);
    let nextResults = {
      ...createEmptySearchResults(),
      ...groupContentSearchItems(sampleItems),
    };
    setSearchResults(nextResults);
    setSearchLoading(true);
    setSearchError("");

    let active = true;
    let pendingRequests = 0;
    let failedRequests = 0;
    const timers = [];

    const applyResults = (patch) => {
      if (!active || searchRequestIdRef.current !== requestId) return;
      nextResults = { ...nextResults, ...patch };
      setSearchResults(nextResults);
    };

    const finishRequest = (failed = false) => {
      if (!active || searchRequestIdRef.current !== requestId) return;
      pendingRequests -= 1;
      if (failed) failedRequests += 1;
      if (pendingRequests <= 0) {
        setSearchLoading(false);
        searchCacheRef.current.set(normalizedQuery, nextResults);
        if (searchCacheRef.current.size > 24) {
          const [oldestKey] = searchCacheRef.current.keys();
          searchCacheRef.current.delete(oldestKey);
        }
        setSearchError(failedRequests >= 3 ? "Search is unavailable right now. Try again in a moment." : "");
        trackEvent("global_search_results", {
          query,
          course_count: nextResults.courses.length,
          lesson_count: nextResults.textLessons.length,
          text_lesson_count: nextResults.textLessons.length,
          video_count: nextResults.videos.length,
          test_count: nextResults.practiceQuizzes.length + nextResults.practiceExams.length,
          practice_quiz_count: nextResults.practiceQuizzes.length,
          practice_exam_count: nextResults.practiceExams.length,
          file_count: nextResults.files.length,
          group_count: nextResults.groups.length,
          edutainment_count:
            nextResults.articles.length +
            nextResults.stories.length +
            nextResults.facts.length +
            nextResults.quotes.length +
            nextResults.jocular.length,
          article_count: nextResults.articles.length,
          story_count: nextResults.stories.length,
          fact_count: nextResults.facts.length,
          quote_count: nextResults.quotes.length,
          joke_count: nextResults.jocular.length,
        });
      }
    };

    const runSource = (task) => {
      pendingRequests += 1;
      task().catch(() => finishRequest(true));
    };

    const startPrimarySearch = () => {
      runSource(async () => {
        const response = await contentService.searchContent(query);
        const contentItems = getList(response?.content, response?.results, response?.data?.content, response?.data);
        const allContent = dedupeSearchItems([...contentItems, ...sampleItems]);
        applyResults(groupContentSearchItems(allContent));
        finishRequest();
      });

      runSource(async () => {
        const response = await api.resources.getFiles({ q: query, limit: 6 });
        applyResults({
          files: getList(response?.files, response?.data?.files, response?.data).slice(0, 6),
        });
        finishRequest();
      });

      runSource(async () => {
        const response = await api.courses.getAll({ q: query, search: query, limit: 6 });
        applyResults({
          courses: getList(response?.courses, response?.data?.courses, response?.data)
            .slice(0, 6),
        });
        finishRequest();
      });
    };

    const startSecondarySearch = () => {
      if (query.length < 3) return;
      if (!FEATURE_FLAGS.studyGroups) return;

      runSource(async () => {
        const response = await api.studyGroups.discover({ q: query, search: query, limit: 6 });
        applyResults({
          groups: getList(response?.groups, response?.data?.groups, response?.data)
            .filter((item) => matchesQuery(item, query))
            .slice(0, 6),
        });
        finishRequest();
      });

    };

    timers.push(window.setTimeout(startPrimarySearch, GLOBAL_SEARCH_DEBOUNCE_MS));
    timers.push(window.setTimeout(startSecondarySearch, GLOBAL_SEARCH_DEBOUNCE_MS + GLOBAL_SEARCH_SECONDARY_DELAY_MS));

    return () => {
      active = false;
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [searchOpen, searchQuery, trackEvent]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationsLoading(true);
    try {
      const response = await api.notifications.getAll();
      setNotifications(response?.notifications || []);
    } catch (error) {
      // Non-blocking: leave existing notifications
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    loadNotifications();

    const refreshInterval = window.setInterval(loadNotifications, 30_000);
    const refreshOnFocus = () => loadNotifications();
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [user, loadNotifications]);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const response = await api.subscription.getPlans({ allowFailure: true, silent: true });
        if (!active) return;
        setPlans(Array.isArray(response?.plans) ? response.plans : []);
      } catch (error) {
        if (active) setPlans([]);
      }
    };

    if (user) {
      loadPlans();
    } else {
      setPlans([]);
    }

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (showNotifications && user) {
      loadNotifications();
    }
  }, [showNotifications, user, loadNotifications]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const reference = params.get("reference") || params.get("trxref") || "";
    const status = String(params.get("status") || "").toLowerCase();
    const resumeOnboarding = String(params.get("resume_onboarding") || "").toLowerCase();
    const hasPaymentStatus =
      status.includes("success") ||
      status.includes("cancel") ||
      status.includes("fail") ||
      status.includes("abandon");
    const hasPaymentCallbackParams = Boolean(reference || hasPaymentStatus);
    const shouldResumePlanStep = resumeOnboarding === "plan" || hasPaymentCallbackParams;

    const registrationDraft = loadRegistrationDraft();
    const hasRegistrationSession =
      Boolean(
        registrationDraft?.registrationSession?.id &&
        registrationDraft?.registrationSession?.resume_token
      );
    const shouldResumeOnboarding =
      hasRegistrationSession ||
      Boolean(registrationDraft?.onboardingStep || registrationDraft?.selectedPlanId) ||
      (isAuthenticated && nextStep && nextStep !== ONBOARDING_STEPS.DONE);

    if (shouldResumePlanStep && shouldResumeOnboarding) {
      setAuthMode(isAuthenticated ? "login" : "register");
      setAuthOnboardingStep(ONBOARDING_STEPS.PLAN);
      setShowAuthModal(true);
      if (!isAuthenticated) {
        return;
      }
    }

    if (!isAuthenticated || !hasPaymentCallbackParams) {
      // Clean up a stale resume_onboarding param so the modal doesn't re-open on every
      // subsequent auth state change once there are no payment callback params left.
      if (isAuthenticated && resumeOnboarding === "plan") {
        const cleanParams = new URLSearchParams(location.search || "");
        cleanParams.delete("resume_onboarding");
        const cleanSearch = cleanParams.toString();
        navigate(`${location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`, { replace: true });
      }
      return;
    }

    const callbackKey = `${status}|${reference}`;
    if (handledPaymentCallbackRef.current.has(callbackKey)) return;
    handledPaymentCallbackRef.current.add(callbackKey);

    const clearPaymentParamsFromUrl = () => {
      const nextParams = new URLSearchParams(location.search || "");
      nextParams.delete("reference");
      nextParams.delete("trxref");
      nextParams.delete("status");
      nextParams.delete("resume_onboarding");
      const nextSearch = nextParams.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
    };

    const run = async () => {
      try {
        if (status.includes("cancel") || status.includes("fail")) {
          await api.billing.cancelPending();
          await checkAuth(true);
          trackEvent("upgrade_payment_canceled", { status: status || "unknown" });
          return;
        }

        if (reference) {
          await api.payment.verify(reference, "paystack");
          await checkAuth(true);
          trackEvent("upgrade_payment_verified", { reference });
        }
      } catch (error) {
        if (status.includes("cancel") || status.includes("fail")) {
          await api.billing.cancelPending();
          await checkAuth(true);
        }
        trackEvent("upgrade_payment_callback_error", {
          status: status || "unknown",
          error: error.message || "callback_error",
        });
      } finally {
        clearPaymentParamsFromUrl();
      }
    };

    run();
  }, [checkAuth, isAuthenticated, location.pathname, location.search, navigate, nextStep, trackEvent]);

  const menuItems = [
    { text: "Download App",       icon: <FiDownload />,      action: () => { navigate("/download");     setShowMenu(false); } },
    { text: "Invite Friends", icon: <FiShare2 />, action: () => { navigate("/invite-friends"); setShowMenu(false); } },
    { text: "Create Content",     icon: <FiUploadCloud />,   action: () => { navigate("/create");           setShowMenu(false); } },
    FEATURE_FLAGS.studyGroups && { text: "Study Groups", icon: <FiUsers />, action: () => { navigate("/groups"); setShowMenu(false); } },
    FEATURE_FLAGS.community && { type: "community-picker" },
    FEATURE_FLAGS.collegeRankings && { text: "College Rankings", icon: <FiBarChart2 />, action: () => { navigate("/college-rankings"); setShowMenu(false); } },
    { text: "User Manual",        icon: <FiHelpCircle />,    action: () => { navigate("/user-manual");      setShowMenu(false); } },
  ].filter(Boolean);

  const handleAuthClick = (mode) => {
    setAuthMode(mode);
    setAuthOnboardingStep(null);
    setAuthReturnOnClose(false);
    setShowAuthModal(true);
    trackEvent("auth_modal_open", { mode });
  };

  const closeAuthModal = () => {
    const shouldReturn = authReturnOnClose;
    setShowAuthModal(false);
    setAuthOnboardingStep(null);
    setAuthReturnOnClose(false);

    if (!shouldReturn) return;

    const historyIndex = Number(window.history.state?.idx);
    if (Number.isFinite(historyIndex) && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  const handleThemeToggle = () => {
    const newTheme = effectiveTheme === "dark" ? "light" : "dark";
    if (onThemeToggle) {
      onThemeToggle(newTheme);
    } else {
      const { preference, resolved } = saveThemePreference(newTheme);
      trackEvent("theme_toggle", { theme: preference, applied_theme: resolved });
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.is_read).length;

  const handleOpenNotificationsPage = () => {
    setShowMenu(false);
    setShowNotifications(false);
    navigate("/notifications");
  };

  const fallbackPlans = [
    { id: "basic", name: "Basic Student", price: 0 },
    { id: "serious", name: "Serious Student", price: 5 },
    { id: "master", name: "Master Student", price: 10 },
  ];
  const availablePlans = (plans?.length ? plans : fallbackPlans)
    .slice()
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const currentPlanName = user?.current_plan || user?.subscription?.plan?.name || "Basic Student";
  const displayContact = getUserDisplayContact(user);
  const accountPlanToneClass = currentPlanName.toLowerCase().includes("master")
    ? "account-plan-master"
    : currentPlanName.toLowerCase().includes("serious")
      ? "account-plan-serious"
      : "account-plan-basic";
  const currentPlanIndex = Math.max(
    0,
    availablePlans.findIndex((plan) => plan.name === currentPlanName)
  );
  const upgradablePlans = availablePlans.slice(currentPlanIndex + 1);

  const openAccountSettings = () => {
    setShowAccountMenu(false);
    navigate("/settings?tab=account");
  };

  const handleUpgradeToPlan = (plan) => {
    if (!plan || upgradingPlan) return;
    setUpgradingPlan(plan.name);
    setShowAccountMenu(false);
    try {
      window.dispatchEvent(new CustomEvent("openUpgradeModal", {
        detail: {
          ...plan,
          source: "header",
        }
      }));
    } catch (error) {
      trackEvent("header_upgrade_failed", {
        plan_name: plan?.name,
        error: error.message || "upgrade_failed",
      });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const requestSignOut = () => {
    setShowAccountMenu(false);
    setShowSignOutConfirm(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  const handleSearchSubmit = (query) => {
    const trimmed = (query || "").trim();
    if (trimmed.length < GLOBAL_SEARCH_MIN_CHARS) {
      setSearchOpen(true);
      return;
    }
    trackEvent("global_search", { query: trimmed });
    const firstSection = GLOBAL_SEARCH_SECTION_ORDER.find((key) => searchResults[key]?.length);
    if (firstSection) {
      handleOpenSearchResult(firstSection, searchResults[firstSection][0]);
    } else {
      setSearchOpen(true);
    }
  };

  const handleSearchFormSubmit = (event) => {
    event.preventDefault();
    handleSearchSubmit(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
  };

  const handleSearchInputFocus = (surface = "desktop") => {
    setSearchSurface(surface);
    setSearchOpen(true);
    trackEvent("search_focus");
  };

  const handleSearchInputChange = (event, surface = "desktop") => {
    setSearchSurface(surface);
    setSearchQuery(event.target.value);
    setSearchOpen(true);
  };

  const getContentRoute = (item = {}) => {
    const kind = getContentKind(item);
    if (kind === "quiz" || kind === "exam") {
      return item.id ? buildPracticeSessionPath(item.id) : "/practice";
    }
    if (item.type === "blog") return item.id ? `/blog/post/${item.id}` : "/blog";
    if (kind === "eduvhibe_video") {
      try {
        localStorage.setItem("edu_last_tab", "videos");
      } catch (error) {
        // Browser storage is optional for routing.
      }
      return "/eduvhibe";
    }
    if (kind === "edutainment") {
      // Edutainment now lives on Home — route all its search hits there.
      return "/";
    }
    return item.id ? `/learn/lesson/${item.id}` : "/learn";
  };

  const handleOpenSearchResult = (sectionKey, item) => {
    if (!item) return;
    setSearchOpen(false);
    setShowMenu(false);

    if (sectionKey === "courses") {
      navigate(buildCoursePath(item), { state: buildCourseRouteState(item) });
      return;
    }

    if (sectionKey === "groups") {
      const groupId = item.id || item.group_id || item.uuid;
      navigate(groupId ? `/groups/${groupId}` : "/groups");
      return;
    }

    if (sectionKey === "files") {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      navigate(`/resources${params.toString() ? `?${params.toString()}` : ""}`, {
        state: { selectedFileId: item.id || item.file_id || null },
      });
      return;
    }

    navigate(getContentRoute(item));
  };

  const renderGlobalSearchPanel = (surface = "desktop") =>
    searchOpen && searchSurface === surface ? (
      <GlobalSearchPanel
        query={searchQuery}
        loading={searchLoading}
        results={searchResults}
        error={searchError}
        onClear={clearSearch}
        onClose={closeSearch}
        onOpenResult={handleOpenSearchResult}
      />
    ) : null;

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      // ignore
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    if (!notification.is_read) {
      try {
        await api.notifications.markRead(notification.id);
      } catch (error) {
        // ignore
      } finally {
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
        );
      }
    }
    if (notification.action_url) {
      if (notification.action_url.startsWith("/")) {
        navigate(notification.action_url);
      } else {
        window.location.href = notification.action_url;
      }
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <div className="header-left">
            <button
              className="menu-toggle menu-toggle-end"
              onClick={onToggleSidebar}
              ref={toggleButtonRef}
              aria-label="Toggle sidebar"
              type="button"
            >
              <PiSidebar className="toggle-icon" />
            </button>

            <div className="brand-section">
              <Link className="brand" to="/" aria-label="Learnda home">
                <span className="brand-logo">
                  <img src={LOGO_SRC} alt="Learnda logo" className="logo-light" />
                  <img src={LOGO_DARK_SRC} alt="Learnda logo" className="logo-dark" />
                </span>
                <span className="brand-copy">
                  <span className="brand-title-row">
                    <span className="brand-text">Learnda</span>
                    <span className="version-badge">v3</span>
                  </span>
                  <span className="brand-tagline">Learning Platform</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="header-center">
            <form className="search-container" onSubmit={handleSearchFormSubmit} ref={searchRef}>
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search lessons, files, courses..."
                className="search-input"
                onFocus={() => handleSearchInputFocus("desktop")}
                value={searchQuery}
                onChange={handleSearchInputChange}
                aria-label="Search"
                aria-expanded={searchOpen}
                aria-controls="global-search-panel"
              />
              {renderGlobalSearchPanel("desktop")}
            </form>
          </div>

          <div className="header-right">
            <div className="header-controls">
                <button
                  className={`control-button desktop-theme-toggle ${!user ? "mobile-guest-theme-toggle" : ""}`}
                  onClick={handleThemeToggle}
                  aria-label={effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  type="button"
                >
                  {effectiveTheme === "dark" ? <FiSun /> : <FiMoon />}
                </button>

              {user && (
                <div className="notification-container" ref={notificationsRef}>
                  <button
                    className="control-button notification-button"
                    onClick={() => setShowNotifications(!showNotifications)}
                    aria-label="Notifications"
                    type="button"
                  >
                    <FiBell />
                    {unreadNotifications > 0 && (
                      <span className="notification-count">{unreadNotifications}</span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="notification-dropdown">
                      <div className="notification-header">
                        <h4>Notifications</h4>
                        <button className="mark-read" type="button" onClick={markAllRead}>
                          Mark all as read
                        </button>
                      </div>
                      <div className="notification-list">
                        {notificationsLoading ? (
                          <div className="notification-item">
                            <div className="notification-text">Loading notifications...</div>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="notification-item">
                            <div className="notification-text">No notifications yet.</div>
                          </div>
                        ) : (
                          notifications.map((notification) => {
                            const display = getNotificationDisplay(notification);
                            return (
                              <button
                                key={notification.id}
                                type="button"
                                className={`notification-item ${notification.is_read ? "read" : "unread"}`}
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <div className="notification-topline">
                                  <span className="notification-type">{display.typeLabel}</span>
                                  {display.time && (
                                    <span className="notification-time">{display.time}</span>
                                  )}
                                </div>
                                <div className="notification-text">{display.title}</div>
                                {display.body && (
                                  <div className="notification-body">{display.body}</div>
                                )}
                                {display.context && (
                                  <div className="notification-context">{display.context}</div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <button
                        className="view-all"
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/notifications");
                        }}
                      >
                        View All Notifications
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="menu-container" ref={menuRef}>
                <button
                  className="control-button"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="Menu"
                  type="button"
                >
                  <FiMenu />
                </button>

                {showMenu && (
                    <div className={`menu-dropdown ${searchOpen && searchSurface === "menu" ? "is-searching" : ""}`}>
                      <div className="menu-mobile-only">
                        <form className="menu-search" onSubmit={handleSearchFormSubmit} ref={menuSearchRef}>
                          <FiSearch className="menu-search-icon" />
                          <input
                            type="text"
                            placeholder="Search lessons, files, courses..."
                            className="menu-search-input"
                            onFocus={() => handleSearchInputFocus("menu")}
                            value={searchQuery}
                            onChange={(event) => handleSearchInputChange(event, "menu")}
                            aria-label="Search"
                            aria-expanded={searchOpen}
                            aria-controls="global-search-panel"
                          />
                          {renderGlobalSearchPanel("menu")}
                        </form>
                      </div>
                      {user && (
                        <button
                          className="menu-dropdown-item menu-theme-toggle"
                          onClick={() => {
                            handleThemeToggle();
                            setShowMenu(false);
                          }}
                          type="button"
                        >
                          <span className="menu-icon">{effectiveTheme === "dark" ? <FiSun /> : <FiMoon />}</span>
                          {effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        </button>
                      )}
                    {user && (
                      <button
                        className="menu-dropdown-item menu-notification-item"
                        onClick={handleOpenNotificationsPage}
                        type="button"
                      >
                        <span className="menu-icon"><FiBell /></span>
                        <span className="menu-item-label">Notifications</span>
                        {unreadNotifications > 0 && (
                          <span className="menu-item-meta">{unreadNotifications}</span>
                        )}
                      </button>
                    )}
                    {menuItems.map((item, index) =>
                      item.type === 'community-picker' ? (
                        <CommunityForumPicker key="community-picker" onClose={() => setShowMenu(false)} variant="menu-item" />
                      ) : (
                        <button
                          key={index}
                          className="menu-dropdown-item"
                          onClick={item.action}
                          type="button"
                        >
                          <span className="menu-icon">{item.icon}</span>
                          {item.text}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {user && (
                <div className="account-container" ref={accountRef}>
                  <button
                    className="account-button"
                    onClick={() => setShowAccountMenu((prev) => !prev)}
                    aria-label="Account"
                    type="button"
                  >
                    <UserAvatar
                      src={user.avatar_url}
                      name={user.full_name || "Account"}
                      fallbackClassName="account-initials"
                    />
                  </button>

                  {showAccountMenu && (
                    <div className="account-dropdown">
                      <button type="button" className="account-item account-name" onClick={openAccountSettings}>
                        <span className="account-meta-shell">
                          <span className="account-avatar">
                            <UserAvatar
                              src={user.avatar_url}
                              name={user.full_name || "Account"}
                              fallbackClassName="account-initials"
                            />
                          </span>
                          <span className="account-meta">
                            <span className="account-name-text">{formatDisplayName(user.full_name) || "Learnda User"}</span>
                            <span className="account-contact-text">{displayContact || "No contact added"}</span>
                            <span className={`account-plan-pill ${accountPlanToneClass}`}>
                              {toDisplayName(currentPlanName)}
                            </span>
                          </span>
                        </span>
                      </button>
                      {upgradablePlans.map((plan) => {
                        const isMaster = plan.name?.toLowerCase().includes('master');
                        return (
                          <button
                            key={plan.name || plan.id}
                            type="button"
                            className={`account-item account-upgrade${isMaster ? ' account-upgrade--master' : ''}`}
                            onClick={() => handleUpgradeToPlan(plan)}
                            disabled={Boolean(upgradingPlan)}
                          >
                            {isMaster ? <FiStar /> : <FiTrendingUp />}
                            {upgradingPlan === plan.name
                              ? "Setting up..."
                              : `Become a ${toDisplayName(plan.name)}`}
                          </button>
                        );
                      })}
                      {user.role === 'admin' && (
                        <button
                          type="button"
                          className="account-item account-item--admin"
                          onClick={() => { setShowAccountMenu(false); navigate('/admin'); }}
                        >
                          <FiShield />
                          Admin Console
                        </button>
                      )}
                      <button
                        type="button"
                        className="account-item"
                        onClick={openAccountSettings}
                      >
                        <FiUser />
                        Account profile
                      </button>
                      <button
                        type="button"
                        className="account-item"
                        onClick={() => { setShowAccountMenu(false); navigate('/progress'); }}
                      >
                        <FiAward />
                        My progress
                      </button>
                      <button
                        type="button"
                        className="account-item account-signout"
                        onClick={requestSignOut}
                      >
                        <FiLogOut />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!user && (
                <div className="auth-buttons">
                  <button
                    className="auth-button register-button"
                    onClick={() => handleAuthClick("register")}
                    type="button"
                    title="Create account"
                  >
                    <FiUserPlus />
                    <span>Get Started</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Sign out of Learnda?"
        message="You will be logged out on this device and need to sign in again to access your dashboard."
        confirmLabel={signingOut ? "Signing out..." : "Sign out"}
        cancelLabel="Stay signed in"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
        isProcessing={signingOut}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        initialMode={authMode}
        forceOnboardingStep={authOnboardingStep}
        returnPath={`${location.pathname}${location.search || ""}${location.hash || ""}`}
      />
    </>
  );
}

export default memo(Header);
