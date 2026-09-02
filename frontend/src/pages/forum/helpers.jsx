import { CHAT_SIDE_PANEL_MOBILE_MQ } from '../../hooks/useChatSidePanelMobileLayout';

export const PANEL_PREVIEW_LIMIT = Number.MAX_SAFE_INTEGER;
export const COMMUNITY_DESKTOP_SIDE_PANELS_MQ = '(min-width: 901px)';

const LINK_TOKEN_RE = /\[LINK:([^\]]+)\]/g;

export function renderMessageBody(body) {
  const parts = [];
  let last = 0;
  let match;
  LINK_TOKEN_RE.lastIndex = 0;
  while ((match = LINK_TOKEN_RE.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <span key={match.index} className="sgr-bubble__disabledLink" title="External links are disabled for member security">
        🔒 {match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.length > 1 ? parts : body;
}

export const communityPanelsOpenByLayoutDefault = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(COMMUNITY_DESKTOP_SIDE_PANELS_MQ).matches;
};

export const isCommunityChatMobileOverlay = () =>
  typeof window !== 'undefined' && window.matchMedia(CHAT_SIDE_PANEL_MOBILE_MQ).matches;

export function messageTimestamp(message) {
  const raw = message?.created_at ?? message?.createdAt ?? null;
  return raw != null ? String(raw) : '';
}

export function formatRecordingTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function messageTimeTitle(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return undefined;
  const datePart = d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  return `${datePart} · ${formatMessageTime(dateStr)}`;
}

export function communityMessageAuthorId(message) {
  const author = message?.author;
  if (author?.id != null) return String(author.id);
  if (message?.user_id != null) return String(message.user_id);
  if (message?.userId != null) return String(message.userId);
  return '';
}

export function localDayKey(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function chatDayDividerLabel(dayKey) {
  if (!dayKey) return '';
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const m = parts[1] - 1;
  const day = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return '';

  const thatStart = new Date(y, m, day);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (thatStart.getTime() === todayStart.getTime()) return 'Today';
  if (thatStart.getTime() === yesterdayStart.getTime()) return 'Yesterday';

  const sameYear = y === now.getFullYear();
  return thatStart.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function getEmojiOnlyClusterCount(body) {
  const raw = String(body ?? '').normalize('NFC').trim();
  if (!raw) return null;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const { segment } of segmenter.segment(raw)) {
      if (/^\s+$/u.test(segment)) continue;
      const condensed = segment.replace(/\s+/gu, '');
      if (!condensed) continue;
      if (!/\p{Extended_Pictographic}/u.test(segment)) return null;
      count += 1;
    }
    return count > 0 ? count : null;
  }

  const collapsed = raw.replace(/\s+/gu, '');
  if (!collapsed.length) return null;
  if (!/^[\p{Extended_Pictographic}️‍]+$/u.test(collapsed)) return null;
  const pictos = collapsed.match(/\p{Extended_Pictographic}/gu);
  return pictos && pictos.length ? pictos.length : null;
}

export function emojiBubbleTierFromCount(count) {
  if (!count) return null;
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 4;
  if (count === 5) return 5;
  return 6;
}
