const STORAGE_KEY = 'sharether_guest_daily_content_views_v1';
const DAILY_LIMIT_PER_TYPE = 2;

const pad = (value) => String(value).padStart(2, '0');

const getLocalDateKey = (date = new Date()) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const normalizeContentType = (contentType) =>
  String(contentType || 'content')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const formatContentTypeLabel = (contentType) => {
  const normalized = normalizeContentType(contentType).replace(/_/g, ' ');
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const getFreshStore = () => ({
  date: getLocalDateKey(),
  views: {}
});

const readStore = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getFreshStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getFreshStore();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getFreshStore();
    }

    const today = getLocalDateKey();
    if (parsed.date !== today) {
      return getFreshStore();
    }

    return {
      date: today,
      views: parsed.views && typeof parsed.views === 'object' ? parsed.views : {}
    };
  } catch (error) {
    return getFreshStore();
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    // Fail open: do not block access if storage write fails.
  }
};

export const consumeGuestContentView = ({ isAuthenticated, contentType, contentId }) => {
  const typeKey = normalizeContentType(contentType);
  const typeLabel = formatContentTypeLabel(typeKey);

  if (isAuthenticated) {
    return {
      allowed: true,
      typeKey,
      typeLabel,
      limit: DAILY_LIMIT_PER_TYPE
    };
  }

  const store = readStore();
  const seenIds = Array.isArray(store.views[typeKey]) ? store.views[typeKey].map(String) : [];
  const normalizedId = contentId == null ? null : String(contentId);

  // Allow re-opening the exact same content without consuming extra quota.
  if (normalizedId && seenIds.includes(normalizedId)) {
    return {
      allowed: true,
      typeKey,
      typeLabel,
      limit: DAILY_LIMIT_PER_TYPE,
      used: seenIds.length,
      alreadyViewed: true
    };
  }

  if (seenIds.length >= DAILY_LIMIT_PER_TYPE) {
    return {
      allowed: false,
      typeKey,
      typeLabel,
      limit: DAILY_LIMIT_PER_TYPE,
      used: seenIds.length
    };
  }

  seenIds.push(normalizedId || `anonymous-${Date.now()}`);
  store.views[typeKey] = seenIds;
  writeStore(store);

  return {
    allowed: true,
    typeKey,
    typeLabel,
    limit: DAILY_LIMIT_PER_TYPE,
    used: seenIds.length
  };
};

export const buildGuestLimitMessage = (typeLabel) => (
  `You have used today's free ${typeLabel} view as a guest. Sign up to enjoy more content.`
);

