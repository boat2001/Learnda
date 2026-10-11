import { FiArrowRight, FiTrendingUp, FiBriefcase, FiAlertCircle, FiZap, FiMessageCircle } from 'react-icons/fi';
import './PrimaryPageAction.css';

const icons = { investment: FiTrendingUp, partnership: FiBriefcase, report: FiAlertCircle, wish: FiZap, contact: FiMessageCircle };

// One big obvious button for pages whose whole job is "open this form".
export default function PrimaryPageAction({ label, icon, onClick }) {
  const Icon = icons[icon] || FiZap;
  return (
    <button type="button" className="primary-page-action" onClick={onClick}>
      <span className="primary-page-action__icon" aria-hidden="true"><Icon /></span>
      <span>{label}</span>
      <FiArrowRight className="primary-page-action__arrow" aria-hidden="true" />
    </button>
  );
}
