import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MdHome,
  MdSchool,
  MdQuiz,
  MdFolder,
  MdSettings,
  MdRocketLaunch,
  MdWorkspacePremium,
  MdMoreHoriz,
  MdClose,
} from "react-icons/md";
import "./BottomNav.css";

const NAV_ITEMS = [
  { name: "Home", path: "/", icon: <MdHome /> },
  { name: "Learn", path: "/learn", icon: <MdSchool /> },
  { name: "Practice", path: "/practice", icon: <MdQuiz /> },
  { name: "Files", path: "/resources", icon: <MdFolder /> },
];

export default function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = [
    { name: "Eduvhibe", path: "/eduvhibe", icon: <MdRocketLaunch /> },
    { name: "Spotlights", path: "/spotlights", icon: <MdWorkspacePremium /> },
    { name: "Settings", path: "/settings", icon: <MdSettings /> },
  ];
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.path));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.name}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-more ${isMoreActive ? "active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          <span className="bottom-nav-icon"><MdMoreHoriz /></span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="bottom-nav-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div
            className="bottom-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-nav-sheet-header">
              <span>More</span>
              <button
                type="button"
                className="bottom-nav-sheet-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
              >
                <MdClose />
              </button>
            </div>
            <div className="bottom-nav-sheet-grid">
              {moreItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `bottom-nav-sheet-item ${isActive ? "active" : ""}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="bottom-nav-sheet-item-icon">{item.icon}</span>
                  <span className="bottom-nav-sheet-item-label">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
