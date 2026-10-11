import { Suspense, useState, useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Footer from "./Footer";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useAuth } from "../../hooks/useAuth";
import FeatureLockModal from "../subscription/FeatureLockModal";
import PwaInstallBanner from "../common/PwaInstallBanner";
import ProfileCompletionBanner from "../common/ProfileCompletionBanner";
import RouteFallback from "../common/RouteFallback";
import SeoManager from "../seo/SeoManager";
import { getPlanTierClass } from "../../utils/planTheme";
import { APP_EVENTS } from "../../utils/appEvents";
import {
  applyThemePreference,
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
  subscribeToSystemThemeChange,
} from "../../utils/theme";
import "./Layout.css";

export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // Home, Learn and Practice already ask for the class in the page itself,
  // so the reminder banner would only repeat it there.
  const showGlobalProfileBanner = !["/", "/learn", "/practice"].includes(pathname);
  // Phone-only threshold — tablets and up keep the sidebar. Matches the
  // @media (max-width: 768px) breakpoint used across the layout CSS.
  const getInitialIsMobile = () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  };

  const [isMobile, setIsMobile] = useState(getInitialIsMobile);
  // Desktop starts with the sidebar expanded; phones never render it.
  const [sidebarOpen, setSidebarOpen] = useState(() => !getInitialIsMobile());
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [theme, setTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));
  const [featureLockModal, setFeatureLockModal] = useState({
    isOpen: false,
    featureLabel: "This feature",
    requiredPlan: "Serious Student",
    planKey: "serious",
    message: "",
  });
  const toggleButtonRef = useRef(null);
  const { trackEvent } = useAnalytics();
  const planTierClass = getPlanTierClass(user?.current_plan || user?.subscription?.plan?.name || "Basic Student");

  const applySelectedTheme = (nextPreference) => {
    const { preference, resolved } = saveThemePreference(nextPreference);
    setThemePreference((prev) => (prev === preference ? prev : preference));
    setTheme((prev) => (prev === resolved ? prev : resolved));
    return { preference, resolved };
  };

  useEffect(() => {
    const { resolved } = applyThemePreference(themePreference);
    setTheme((prev) => (prev === resolved ? prev : resolved));
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== "auto") {
      return undefined;
    }

    return subscribeToSystemThemeChange(() => {
      const { resolved } = applyThemePreference("auto");
      setTheme((prev) => (prev === resolved ? prev : resolved));
    });
  }, [themePreference]);

  useEffect(() => {
    const handleThemeChanged = (event) => {
      const nextTheme = event?.detail?.theme;
      if (!nextTheme) return;

      applySelectedTheme(nextTheme);
    };

    window.addEventListener(APP_EVENTS.THEME_CHANGED, handleThemeChanged);
    return () => window.removeEventListener(APP_EVENTS.THEME_CHANGED, handleThemeChanged);
  }, []);

  useEffect(() => {
    const handleOpenFeatureLock = (event) => {
      const detail = event?.detail || {};
      const requiredPlan = detail.requiredPlan || "Serious Student";
      const featureLabel = detail.featureLabel || "This feature";
      const message =
        detail.message || `Chip in to open up ${featureLabel.toLowerCase()} — and help keep Learnda free for everyone else.`;

      setFeatureLockModal({
        isOpen: true,
        featureLabel,
        requiredPlan,
        planKey: detail.planKey || "serious",
        message,
      });
    };

    window.addEventListener("openFeatureLockModal", handleOpenFeatureLock);
    return () => window.removeEventListener("openFeatureLockModal", handleOpenFeatureLock);
  }, []);

  // Check for mobile view
  useEffect(() => {
  const checkMobile = () => {
    const mobile = window.innerWidth <= 768;
    setIsMobile((prev) => (prev === mobile ? prev : mobile));
    setSidebarOpen((prev) => {
      const nextOpen = mobile ? false : prev;
      return prev === nextOpen ? prev : nextOpen;
    });
  };

  checkMobile();
  window.addEventListener("resize", checkMobile);
  
  return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle keyboard navigation (desktop sidebar only — mobile uses the bottom nav)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isMobile) return;
      // Toggle sidebar with Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, sidebarOpen]);

  // Track sidebar state changes
  const handleToggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    trackEvent('sidebar_toggle', {
      state: newState ? 'open' : 'collapsed',
      is_mobile: isMobile
    });
  };

  // Handle theme toggle
  const handleThemeToggle = (newTheme) => {
    const { preference, resolved } = applySelectedTheme(newTheme);
    trackEvent('theme_toggle', { theme: preference, applied_theme: resolved });
  };

  const closeFeatureLockModal = () => {
    setFeatureLockModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleFeatureLockUpgrade = () => {
    closeFeatureLockModal();
    window.dispatchEvent(new CustomEvent("openUpgradeModal", {
      detail: {
        planKey: featureLockModal.planKey || "serious",
        requiredPlan: featureLockModal.requiredPlan || "Serious Student",
        source: "feature_lock",
      }
    }));
  };

  return (
    <div className={`app-shell ${planTierClass}`} data-level-group={user?.level_group || undefined}>
      <SeoManager />
      <Header
        onToggleSidebar={handleToggleSidebar}
        toggleButtonRef={toggleButtonRef}
        currentTheme={theme}
        onThemeToggle={handleThemeToggle}
      />
      <div className="app-body">
        {!isMobile && <Sidebar isOpen={sidebarOpen} />}

        <main
          className={`app-content ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"} ${isMobile ? "has-bottom-nav" : ""}`}
        >
          <PwaInstallBanner />
          {showGlobalProfileBanner && <ProfileCompletionBanner />}
          <div className="content-wrapper">
            <Suspense fallback={<RouteFallback compact />}>
              <Outlet />
            </Suspense>
            <Footer />
          </div>
        </main>

        {isMobile && <BottomNav />}

        <FeatureLockModal
          isOpen={featureLockModal.isOpen}
          featureLabel={featureLockModal.featureLabel}
          requiredPlan={featureLockModal.requiredPlan}
          message={featureLockModal.message}
          onUpgrade={handleFeatureLockUpgrade}
          onClose={closeFeatureLockModal}
        />
      </div>
    </div>
  );
}
