import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck } from 'react-icons/fi';
import api from '../services/api';
import { getNotificationDisplay } from '../utils/notifications';
import PageHeader from '../components/common/PageHeader';
import './SharedPages.css';
import './Notifications.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.notifications.getAll();
      setNotifications(response?.notifications || []);
    } catch (err) {
      setError(err?.message || 'Could not load notifications right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((item) => !item.is_read) : notifications),
    [filter, notifications]
  );

  const handleMarkAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      // Non-blocking — the list just won't reflect the change until next load.
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await api.notifications.markRead(notification.id);
      } catch (err) {
        // Non-blocking.
      } finally {
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
        );
      }
    }
    if (notification.action_url) {
      if (notification.action_url.startsWith('/')) {
        navigate(notification.action_url);
      } else {
        window.location.href = notification.action_url;
      }
    }
  };

  return (
    <div className="page-shell notifications-page">
      <PageHeader icon="notifications" title="Notifications" description="Your latest updates in one place.">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleMarkAllRead}
          disabled={!unreadCount || markingAll}
        >
          <FiCheck aria-hidden /> {markingAll ? 'Marking…' : 'Mark all as read'}
        </button>
      </PageHeader>

      <div className="tab-row notifications-filter-row">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab-button ${filter === item.key ? 'active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            {item.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      <section className="notifications-page-list" aria-live="polite">
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="notification-item notifications-page-skeleton-item" aria-hidden="true">
              <span className="shimmer-block notifications-page-skeleton-line" style={{ width: '28%' }} />
              <span className="shimmer-block notifications-page-skeleton-line" style={{ width: '68%', height: '0.95rem' }} />
              <span className="shimmer-block notifications-page-skeleton-line" style={{ width: '88%' }} />
            </div>
          ))
        ) : error ? (
          <div className="page-empty-state">
            <p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={loadNotifications}>
              Try again
            </button>
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="page-empty-state">
            <FiBell className="page-empty-state__icon" aria-hidden />
            <h2>{filter === 'unread' ? "You're all caught up" : 'No notifications yet'}</h2>
            <p>
              {filter === 'unread'
                ? 'No unread notifications right now.'
                : "We'll show course updates, replies, study-group activity, and milestones here."}
            </p>
          </div>
        ) : (
          visibleNotifications.map((notification) => {
            const display = getNotificationDisplay(notification);
            return (
              <button
                key={notification.id}
                type="button"
                className={`notification-item notifications-page-item ${notification.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-topline">
                  <span className="notification-type">{display.typeLabel}</span>
                  {display.time && <span className="notification-time">{display.time}</span>}
                </div>
                <div className="notification-text">{display.title}</div>
                {display.body && (
                  <div className="notification-body notifications-page-item-body">{display.body}</div>
                )}
                {display.context && <div className="notification-context">{display.context}</div>}
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}
