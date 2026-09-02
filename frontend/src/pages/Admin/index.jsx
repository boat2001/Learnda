import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  FiGrid, FiEye, FiUsers, FiBarChart2, FiAward,
  FiBook, FiLayout, FiBell, FiInbox, FiDollarSign,
  FiMenu, FiX, FiExternalLink, FiSun, FiMoon, FiUserPlus, FiBookOpen, FiTrendingUp,
  FiMap, FiLink, FiShare2, FiShield,
} from 'react-icons/fi';
import api from '../../services/api';
import { saveThemePreference, resolveThemePreference, getStoredThemePreference } from '../../utils/theme';
import OverviewSection from './sections/OverviewSection';
import VisitsSection from './sections/VisitsSection';
import UsersSection from './sections/UsersSection';
import UsageSection from './sections/UsageSection';
import ContributionsSection from './sections/ContributionsSection';
import ContentSection from './sections/ContentSection';
import PagesSection from './sections/PagesSection';
import NotificationsSection from './sections/NotificationsSection';
import MessagesSection from './sections/MessagesSection';
import RevenueSection from './sections/RevenueSection';
import ApplicationsSection from './sections/ApplicationsSection';
import LecturersSection from './sections/LecturersSection';
import PlansSection from './sections/PlansSection';
import AmbassadorsSection from './sections/AmbassadorsSection';
import PublishingSection from './sections/PublishingSection';
import RankingsSection from './sections/RankingsSection';
import ContributorOpsSection from './sections/ContributorOpsSection';
import RoadmapSection from './sections/RoadmapSection';
import ServicesSection from './sections/ServicesSection';
import SocialLinksSection from './sections/SocialLinksSection';
import AdminAccessSection from './sections/AdminAccessSection';
import './Admin.css';

const NAV = [
  { id: 'overview',      label: 'Overview',         icon: FiGrid,       group: 'ANALYTICS' },
  { id: 'visits',        label: 'Visits',            icon: FiEye,        group: 'ANALYTICS' },
  { id: 'users',         label: 'Users',             icon: FiUsers,      group: 'ANALYTICS' },
  { id: 'usage',         label: 'Usage Statistics',  icon: FiBarChart2,  group: 'ANALYTICS' },
  { id: 'contributions', label: 'Contributions',     icon: FiAward,      group: 'PLATFORM'  },
  { id: 'contributor-ops', label: 'Contributor Ops', icon: FiAward,      group: 'OPERATIONS'},
  { id: 'content',       label: 'Content',           icon: FiBook,       group: 'PLATFORM'  },
  { id: 'publishing',    label: 'Team & Updates',    icon: FiBookOpen,   group: 'PLATFORM'  },
  { id: 'rankings',      label: 'College Rankings',  icon: FiTrendingUp, group: 'PLATFORM'  },
  { id: 'pages',         label: 'Pages & Features',  icon: FiLayout,     group: 'PLATFORM'  },
  { id: 'notifications', label: 'Notifications',     icon: FiBell,       group: 'OPERATIONS'},
  { id: 'messages',      label: 'Messages & Feedback', icon: FiInbox,    group: 'OPERATIONS'},
  { id: 'applications',  label: 'Applications',      icon: FiUserPlus,   group: 'OPERATIONS'},
  { id: 'ambassadors',   label: 'Ambassadors',icon: FiUsers,      group: 'OPERATIONS'},
  { id: 'lecturers',     label: 'Lecturers',         icon: FiBookOpen,   group: 'OPERATIONS'},
  { id: 'revenue',       label: 'Revenue',           icon: FiDollarSign, group: 'FINANCE'   },
  { id: 'plans',         label: 'Plan Pricing',       icon: FiDollarSign, group: 'FINANCE'   },
  { id: 'roadmap',       label: 'Roadmap',            icon: FiMap,        group: 'PLATFORM'  },
  { id: 'services',      label: 'Services',           icon: FiLink,       group: 'PLATFORM'  },
  { id: 'social',        label: 'Social Media',       icon: FiShare2,     group: 'PLATFORM'  },
  { id: 'admin-access',  label: 'Admin Access',       icon: FiShield,     group: 'SECURITY'  },
];

const PERIODS = [
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7d'  },
  { value: '30d', label: '30d' },
  { value: '3m',  label: '3m'  },
  { value: '6m',  label: '6m'  },
  { value: '1y',  label: '1y'  },
];

const SECTION_MAP = {
  overview:      OverviewSection,
  visits:        VisitsSection,
  users:         UsersSection,
  usage:         UsageSection,
  contributions: ContributionsSection,
  'contributor-ops': ContributorOpsSection,
  content:       ContentSection,
  publishing:    PublishingSection,
  rankings:      RankingsSection,
  pages:         PagesSection,
  notifications: NotificationsSection,
  messages:      MessagesSection,
  applications:  ApplicationsSection,
  ambassadors:   AmbassadorsSection,
  lecturers:     LecturersSection,
  revenue:       RevenueSection,
  plans:         PlansSection,
  roadmap:       RoadmapSection,
  services:      ServicesSection,
  social:        SocialLinksSection,
  'admin-access': AdminAccessSection,
};

function useResolvedTheme() {
  const [isDark, setIsDark] = useState(
    () => resolveThemePreference(getStoredThemePreference()) === 'dark'
  );

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    saveThemePreference(next);
    setIsDark(!isDark);
  }, [isDark]);

  return [isDark, toggle];
}

