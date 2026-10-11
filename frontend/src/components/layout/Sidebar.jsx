import { NavLink } from "react-router-dom";
import { MdLogin } from "react-icons/md";
import { useAuth } from "../../hooks/useAuth";
import { getClassLabel } from "../../constants/education";
import { getMoreNav, getPrimaryNav } from "./navItems";
import "./Sidebar.css";

function SidebarLink({ item, isOpen }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => `sidebar__link${isActive ? " is-active" : ""}`}
      title={!isOpen ? item.name : undefined}
    >
      {({ isActive }) => {
        const Icon = isActive && item.activeIcon ? item.activeIcon : item.icon;
        return (
          <>
            <span className="sidebar__icon" aria-hidden="true"><Icon /></span>
            <span className="sidebar__label">{item.name}</span>
          </>
        );
      }}
    </NavLink>
  );
}

export default function Sidebar({ isOpen }) {
  const { user } = useAuth();
  const classLabel = getClassLabel(user?.class_level);

  const openSignIn = () => {
    window.dispatchEvent(new CustomEvent("openAuthModal", { detail: "login" }));
  };

  return (
    <aside className={`sidebar ${isOpen ? "is-open" : "is-collapsed"}`} aria-label="Main">
      {classLabel && (
        <div className="sidebar__class" title={!isOpen ? classLabel : undefined}>
          <span className="sidebar__class-badge" aria-hidden="true">
            {user.class_level.replace(/^([A-Z]+)(\d)$/, "$1 $2").replace(/^B /, "B")}
          </span>
          <span className="sidebar__class-text">
            <strong>{classLabel}</strong>
            {(user.term || user.academic_year) && (
              <span>{[user.term, user.academic_year].filter(Boolean).join(" · ")}</span>
            )}
          </span>
        </div>
      )}

      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {getPrimaryNav(user).map((item) => (
            <li key={item.key}><SidebarLink item={item} isOpen={isOpen} /></li>
          ))}
        </ul>

        <span className="sidebar__divider" aria-hidden="true" />

        <ul className="sidebar__list sidebar__list--secondary">
          {getMoreNav(user).map((item) => (
            <li key={item.key}><SidebarLink item={item} isOpen={isOpen} /></li>
          ))}
        </ul>
      </nav>

      {!user && (
        <button type="button" className="sidebar__signin" onClick={openSignIn} title={!isOpen ? "Log in" : undefined}>
          <MdLogin aria-hidden="true" />
          <span className="sidebar__label">Log in</span>
        </button>
      )}

      <span className="kente-band sidebar__band" aria-hidden="true" />
    </aside>
  );
}
