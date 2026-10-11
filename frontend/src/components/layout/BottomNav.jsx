import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MdMoreHoriz, MdClose } from "react-icons/md";
import { useAuth } from "../../hooks/useAuth";
import { getMoreNav, getPrimaryNav } from "./navItems";
import "./BottomNav.css";

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = getPrimaryNav(user);
  const moreItems = getMoreNav(user);
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.path));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        {primaryItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `bottom-nav__item${isActive ? " is-active" : ""}`}
          >
            {({ isActive }) => {
              const Icon = isActive && item.activeIcon ? item.activeIcon : item.icon;
              return (
                <>
                  <span className="bottom-nav__icon" aria-hidden="true"><Icon /></span>
                  <span className="bottom-nav__label">{item.name}</span>
                </>
              );
            }}
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav__item${isMoreActive ? " is-active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <span className="bottom-nav__icon" aria-hidden="true"><MdMoreHoriz /></span>
          <span className="bottom-nav__label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="bottom-sheet__overlay" onClick={() => setMoreOpen(false)}>
          <div
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet__head">
              <span className="bottom-sheet__grip" aria-hidden="true" />
              <h2>More</h2>
              <button
                type="button"
                className="bottom-sheet__close"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
              >
                <MdClose aria-hidden="true" />
              </button>
            </div>
            <ul className="bottom-sheet__list">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => `bottom-sheet__link${isActive ? " is-active" : ""}`}
                    >
                      <span className="bottom-sheet__icon" aria-hidden="true"><Icon /></span>
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
