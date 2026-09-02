import { getUserDisplayContact } from '../../utils/displayContact';

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function FormContactIdentity({ user, label = 'My contact' }) {
  const displayName = getDisplayName(user);
  const displayContact = getUserDisplayContact(user);
  const avatarChar = (displayName || displayContact || '?')[0]?.toUpperCase();

  return (
    <div className="form-row">
      <label>{label}</label>
      <div className="fm-identity-strip">
        <div className="fm-identity-avatar">{avatarChar}</div>
        <div className="fm-identity-info">
          <span className="fm-identity-name">{displayName || 'You'}</span>
          {displayContact && <span className="fm-identity-email">{displayContact}</span>}
        </div>
      </div>
    </div>
  );
}
