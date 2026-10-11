import {
  FiMap, FiTrendingUp, FiAward, FiBarChart2, FiTarget, FiBookOpen,
  FiEdit3, FiMessageCircle, FiHeart, FiCheckCircle, FiCalendar,
  FiUsers, FiBriefcase, FiShare2, FiShield, FiLock, FiStar,
  FiFileText, FiFolder, FiHelpCircle, FiSmile, FiHome,
} from 'react-icons/fi';

const icons = {
  journey: FiMap, impact: FiTrendingUp, award: FiAward,
  rankings: FiBarChart2, criteria: FiTarget, articles: FiBookOpen,
  create: FiEdit3, contact: FiMessageCircle, support: FiHeart,
  plans: FiCheckCircle, events: FiCalendar, community: FiUsers,
  business: FiBriefcase, social: FiShare2, privacy: FiShield,
  security: FiLock, stories: FiStar, terms: FiFileText,
  resources: FiFolder, kids: FiSmile, school: FiHome, help: FiHelpCircle,
};

export default function SectionHeadingIcon({ name }) {
  const Icon = icons[name] || FiHelpCircle;
  return <span className="section-heading__icon" aria-hidden="true"><Icon /></span>;
}
