import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiUser,
  FiSliders,
  FiCreditCard,
  FiSettings,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { getUserDisplayContact } from '../../utils/displayContact';
import { toDisplayName } from '../../utils/contributionPlans';
import Profile from './Profile';
import Preferences from './Preferences';
import AccountManagement from './AccountManagement';
import ConfettiOverlay from '../../components/gamification/ConfettiOverlay';
import api from '../../services/api';
import UserAvatar from '../../components/common/UserAvatar';
import { playUiSound } from '../../utils/uiSounds';
import './Settings.css';

const tabs = [
  { id: 'account', label: 'Account', icon: <FiCreditCard /> },
  { id: 'profile', label: 'Profile', icon: <FiUser /> },
  { id: 'preferences', label: 'Preferences', icon: <FiSliders /> },
];

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const displayContact = getUserDisplayContact(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [confettiActive, setConfettiActive] = useState(false);
  const confettiShownRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArriveSettings'), 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || confettiShownRef.current) return;
    api.gamification.getSpotlights().then((resp) => {
      if (!resp?.success) return;
      const isWinner =
        (resp.student?.user_id && String(resp.student.user_id) === String(user.id)) ||
        (resp.contributor?.user_id && String(resp.contributor.user_id) === String(user.id));
      if (isWinner && !confettiShownRef.current) {
        confettiShownRef.current = true;
        setConfettiActive(true);
      }
    }).catch(() => null);
  }, [isAuthenticated, user?.id]);

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab') || 'account';
    return tabs.some((item) => item.id === tab) ? tab : 'account';
  }, [searchParams]);

  if (!isAuthenticated) {
    return (
      <div className="settings-auth-required">
        <div className="auth-message">
          <h2>Settings</h2>
          <p>Sign in to manage your account settings and preferences.</p>
          <button 
            className="settings-auth-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal'))}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleTabChange = (tabId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabId);
    setSearchParams(nextParams, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return <AccountManagement />;
      case 'profile':
        return <Profile />;
      case 'preferences':
        return <Preferences />;
      default:
        return <AccountManagement />;
    }
  };

  return (
    <div className="settings-container">
      <ConfettiOverlay active={confettiActive} mode="fireworks" onDone={() => setConfettiActive(false)} />
      <div className="settings-header">
        <span className="settings-header-icon"><FiSettings /></span>
        <h1>Settings</h1>
        <p className="settings-subtitle">Control center</p>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          <div className="user-info">
            <button
              type="button"
              className="user-avatar user-avatar--clickable"
              onClick={() => handleTabChange('profile')}
              title="Edit profile photo"
            >
              <UserAvatar
                src={user.avatar_url}
                name={user.full_name}
                fallbackClassName="avatar-fallback"
              />
            </button>
            <div className="user-details">
              <h3>{user.full_name}</h3>
              <p className="user-email">{displayContact || 'No contact added'}</p>
              <p className="user-plan">Contribution plan: {toDisplayName(user.current_plan || user.subscription?.plan?.name || 'Basic Student')}</p>
            </div>
          </div>

          <div className="settings-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
                type="button"
                title={tab.label}
                aria-label={tab.label}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-main">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
