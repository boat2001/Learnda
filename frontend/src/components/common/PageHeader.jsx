// Compact page header: one icon tile, a title and a one-line description.
// Replaces the old hero + stat-grid + side panel on info and footer pages so
// the page's real content starts above the fold.
import {
  FiInfo, FiUsers, FiHeart, FiMap, FiMessageCircle, FiBarChart2,
  FiDownload, FiPlusCircle, FiCalendar, FiTrendingUp, FiUserPlus,
  FiShare2, FiBriefcase, FiShield, FiAlertCircle, FiStar, FiAward,
  FiFlag, FiFileText, FiBell, FiEdit3, FiBookOpen, FiKey, FiFolder,
} from 'react-icons/fi';
import './PageHeader.css';

const icons = {
  progress: FiTrendingUp, about: FiInfo, team: FiUsers, plans: FiHeart, roadmap: FiMap,
  contact: FiMessageCircle, rankings: FiBarChart2, support: FiHeart,
  download: FiDownload, feature: FiPlusCircle, events: FiCalendar, ambassadors: FiFlag,
  investments: FiTrendingUp, invite: FiUserPlus, join: FiUsers,
  socials: FiShare2, partnerships: FiBriefcase, privacy: FiShield,
  report: FiAlertCircle, spotlights: FiStar, stories: FiAward,
  terms: FiFileText, notifications: FiBell, blog: FiEdit3, manual: FiBookOpen,
  password: FiKey, resources: FiFolder, arena: FiAward,
};

// One logo wing colour per page, spread so pages that sit together (the
// footer groups especially) don't share a colour.
const TONES = {
  about: 'green', manual: 'amber', download: 'blue',
  partnerships: 'orange', contact: 'blue', report: 'orange',
  privacy: 'green', terms: 'amber',
  team: 'blue', roadmap: 'green', support: 'orange', plans: 'amber',
  join: 'green', events: 'orange', stories: 'amber', spotlights: 'blue',
  socials: 'orange', invite: 'green', notifications: 'blue', blog: 'orange',
  investments: 'green', feature: 'amber', password: 'blue', resources: 'green', arena: 'orange',
};

export default function PageHeader({ title, description, icon = 'about', children }) {
  const Icon = icons[icon] || FiInfo;
  return (
    <header className={`simple-page-header simple-page-header--${TONES[icon] || 'blue'}`}>
      <div className="simple-page-header__icon" aria-hidden="true"><Icon /></div>
      <div className="simple-page-header__copy">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="simple-page-header__actions">{children}</div>}
    </header>
  );
}
