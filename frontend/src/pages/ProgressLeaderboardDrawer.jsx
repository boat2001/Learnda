import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FiX } from 'react-icons/fi';
import './ProgressLeaderboardDrawer.css';
import { resolveUploadUrl } from '../services/api';
import { formatOrdinalRank } from '../utils/formatOrdinalRank';
import UserAvatar from '../components/common/UserAvatar';
import { RANK_NAMES } from '../data/rankConfig';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function easeInCubic(t) {
  return t * t * t;
}

function entryName(entry) {
  return String(entry?.user?.full_name || entry?.full_name || 'Learner').trim() || 'Learner';
}

function entryAvatar(entry) {
  const raw = entry?.user?.avatar_url || entry?.avatar_url || '';
  return raw ? resolveUploadUrl(raw) : '';
}

export default function ProgressLeaderboardDrawer({
  open,
  onClose,
  leaderboard,
  leaderboardRank,
  userId,
  loadingInitial,
  refreshLeaderboard,
}) {
  const listRef = useRef(null);
  const rowRefs = useRef(new Map());
  const hasScrolledThisOpenRef = useRef(false);
  const prevOpenRef = useRef(false);
  const prevOrderRef = useRef(null);
  const [rowMotion, setRowMotion] = useState({});

  useEffect(() => {
    if (!open) {
      prevOrderRef.current = null;
      return;
    }
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) return;

    const ids = leaderboard.map((e) => String(e.user_id));
    const prev = prevOrderRef.current;
    prevOrderRef.current = ids;

    if (!prev || prev.length === 0) return;

    const motion = {};
    ids.forEach((id, idx) => {
      const old = prev.indexOf(id);
      if (old >= 0 && old !== idx) motion[id] = old > idx ? 'up' : 'down';
    });

    if (Object.keys(motion).length > 0) {
      setRowMotion(motion);
      const t = window.setTimeout(() => setRowMotion({}), 1800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [leaderboard, open]);

  useLayoutEffect(() => {
    if (!open) {
      hasScrolledThisOpenRef.current = false;
      prevOpenRef.current = false;
      return;
    }
    if (!listRef.current || !Array.isArray(leaderboard) || leaderboard.length === 0) return;

    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;

    if (hasScrolledThisOpenRef.current && !justOpened) return;

    const el = listRef.current;
    el.scrollTop = 0;

    const uid = userId != null ? String(userId) : '';
    const row = uid ? rowRefs.current.get(uid) : null;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const target = row
      ? Math.min(
          maxScroll,
          Math.max(0, row.offsetTop - el.clientHeight / 2 + row.clientHeight / 2),
        )
      : maxScroll;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      el.scrollTop = target;
      hasScrolledThisOpenRef.current = true;
      return undefined;
    }

    const from = 0;
    const duration = 1450;
    const start = performance.now();
    let raf = 0;

    const step = (now) => {
      const raw = Math.min(1, (now - start) / duration);
      el.scrollTop = from + (target - from) * easeInCubic(raw);
      if (raw < 1) raf = requestAnimationFrame(step);
      else hasScrolledThisOpenRef.current = true;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, leaderboard, userId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setInterval(() => {
      refreshLeaderboard('global', 'weekly', { silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [open, refreshLeaderboard]);

  const setRowRef = useCallback((id, node) => {
    const key = id != null ? String(id) : '';
    if (!key) return;
    if (node) rowRefs.current.set(key, node);
    else rowRefs.current.delete(key);
  }, []);

  const inList = userId != null && leaderboard.some((e) => String(e.user_id) === String(userId));

  return (
    <div className="pg-lb-drawer-inner">
      <header className="pg-lb-drawer-header">
        <div>
          <h2 className="pg-lb-drawer-title">Leaderboard</h2>
          <p className="pg-lb-drawer-sub">Global · by total XP · top {leaderboard.length || '—'}</p>
        </div>
        <button type="button" className="pg-lb-drawer-close" onClick={onClose} aria-label="Close leaderboard">
          <FiX aria-hidden />
        </button>
      </header>

      <div className="pg-lb-drawer-body">
        {loadingInitial && leaderboard.length === 0 ? (
          <ul className="pg-lb-list pg-lb-list--skeleton" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="pg-lb-row pg-lb-row--skeleton">
                <span className="pg-lb-skel-rank" />
                <span className="pg-lb-skel-avatar" />
                <span className="pg-lb-skel-text" />
              </li>
            ))}
          </ul>
        ) : (
          <ul ref={listRef} className="pg-lb-list" role="list">
            {leaderboard.map((entry, index) => {
              const rank = entry.rank != null ? Number(entry.rank) : index + 1;
              const id = String(entry.user_id);
              const isYou = userId != null && String(userId) === id;
              const motion = rowMotion[id];
              const medal = MEDALS[rank] || null;
              const avatar = entryAvatar(entry);
              const name = entryName(entry);

              return (
                <li
                  key={id}
                  ref={(node) => setRowRef(entry.user_id, node)}
                  className={[
                    'pg-lb-row',
                    isYou ? 'pg-lb-row--you' : '',
                    motion === 'up' ? 'pg-lb-row--moved-up' : '',
                    motion === 'down' ? 'pg-lb-row--moved-down' : '',
                    rank <= 3 ? 'pg-lb-row--podium' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="pg-lb-rank" aria-label={`Rank ${formatOrdinalRank(rank)}`}>
                    {medal ? (
                      <span className="pg-lb-medal" title={`${formatOrdinalRank(rank)} place`}>
                        {medal}
                      </span>
                    ) : null}
                    <span className="pg-lb-ordinal">{formatOrdinalRank(rank)}</span>
                  </div>
                  <div className="pg-lb-user">
                    <div className="pg-lb-avatar">
                      <UserAvatar src={avatar} name={name} />
                    </div>
                    <div className="pg-lb-user-meta">
                      <div className="pg-lb-name">
                        {name}
                        {isYou ? <span className="pg-lb-you">You</span> : null}
                      </div>
                      <div className="pg-lb-stats-line">
                        <span>{Number(entry.xp || 0).toLocaleString()} XP</span>
                        <span className="pg-lb-dot">·</span>
                        <span>{RANK_NAMES[Number(entry.level || 1)] || 'Newcomer'}</span>
                        <span className="pg-lb-dot">·</span>
                        <span>{Number(entry.streak || 0)} streak</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loadingInitial && userId != null && !inList && leaderboardRank != null && (
          <p className="pg-lb-footnote" role="status">
            You are <strong>{formatOrdinalRank(leaderboardRank)}</strong> overall — outside this live
            top {leaderboard.length} list.
          </p>
        )}
      </div>
    </div>
  );
}
