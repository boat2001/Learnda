import { NavLink } from "react-router-dom";
import {
  MdHome,
  MdSchool,
  MdQuiz,
  MdFolder,
  MdSettings,
  MdPerson,
  MdWorkspacePremium,
} from "react-icons/md";
import { useAuth } from "../../hooks/useAuth";
import "./Sidebar.css";

const NAV_ITEMS = [
  { name: "Home", path: "/", icon: <MdHome /> },
  { name: "Learn", path: "/learn", icon: <MdSchool /> },
  { name: "Practice", path: "/practice", icon: <MdQuiz /> },
  { name: "Files", path: "/resources", icon: <MdFolder /> },
  { name: "Spotlights", path: "/spotlights", icon: <MdWorkspacePremium /> },
  { name: "Settings", path: "/settings", icon: <MdSettings /> },
];

export default function Sidebar({
  isOpen,
  extraItems = [],
  extraSectionTitle = "",
}) {
  const { user } = useAuth();

  const handleAuthPrompt = (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("openAuthModal", { detail: "login" }));
  };

  const renderExtraItem = (item, index) => {
    if (!item) return null;

    return (
      <button
        key={item.key || item.name || `sidebar-extra-${index}`}
        type="button"
        className={`menu-item sidebar-extra-item ${item.active ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
        onClick={() => {
          if (item.disabled) return;
          item.onClick?.();
        }}
        title={!isOpen ? item.name : undefined}
        aria-label={item.name}
        aria-pressed={item.active ? "true" : undefined}
        disabled={item.disabled}
      >
        <span className="menu-icon">{item.icon}</span>
        {isOpen && <span className="menu-label">{item.name}</span>}
        {typeof item.badge !== "undefined" && item.badge !== null && (
          <span className="menu-badge">{item.badge}</span>
        )}
      </button>
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <nav className="sidebar-menu">
        <div className="menu-section">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
              end={item.path === "/"}
              title={!isOpen ? item.name : undefined}
            >
              <span className="menu-icon">{item.icon}</span>
              {isOpen && <span className="menu-label">{item.name}</span>}
            </NavLink>
          ))}

          {extraItems.length > 0 && (
            <div className="sidebar-extra-section">
              {isOpen && extraSectionTitle && (
                <div className="sidebar-extra-title">{extraSectionTitle}</div>
              )}
              {extraItems.map(renderExtraItem)}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          {user ? (
            <div className="footer-actions">
              <div className="app-version">
                <span>Learnda v3.0</span>
              </div>
            </div>
          ) : (
            <div className="guest-footer">
              <button
                className="auth-prompt-button"
                onClick={handleAuthPrompt}
                type="button"
                title="Sign in to Learnda"
              >
                <MdPerson />
                <span>Sign in to Learnda</span>
              </button>
              <div className="app-version">
                <span>Learnda v3.0</span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
