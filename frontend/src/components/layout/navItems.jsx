// One navigation model for the sidebar (tablet/desktop) and the bottom bar
// (phone), so the two can never drift apart. §9: Home, Learn, Practice,
// My Space, More.
import {
  MdHome,
  MdOutlineHome,
  MdMenuBook,
  MdOutlineMenuBook,
  MdEditNote,
  MdBackpack,
  MdOutlineBackpack,
  MdInsights,
  MdFolderOpen,
  MdSettings,
  MdHelpOutline,
} from "react-icons/md";
import { isFeatureEnabled } from "../../constants/education";

const PRIMARY_ITEMS = [
  { key: "home", name: "Home", path: "/", icon: MdOutlineHome, activeIcon: MdHome, end: true },
  { key: "learn", name: "Learn", path: "/learn", icon: MdOutlineMenuBook, activeIcon: MdMenuBook },
  { key: "practice", name: "Practice", path: "/practice", icon: MdEditNote, activeIcon: MdEditNote, feature: "quizzes" },
  { key: "my-space", name: "My Space", path: "/my-space", icon: MdOutlineBackpack, activeIcon: MdBackpack },
];

const MORE_ITEMS = [
  { key: "progress", name: "My progress", path: "/progress", icon: MdInsights, requiresAuth: true },
  { key: "files", name: "Notes & past questions", shortName: "Notes", path: "/resources", icon: MdFolderOpen },
  { key: "settings", name: "Settings", path: "/settings", icon: MdSettings },
  { key: "help", name: "Help", path: "/user-manual", icon: MdHelpOutline },
];

/**
 * A feature-gated item is shown only when the learner's level allows it (§7).
 * Guests have no level yet, so they see the full set.
 */
const allowed = (item, user) => {
  if (item.requiresAuth && !user) return false;
  if (!item.feature || !user?.level_group) return true;
  return isFeatureEnabled(item.feature, user.level_group);
};

export const getPrimaryNav = (user) => PRIMARY_ITEMS.filter((item) => allowed(item, user));
export const getMoreNav = (user) => MORE_ITEMS.filter((item) => allowed(item, user));
