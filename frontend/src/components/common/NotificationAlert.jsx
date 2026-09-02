import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './NotificationAlert.css';

const POLL_MS = 30_000;
const SEEN_KEY_PREFIX = 'sharether_last_notif_ts';
const AUTO_DISMISS_MS = 7000;
const WELCOME_NOTIFICATION_TYPE = 'welcome_signup';

const isWelcomeNotification = (notification) =>
  notification?.type === WELCOME_NOTIFICATION_TYPE;

export default function NotificationAlert() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const timerRefs = useRef({});

  const hide = useCallback((id) => {
    clearTimeout(timerRefs.current[id]);
    delete timerRefs.current[id];
    setQueue((q) => q.filter((n) => n.id !== id));
  }, []);

  const dismiss = useCallback((id) => {
    hide(id);
    api.notifications.markRead(id).catch(() => {});
  }, [hide]);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.notifications.getAll();
      if (!res?.success) return;

      const seenKey = `${SEEN_KEY_PREFIX}:${user.id}`;
      const lastSeenTs = Number(localStorage.getItem(seenKey) || 0);
      const fresh = (res.notifications || []).filter((n) => {
        if (n.is_read) return false;
        if (isWelcomeNotification(n)) return true;
        const ts = new Date(n.created_at || n.createdAt || 0).getTime();
        return ts > lastSeenTs;
      });

      if (fresh.length === 0) return;

      const latest = Math.max(...fresh.map((n) => new Date(n.created_at || n.createdAt || 0).getTime()));
      localStorage.setItem(seenKey, String(latest));

      setQueue((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        return [...prev, ...fresh.filter((n) => !existingIds.has(n.id))].slice(-5);
      });
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, poll]);

  useEffect(() => {
    queue.forEach((n) => {
      if (isWelcomeNotification(n)) return;
      if (!timerRefs.current[n.id]) {
        // Hiding a toast is not the same as reading the notification. Keep it
        // unread in the notification center until the user explicitly opens it.
        timerRefs.current[n.id] = setTimeout(() => hide(n.id), AUTO_DISMISS_MS);
      }
    });
  }, [queue, hide]);

  useEffect(() => () => {
    Object.values(timerRefs.current).forEach(clearTimeout);
    timerRefs.current = {};
  }, []);

  const welcomeNotification = queue.find(isWelcomeNotification);
  const toastQueue = queue.filter((n) => !isWelcomeNotification(n));

  useEffect(() => {
    if (!welcomeNotification) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        dismiss(welcomeNotification.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss, welcomeNotification]);

  if (!queue.length) return null;

  return (
    <>
      {welcomeNotification ? (
        <div className="notif-welcome-overlay" role="presentation">
          <div
            className="notif-welcome"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-welcome-title"
            aria-describedby="notif-welcome-body"
          >
            <button
              type="button"
              className="notif-welcome__close"
              onClick={() => dismiss(welcomeNotification.id)}
              aria-label="Close welcome message"
            >
              x
            </button>
            <p className="notif-welcome__eyebrow">Sharether Learning Platform</p>
            <h2 id="notif-welcome-title" className="notif-welcome__title">
              {(welcomeNotification.title || 'Welcome to Sharether v3.0').replace(/,\s*.+$/, '')}
            </h2>
            {welcomeNotification.body ? (
              <p id="notif-welcome-body" className="notif-welcome__body">
                {welcomeNotification.body}
              </p>
            ) : null}
            <button
              type="button"
              className="notif-welcome__cta"
              onClick={() => dismiss(welcomeNotification.id)}
            >
              Feel at home
            </button>
          </div>
        </div>
      ) : null}

      {toastQueue.length ? (
        <div className="notif-alert-stack" aria-live="polite" aria-label="Notifications">
          {toastQueue.map((n) => (
            <div key={n.id} className="notif-alert">
              <div className="notif-alert__icon">!</div>
              <div className="notif-alert__body">
                <p className="notif-alert__title">{n.title || 'Sharether'}</p>
                {n.body ? <p className="notif-alert__text">{n.body}</p> : null}
              </div>
              <button
                type="button"
                className="notif-alert__close"
                onClick={() => dismiss(n.id)}
                aria-label="Dismiss notification"
              >
                x
              </button>
              <div
                className="notif-alert__progress"
                style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
