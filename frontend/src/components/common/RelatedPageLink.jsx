import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiHeart, FiUsers, FiZap, FiMap, FiBriefcase, FiMessageCircle, FiShield, FiBookOpen } from 'react-icons/fi';
import './RelatedPageLink.css';

const icons = {
  support: FiHeart, join: FiUsers, idea: FiZap, roadmap: FiMap, partnership: FiBriefcase,
  contact: FiMessageCircle, privacy: FiShield, manual: FiBookOpen,
};

// "Where next?" card at the bottom of an info page.
export default function RelatedPageLink({ to, title, description, icon = 'idea' }) {
  const Icon = icons[icon] || FiZap;
  return (
    <Link to={to} className="related-page-link">
      <span className="related-page-link__icon" aria-hidden="true"><Icon /></span>
      <span className="related-page-link__copy">
        <span className="related-page-link__title">{title}</span>
        {description && <span className="related-page-link__description">{description}</span>}
      </span>
      <FiArrowUpRight className="related-page-link__arrow" aria-hidden="true" />
    </Link>
  );
}