function useIsMobileAdmin() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 900px)').matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(max-width: 900px)');
    const handleChange = (event) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener?.('change', handleChange);
    return () => query.removeEventListener?.('change', handleChange);
  }, []);

  return isMobile;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  // sidebarOpen  = mobile overlay state (always starts closed on mobile)
  // sidebarCollapsed = desktop collapse state (starts open)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [period, setPeriod] = useState('30d');
  const [adminProfile, setAdminProfile] = useState(null);
  const [adminProfileLoading, setAdminProfileLoading] = useState(true);
  const [isDark, toggleTheme] = useResolvedTheme();
  const isMobile = useIsMobileAdmin();

  useEffect(() => {
    if (isAuthenticated === false || (user && user.role !== 'admin')) {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'admin') return undefined;
    let mounted = true;
    setAdminProfileLoading(true);
    api.admin.getProfile()
      .then((res) => {
        if (mounted) setAdminProfile(res?.admin || null);
      })
      .catch(() => {
        if (mounted) setAdminProfile(null);
      })
      .finally(() => {
        if (mounted) setAdminProfileLoading(false);
      });
    return () => { mounted = false; };
  }, [isAuthenticated, user]);

  const availableNav = useMemo(() => {
    if (!adminProfile) return [];
    const allowedSectionIds = new Set(adminProfile.admin_permissions || []);
    return NAV.filter((item) => (
      adminProfile.is_superadmin
        ? true
        : item.id !== 'admin-access' && allowedSectionIds.has(item.id)
    ));
  }, [adminProfile]);

  useEffect(() => {
    if (!availableNav.length) return;
    if (!availableNav.some((item) => item.id === activeSection)) {
      setActiveSection(availableNav[0].id);
    }
  }, [activeSection, availableNav]);

  useEffect(() => {
    document.documentElement.classList.add('admin-shell-active');
    document.body.classList.add('admin-shell-active');
    return () => {
      document.documentElement.classList.remove('admin-shell-active');
      document.body.classList.remove('admin-shell-active');
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, sidebarOpen]);

  const handleNav = useCallback((id) => {
    setActiveSection(id);
    setSidebarOpen(false);
  }, []);

  const handleMenuToggle = useCallback(() => {
    if (isMobile) {
      // Mobile: slide-over overlay
      setSidebarOpen((v) => !v);
    } else {
      // Desktop: collapse/expand sidebar
      setSidebarCollapsed((v) => !v);
    }
  }, [isMobile]);

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return (
      <div className="adm adm-unauthorized">
        <div style={{ fontSize: 48 }}>!</div>
        <h2 style={{ margin: '8px 0 4px' }}>Admin access required</h2>
        <p style={{ color: 'var(--adm-text-muted)', margin: 0 }}>You don't have permission to view this page.</p>
      </div>
    );
  }

  if (adminProfileLoading) {
    return <div className="adm"><div className="adm-loading"><div className="adm-spinner" /> Loading admin access...</div></div>;
  }

  if (!availableNav.length) {
    return (
      <div className="adm adm-unauthorized">
        <div style={{ fontSize: 48 }}>!</div>
        <h2 style={{ margin: '8px 0 4px' }}>No admin section assigned</h2>
        <p style={{ color: 'var(--adm-text-muted)', margin: 0 }}>Ask a superadmin to assign your console access.</p>
      </div>
    );
  }

  const currentNav = availableNav.find((n) => n.id === activeSection) || availableNav[0];
  const CurrentSection = SECTION_MAP[currentNav.id] || OverviewSection;
  const NavIcon = currentNav.icon;
  const groups = [...new Set(availableNav.map((n) => n.group))];
  const initials = (user.full_name || user.name || user.email || 'A')[0].toUpperCase();
  const isSidebarVisible = isMobile ? sidebarOpen : !sidebarCollapsed;

  return (
    <div className={`adm${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="adm-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`adm-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="adm-sidebar-logo">
          <img
            src={`${import.meta.env.BASE_URL}learnda-logo.webp`}
            alt="Learnda"
          />
          <div>
            <span>Learnda</span>
            <small>Admin Console</small>
          </div>
        </div>

        <nav className="adm-nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="adm-nav-section">{group}</div>
              {availableNav.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`adm-nav-item${activeSection === item.id ? ' is-active' : ''}`}
                    onClick={() => handleNav(item.id)}
                  >
                    <span className="adm-nav-icon"><Icon /></span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="adm-sidebar-user">
          <div className="adm-sidebar-avatar">{initials}</div>
          <div className="adm-sidebar-user-info">
            <div className="adm-sidebar-user-name">{user.full_name || user.name || user.email}</div>
            <div className="adm-sidebar-user-role">{adminProfile?.admin_title || 'Administrator'}</div>
          </div>
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-header">
          <div className="adm-header-left">
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              style={{ padding: '0 8px', flexShrink: 0 }}
              onClick={handleMenuToggle}
              aria-label="Toggle sidebar"
            >
              {isSidebarVisible ? <FiX size={18} /> : <FiMenu size={18} />}
            </button>
            <div className="adm-header-icon">
              <NavIcon />
            </div>
            <h1 className="adm-header-title">{currentNav.label}</h1>
          </div>

          <div className="adm-header-right">
            {/* Period tabs — hidden on phones via CSS, shown on tablet/desktop */}
            <div className="adm-period-tabs">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`adm-period-tab${period === p.value ? ' is-active' : ''}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Mobile period select — only visible when tabs are hidden */}
            <select
              className="adm-select adm-period-select-mobile"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Theme toggle */}
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              style={{ padding: '0 8px', flexShrink: 0 }}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
            </button>

            <Link
              to="/"
              className="adm-btn adm-btn-outline"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <FiExternalLink size={13} />
              <span className="adm-platform-label">Platform</span>
            </Link>
          </div>
        </header>

        <main className="adm-content">
          <CurrentSection period={period} />
        </main>
      </div>
    </div>
  );
}
