import {
  PLACEHOLDER_MODE,
  placeholderContentApi,
  placeholderResourcesApi,
  placeholderCoursesApi,
} from "./placeholderData";
import { getGoogleOAuthRedirectUri } from "./googleIdentityService";

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const getCandidateBaseUrls = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((candidate) => normalizeBaseUrl(candidate))
    .filter(Boolean);

const selectApiBaseUrl = (rawValue) => {
  const candidates = getCandidateBaseUrls(rawValue);
  if (!candidates.length) return '';
  if (candidates.length === 1 || typeof window === 'undefined') return candidates[0];

  const browserHost = String(window.location?.hostname || '').trim().toLowerCase();
  if (browserHost) {
    const directMatch = candidates.find((candidate) => {
      try {
        return new URL(candidate).hostname.toLowerCase() === browserHost;
      } catch (_error) {
        return false;
      }
    });
    if (directMatch) return directMatch;
  }

  const preferLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(browserHost);
  const localhostCandidate = candidates.find((candidate) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(candidate));
  const networkCandidate = candidates.find((candidate) => !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(candidate));

  if (preferLocalhost && localhostCandidate) return localhostCandidate;
  return networkCandidate || localhostCandidate || candidates[0];
};

const API_BASE_URL = selectApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
if (!API_BASE_URL && !PLACEHOLDER_MODE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.refreshPromise = null;
    this.responseCache = new Map();
  }

  setToken(token) {
    this.token = token;
    this.invalidateCache();
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders(contentType = 'application/json') {
    const headers = {
      'Accept': 'application/json',
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  cloneCacheValue(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  getCacheKey(endpoint, method = 'GET', responseType = 'json') {
    return `${method}:${responseType}:${this.token || 'guest'}:${endpoint}`;
  }

  getCachedResponse(cacheKey, allowStale = false) {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      if (!allowStale) {
        this.responseCache.delete(cacheKey);
        return null;
      }
      // Return stale value (caller responsible for background revalidation)
      return { value: this.cloneCacheValue(cached.value), stale: true };
    }
    return { value: this.cloneCacheValue(cached.value), stale: false };
  }

  setCachedResponse(cacheKey, value, cacheTtlMs) {
    if (!cacheKey || !cacheTtlMs) return;
    this.responseCache.set(cacheKey, {
      value: this.cloneCacheValue(value),
      expiresAt: Date.now() + cacheTtlMs,
    });
  }

  // Warm the cache for a GET endpoint without blocking the caller.
  prefetch(endpoint, cacheTtlMs = 60000) {
    const cacheKey = this.getCacheKey(endpoint, 'GET', 'json');
    const cached = this.getCachedResponse(cacheKey, false);
    if (cached !== null) return; // already fresh
    this.request(endpoint, { cacheTtlMs, silent: true, allowFailure: true }).catch(() => {});
  }

  invalidateCache(patterns = []) {
    if (!patterns.length) {
      this.responseCache.clear();
      return;
    }

    for (const key of this.responseCache.keys()) {
      if (patterns.some((pattern) => key.includes(pattern))) {
        this.responseCache.delete(key);
      }
    }
  }

  async refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      const nextToken = data.accessToken || data.token;
      if (response.ok && nextToken) {
        this.setToken(nextToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return nextToken;
      }

      throw new Error(data.error || data.message || 'Token refresh failed');
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async request(endpoint, options = {}) {
    const {
      _retry,
      silent = false,
      allowFailure = false,
      responseType = 'json',
      cacheTtlMs = 0,
      staleWhileRevalidate = false,
      ...requestOptions
    } = options;
    const url = `${API_BASE_URL}${endpoint}`;
    const isRefreshRequest = endpoint === '/auth/refresh';
    const hadSession = Boolean(this.token || localStorage.getItem('refreshToken'));
    const requestMethod = String(requestOptions.method || 'GET').toUpperCase();
    const canUseCache =
      requestMethod === 'GET' &&
      responseType === 'json' &&
      !requestOptions.body &&
      cacheTtlMs > 0 &&
      !isRefreshRequest;
    const cacheKey = canUseCache ? this.getCacheKey(endpoint, requestMethod, responseType) : null;

    if (cacheKey) {
      const hit = this.getCachedResponse(cacheKey, staleWhileRevalidate);
      if (hit !== null) {
        if (!hit.stale) return hit.value;
        // Stale-while-revalidate: return stale data immediately, refresh in background
        this.request(endpoint, { ...options, staleWhileRevalidate: false, _retry: false })
          .catch(() => {});
        return hit.value;
      }
    }
    
    const defaultOptions = {
      headers: this.getHeaders(),
      credentials: 'include',
    };

    const config = {
      ...defaultOptions,
      ...requestOptions,
      headers: {
        ...defaultOptions.headers,
        ...requestOptions.headers,
      },
    };

    if (requestOptions.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      let data;
      let hasParsedJson = false;

      const buildRequestError = (message, payload = {}, status = response.status) => {
        const error = new Error(message);
        error.status = status;
        error.data = payload;
        return error;
      };

      const readJsonBody = async () => {
        if (hasParsedJson) return data;
        hasParsedJson = true;
        data = await response.json().catch(() => ({}));
        return data;
      };

      if (response.status === 304) {
        const cached = cacheKey ? this.getCachedResponse(cacheKey, true) : null;
        if (cached !== null) return cached.value;
        throw buildRequestError('No cached response available', {}, response.status);
      }
      
      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (!_retry && !isRefreshRequest) {
          try {
            const nextToken = await this.refreshAccessToken();
            if (nextToken) {
              return this.request(endpoint, { ...requestOptions, _retry: true });
            }
          } catch (error) {
            console.error('Token refresh error:', error);
          }
        }

        const errorData = await readJsonBody();
        const errorMessage = errorData.error || errorData.message || 'Authentication required';
        const isSessionError = /session expired|invalid authentication token|authentication required|invalid refresh token|session replaced/i.test(
          String(errorMessage).toLowerCase()
        );
        const isDeviceConflict = /session replaced/i.test(String(errorMessage));

        if (isSessionError) {
          if (hadSession) {
            this.setToken(null);
            localStorage.removeItem('user');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('auth-storage');
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sessionExpired', {
              detail: isDeviceConflict ? { reason: 'device_conflict' } : {}
            }));
          }
          return null;
        }

        throw buildRequestError(errorMessage, errorData, response.status);
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        const errorData = await readJsonBody();
        throw buildRequestError(errorData.error || errorData.message || 'Access denied', errorData, response.status);
      }

      // Handle 404 Not Found
      if (response.status === 404) {
        const errorData = await readJsonBody();
        throw buildRequestError(errorData.error || errorData.message || 'Resource not found', errorData, response.status);
      }

      // Handle 500 Internal Server Error
      if (response.status >= 500) {
        const errorData = await readJsonBody();
        throw buildRequestError(errorData.error || errorData.message || 'Server error occurred', errorData, response.status);
      }

      if (responseType === 'blob') {
        data = await response.blob();
      } else {
        data = await readJsonBody();
      }
      
      if (!response.ok) {
        const errorMessage = responseType === 'blob'
          ? 'Request failed'
          : (data.error || data.message || 'Request failed');
          throw buildRequestError(errorMessage, data, response.status);
      }

      if (cacheKey) {
        this.setCachedResponse(cacheKey, data, cacheTtlMs);
      }

      return data;
    } catch (error) {
      if (!silent) {
        console.error('API Request Error:', error);
      }
      if (allowFailure) {
        return null;
      }
      throw error;
    }
  }

  // Auth endpoints
  auth = {
    login: (emailOrPayload, password) => {
      const payload = typeof emailOrPayload === 'object' && emailOrPayload !== null
        ? emailOrPayload
        : { email: emailOrPayload, password };
      return this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    register: (userData) => 
      this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),

    resendRegisterOtp: (payload) =>
      this.request('/auth/register/resend-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    checkRegisterOtp: (payload) =>
      this.request('/auth/register/check-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    verifyRegisterOtp: (payload) =>
      this.request('/auth/register/verify-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getRegistrationAcademicCatalog: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/auth/register/academic-catalog${query ? `?${query}` : ''}`);
    },

    getRegistrationSession: (payload) => {
      const query = new URLSearchParams(payload || {}).toString();
      return this.request(`/auth/register/session${query ? `?${query}` : ''}`);
    },

    uploadRegistrationAvatar: (formData) =>
      this.request('/auth/register/avatar', {
        method: 'POST',
        body: formData,
      }),

    updateRegistrationProfile: (payload) =>
      this.request('/auth/register/profile', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    selectRegistrationPlan: (payload) =>
      this.request('/auth/register/select-plan', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    checkoutRegistration: (payload) =>
      this.request('/auth/register/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...(payload || {}),
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { callback_base: window.location.origin }
            : {}),
        }),
      }),

    verifyRegistrationPayment: (payload) =>
      this.request('/auth/register/verify-payment', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    googleLogin: (googlePayload) => {
      const payload =
        typeof googlePayload === 'string'
          ? { idToken: googlePayload }
          : { ...(googlePayload || {}) };

      if (
        typeof window !== 'undefined' &&
        (payload.authorizationCode || payload.code) &&
        !payload.redirectUri
      ) {
        payload.redirectUri = getGoogleOAuthRedirectUri() || window.location.origin;
      }

      return this.request('/auth/google', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    logout: () => 
      this.request('/auth/logout', {
        method: 'POST',
      }),

    refreshToken: (refreshToken) => 
      this.request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    verifyEmail: (token) => 
      this.request(`/auth/verify-email/${token}`, {
        method: 'POST',
      }),

    forgotPassword: (email) => 
      this.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    forgotPasswordOtp: (email) =>
      this.request('/auth/forgot-password/otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token, newPassword) => 
      this.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),

    resetPasswordWithOtp: (payload) =>
      this.request('/auth/reset-password/otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

  // User endpoints
  user = {
    getProfile: () => 
      this.request('/auth/profile'),

    updateProfile: (userData) => 
      this.request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),

    updateAvatar: (formData) => 
      this.request('/user/avatar', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      }),

    getPreferences: () => 
      this.request('/user/preferences'),

    updatePreferences: (preferences) => 
      this.request('/user/preferences', {
        method: 'POST',
        body: JSON.stringify(preferences),
      }),

    changePassword: (currentPassword, newPassword) => 
      this.request('/user/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    deleteAccount: () => 
      this.request('/user/account', {
        method: 'DELETE',
      }),
  };

  // Content endpoints
  content = {
    // Content retrieval
    getAll: (params = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderContentApi.getAll(params);
      }
      const query = new URLSearchParams(params).toString();
      return this.request(`/content?${query}`, { cacheTtlMs: 60000, staleWhileRevalidate: true });
    },

    getById: (id) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getById(id)
        : this.request(`/content/${id}`, { cacheTtlMs: 120000, staleWhileRevalidate: true }),

    getShareCard: (contentId) =>
      PLACEHOLDER_MODE
        ? Promise.reject(new Error('Share card endpoint unavailable in placeholder mode'))
        : this.request(`/content/${contentId}/share-card`, {
            responseType: 'blob',
          }),

    getFeatured: () =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getFeatured()
        : this.request('/content/featured', { cacheTtlMs: 600000, staleWhileRevalidate: true }),

    getTrending: () =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getTrending()
        : this.request('/content/trending', { cacheTtlMs: 600000, staleWhileRevalidate: true }),

    getFavorites: () =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getFavorites()
        : this.request('/content/favorites'),

    getPersonalized: (userId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getPersonalized(userId)
        : this.request(`/content/personalized/${userId}`, { silent: true }),

    search: (query, filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderContentApi.search(query, filters);
      }
      const params = new URLSearchParams({ q: query, ...filters }).toString();
      return this.request(`/content/search?${params}`);
    },

    // Content interactions
    like: (contentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.like(contentId)
        : this.request(`/content/${contentId}/like`, {
            method: 'POST',
          }),

    share: (contentId) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, shared: true })
        : this.request(`/content/${contentId}/share`, {
            method: 'POST',
          }),

    save: (contentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.save(contentId)
        : this.request(`/content/${contentId}/save`, {
            method: 'POST',
          }),

    complete: (contentId, payloadOrDuration = 0) => {
      const payload =
        payloadOrDuration && typeof payloadOrDuration === 'object'
          ? {
              duration: Number(payloadOrDuration.duration ?? payloadOrDuration.duration_seconds ?? 0) || 0,
              ...payloadOrDuration,
            }
          : { duration: Number(payloadOrDuration || 0) || 0 };

      if (PLACEHOLDER_MODE) {
        return placeholderContentApi.complete(contentId, payload);
      }

      return this.request(`/content/${contentId}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((response) => {
        this.invalidateCache(['/content/', '/courses/current', '/courses/', '/pls']);
        return response;
      });
    },

    getInteractions: (contentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getInteractions(contentId)
        : this.request(`/content/${contentId}/interactions`),

    trackView: (contentId, payloadOrDuration, progress = 0) => {
      const payload =
        payloadOrDuration && typeof payloadOrDuration === 'object'
          ? {
              duration: Number(payloadOrDuration.duration ?? payloadOrDuration.duration_seconds ?? 0) || 0,
              progress: Number(payloadOrDuration.progress ?? payloadOrDuration.progress_percentage ?? 0) || 0,
              ...payloadOrDuration,
            }
          : {
              duration: Number(payloadOrDuration || 0) || 0,
              progress: Number(progress || 0) || 0,
            };

      if (PLACEHOLDER_MODE) {
        return placeholderContentApi.trackView(contentId, payload);
      }

      return this.request(`/content/${contentId}/track-view`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((response) => {
        this.invalidateCache(['/content/', '/courses/current', '/courses/', '/pls']);
        return response;
      });
    },

    react: (contentId, emoji) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, reaction_counts: { [emoji]: 1 }, user_reactions: [emoji] })
        : this.request(`/content/${contentId}/react`, {
            method: 'POST',
            body: JSON.stringify({ emoji }),
          }),

    // Comments
    getComments: (contentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getComments(contentId)
        : this.request(`/content/${contentId}/comments`),

    addComment: (contentId, content) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.addComment(contentId, content)
        : this.request(`/content/${contentId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content }),
          }),

    deleteComment: (commentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.deleteComment(commentId)
        : this.request(`/comments/${commentId}`, {
            method: 'DELETE',
          }),

    upvoteComment: (commentId) =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.upvoteComment(commentId)
        : this.request(`/comments/${commentId}/upvote`, {
            method: 'POST',
          }),

    // Content management (for contributors/admins)
    upload: (formData) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({
            success: true,
            contentId: `placeholder-upload-${Date.now()}`,
            message: 'Placeholder mode active. Content is not persisted.',
          })
        : this.request('/content/upload', {
            method: 'POST',
            body: formData,
            headers: {}, // Let browser set content-type for FormData
          }),

    create: (contentData) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, content: { ...contentData, id: `placeholder-${Date.now()}` } })
        : this.request('/content', {
            method: 'POST',
            body: JSON.stringify(contentData),
          }),

    update: (contentId, contentData) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, contentId, content: contentData })
        : this.request(`/content/${contentId}`, {
            method: 'PUT',
            body: JSON.stringify(contentData),
          }),

    delete: (contentId) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, contentId })
        : this.request(`/content/${contentId}`, {
            method: 'DELETE',
          }),

    getMyContent: () =>
      PLACEHOLDER_MODE
        ? placeholderContentApi.getAll()
        : this.request('/content/my-content'),

    // Content statistics
    getStats: (contentId) =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, stats: { total_views: 0, rating_avg: 0 } })
        : this.request(`/content/${contentId}/stats`),
  };

  contributions = {
    getMine: () =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, contributions: [] })
        : this.request('/contributions/mine'),
  };

  // Onboarding/session endpoints
  me = {
    get: () =>
      this.request('/me'),

    getAcademicCatalog: () =>
      this.request('/me/academic-catalog'),

    updateProfile: (payload) =>
      this.request('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    updateAcademic: (payload) =>
      this.request('/me/academic', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((response) => {
        this.invalidateCache(['/me', '/courses/current', '/study-groups/current', '/pls']);
        return response;
      }),

    markAcademicStateNoticeSeen: (key) =>
      this.request('/me/academic-state-notice/seen', {
        method: 'POST',
        body: JSON.stringify({ key }),
      }),

    updatePassword: (password) =>
      this.request('/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),

    selectPlan: (planId) =>
      this.request('/me/select-plan', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
      }),
  };

  // Admin endpoints
  admin = {
    getProfile: () =>
      this.request('/admin/me'),

    getAdmins: () =>
      this.request('/admin/admins'),

    updateAdminAccess: (id, payload) =>
      this.request(`/admin/admins/${id}/access`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    getAuditLogs: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/audit-logs${query ? `?${query}` : ''}`);
    },

    getStats: (range = '30d') =>
      this.request(`/admin/stats?range=${range}`),

    getActivity: (limit = 8) =>
      this.request(`/admin/activity?limit=${limit}`),

    getAnalytics: (range = '30d', segment = 'all') =>
      this.request(`/admin/analytics?range=${range}&segment=${segment}`),

    exportAnalytics: async (range = '30d', format = 'csv', segment = 'all') => {
      const url = `${API_BASE_URL}/admin/analytics/export?format=${format}&range=${range}&segment=${segment}`;
      const response = await fetch(url, {
        headers: this.getHeaders(null),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }
      return response.blob();
    },

    getPendingContent: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return this.request(`/admin/content/pending?${params}`);
    },

    reviewContent: (id, payload) =>
      this.request(`/admin/content/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getContent: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/content?${query}`);
    },

    getUsers: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/users?${query}`);
    },

    getRevenue: () =>
      this.request('/admin/revenue'),

    getRewardPayouts: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/reward-payouts${query ? `?${query}` : ''}`);
    },

    updateRewardPayout: (id, payload) =>
      this.request(`/admin/reward-payouts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    getContributorApplications: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/contributor-applications${query ? `?${query}` : ''}`);
    },
    decideContributorApplication: (userId, payload) =>
      this.request(`/admin/contributor-applications/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload || {}),
      }),

    getUserAnalytics: (range = '30d') =>
      this.request(`/admin/analytics/users?range=${range}`),

    getMrr: () =>
      this.request('/admin/analytics/mrr'),

    getVisits: () =>
      this.request('/admin/analytics/visits'),

    getUsageStats: (range = '30d') =>
      this.request(`/admin/analytics/usage?range=${range}`),

    getExpenses: () =>
      this.request('/admin/expenses'),

    saveExpenses: (expenses) =>
      this.request('/admin/expenses', { method: 'PUT', body: JSON.stringify({ expenses }) }),

    getMessages: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/admin/messages${query ? `?${query}` : ''}`);
    },
    updateMessageStatus: (id, status) =>
      this.request(`/admin/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    replyToMessage: (id, payload) =>
      this.request(`/admin/messages/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getAdminPlans: () => this.request('/admin/plans'),
    updateAdminPlan: (id, payload) =>
      this.request(`/admin/plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    getSiteContent: () => this.request('/site-content/admin'),
    updateSiteContent: (key, value) =>
      this.request(`/site-content/admin/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }).then((response) => {
        this.invalidateCache(['/site-content/']);
        return response;
      }),

    setUserRole: (userId, role) =>
      this.request(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    moderateUser: (userId, payload) =>
      this.request(`/admin/users/${userId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    deleteUser: (userId, payload = {}) =>
      this.request(`/admin/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
      }),

    // Applications
    getApplications: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/applications/admin${q ? `?${q}` : ''}`);
    },
    reviewApplication: (id, data) =>
      this.request(`/applications/admin/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    submitApplication: (data) =>
      this.request('/applications', { method: 'POST', body: JSON.stringify(data) }),

    // Team links & broadcast
    getTeamLinks: () =>
      this.request('/admin/team-links'),
    saveTeamLinks: (links) =>
      this.request('/admin/team-links', { method: 'PUT', body: JSON.stringify({ links }) }),
    sendTeamBroadcast: (payload) =>
      this.request('/admin/team-broadcast', { method: 'POST', body: JSON.stringify(payload) }),

    // Re-engagement
    getReengagementSettings: () => this.request('/admin/reengagement/settings'),
    saveReengagementSettings: (settings) =>
      this.request('/admin/reengagement/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    getReengagementHistory: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/admin/reengagement/history${q ? `?${q}` : ''}`);
    },
    sendReengagement: (overrides = {}) =>
      this.request('/admin/reengagement/send', { method: 'POST', body: JSON.stringify(overrides) }),

    getEngagementTipsCatalog: () => this.request('/admin/engagement-tips/catalog'),
    getEngagementTipsHistory: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/admin/engagement-tips/history${q ? `?${q}` : ''}`);
    },
    sendEngagementTips: (payload) =>
      this.request('/admin/engagement-tips/send', { method: 'POST', body: JSON.stringify(payload) }),

    // Trigger notifications
    sendTriggerNotification: (payload) =>
      this.request('/admin/notifications/trigger', { method: 'POST', body: JSON.stringify(payload) }),
    getTriggerHistory: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/admin/notifications/trigger-history${q ? `?${q}` : ''}`);
    },
    getNotificationAnalytics: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/admin/notifications/analytics${q ? `?${q}` : ''}`);
    },

    getAcademicStateInstitutions: () =>
      this.request('/admin/academic-state/institutions'),
    getAcademicStateUniversities: () =>
      this.request('/admin/academic-state/universities'),
    applyAcademicState: (payload) =>
      this.request('/admin/academic-state/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // Lecturer invites

    // Lecturers list (re-uses users endpoint with role filter)
    getLecturers: (params = {}) => {
      const q = new URLSearchParams({ ...params, role: 'lecturer' }).toString();
      return this.request(`/admin/users?${q}`);
    },

    // Social links
    getSocialLinks: () => this.request('/admin/social-links'),
    saveSocialLinks: (links) => this.request('/admin/social-links', { method: 'PUT', body: JSON.stringify({ links }) }),

    // Roadmap
    getRoadmap: () => this.request('/admin/roadmap'),
    saveRoadmap: (phases) => this.request('/admin/roadmap', { method: 'PUT', body: JSON.stringify({ phases }) }),
    getRoadmapPublic: () => this.request('/admin/roadmap/public'),

    // Services
    getServices: () => this.request('/admin/services'),
    saveServices: (services) => this.request('/admin/services', { method: 'PUT', body: JSON.stringify({ services }) }),
    getServicesPublic: () => this.request('/admin/services/public'),
  };

  // Public lecturer invite (no auth required)

  // Subscription endpoints
  subscription = {
    getPlans: (options = {}) => 
      this.request('/subscription/plans', options),

    getCurrentPlan: () =>
      this.request('/subscription/current', { cacheTtlMs: 300000, staleWhileRevalidate: true }),

    subscribe: (planId, billingCycle = 'monthly', paymentMethod = null) => 
      this.request('/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle, paymentMethod }),
      }),

    cancel: () => 
      this.request('/subscription/cancel', {
        method: 'POST',
      }),

    upgrade: (newPlanId) => 
      this.request('/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({ newPlanId }),
      }),

    getInvoices: () => 
      this.request('/subscription/invoices'),

    getPaymentMethods: () => 
      this.request('/subscription/payment-methods'),

    addPaymentMethod: (paymentMethod) => 
      this.request('/subscription/payment-methods', {
        method: 'POST',
        body: JSON.stringify(paymentMethod),
      }),

    removePaymentMethod: (paymentMethodId) => 
      this.request(`/subscription/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      }),
  };

  // Payment endpoints
  payment = {
    initialize: (planId, paymentMethod = 'paystack', durationMonths = 1) =>
      this.request('/payment/initialize', {
        method: 'POST',
        body: JSON.stringify({ planId, paymentMethod, duration_months: durationMonths }),
      }),

    initializeContribution: (payload) =>
      this.request('/payment/donations/initialize', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    verify: (reference, provider = 'paystack', planId = null) =>
      this.request('/payment/verify', {
        method: 'POST',
        body: JSON.stringify({ reference, provider, planId }),
      }),

    verifyContribution: (reference, provider = 'paystack') =>
      this.request('/payment/donations/verify', {
        method: 'POST',
        body: JSON.stringify({ reference, provider }),
      }),

    getMethods: () =>
      this.request('/payment/methods'),
  };

  billing = {
    checkout: (planId = null, durationMonths = 1, options = {}) =>
      this.request('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...(planId
            ? { plan_id: planId, duration_months: durationMonths, ...options }
            : { duration_months: durationMonths, ...options }),
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { callback_base: window.location.origin }
            : {}),
        }),
      }),
    cancelPending: () =>
      this.request('/billing/cancel-pending', {
        method: 'POST',
      }),

    extend: (days) =>
      this.request('/billing/extend', {
        method: 'POST',
        body: JSON.stringify({
          days,
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { callback_base: window.location.origin }
            : {}),
        }),
      }),

    verifyExtension: (reference, provider = 'paystack') =>
      this.request('/billing/extend/verify', {
        method: 'POST',
        body: JSON.stringify({ reference, provider }),
      }),
  };

  revenue = {
    getEarnings: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/revenue/earnings${query ? `?${query}` : ''}`);
    },
    getStats: () => this.request('/revenue/stats'),
    getPayouts: (limit = 12) => this.request(`/revenue/payouts?limit=${limit}`),
  };

  // PLS (Personal Learning Space) endpoints
  pls = {
    getDashboard: () => 
      this.request('/pls/dashboard'),

    getItems: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return this.request(`/pls/items?${params}`);
    },

    getFolders: () =>
      this.request('/pls/folders'),

    addToPLS: (contentId, type = 'course') => 
      this.request('/pls/save', {
        method: 'POST',
        body: JSON.stringify({ content_id: contentId, item_type: type }),
      }),

    removeFromPLS: (itemId) => 
      this.request(`/pls/items/${itemId}`, {
        method: 'DELETE',
      }),

    createFolder: (name) => 
      this.request('/pls/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    updateFolder: (folderId, updates) => 
      this.request(`/pls/folders/${folderId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    deleteFolder: (folderId) => 
      this.request(`/pls/folders/${folderId}`, { method: 'DELETE' }),

    moveToFolder: (itemId, folderId) => 
      this.request(`/pls/folders/${itemId}/move`, {
        method: 'POST',
        body: JSON.stringify({ folder_id: folderId, item_id: itemId }),
      }),
  };

  // Gamification endpoints
  gamification = {
    getProgress: () =>
      this.request('/gamification/progress', { cacheTtlMs: 30000, staleWhileRevalidate: true }),

    getOverview: () =>
      this.request('/gamification/overview', { cacheTtlMs: 60000 }),

    getBadges: () =>
      this.request('/gamification/badges'),

    getEarnedBadges: () => 
      this.request('/gamification/badges/earned'),

    getLeaderboard: (type = 'global', timeFrame = 'weekly') => {
      const params = new URLSearchParams({ type, timeFrame }).toString();
      return this.request(`/gamification/leaderboard?${params}`, { cacheTtlMs: 120000, staleWhileRevalidate: true });
    },

    getSpotlights: () =>
      this.request('/gamification/spotlights', { cacheTtlMs: 300000, staleWhileRevalidate: true }),

    getSpotlightCounts: (awardIds = []) =>
      this.request(
        `/gamification/spotlights/counts?ids=${awardIds.map(encodeURIComponent).join(',')}`,
        { cacheTtlMs: 15000 }
      ),

    celebrateSpotlight: ({ awardId, awardType, targetUserId }) =>
      this.request(`/gamification/spotlights/${encodeURIComponent(awardId)}/celebrate`, {
        method: 'POST',
        body: JSON.stringify({
          award_type: awardType,
          target_user_id: targetUserId,
        }),
      }),

    addXp: (amount, reason) => 
      this.request('/gamification/xp', {
        method: 'POST',
        body: JSON.stringify({ amount, reason }),
      }),

    earnBadge: (badgeId) => 
      this.request('/gamification/badges/earn', {
        method: 'POST',
        body: JSON.stringify({ badgeId }),
      }),

    getXpHistory: (limit = 50) => 
      this.request(`/gamification/xp/history?limit=${limit}`),

    shareAchievement: (achievementType, achievementId) => 
      this.request('/gamification/share', {
        method: 'POST',
        body: JSON.stringify({ achievementType, achievementId }),
      }),
  };

  // Analytics endpoints (for tracking user behavior)
  analytics = {
    trackEvent: (eventName, properties = {}) => 
      this.request('/analytics/event', {
        silent: true,
        allowFailure: true,
        method: 'POST',
        body: JSON.stringify({ eventName, properties }),
      }),

    trackPageView: (page, properties = {}) => 
      this.request('/analytics/pageview', {
        silent: true,
        allowFailure: true,
        method: 'POST',
        body: JSON.stringify({ page, properties }),
      }),

    getUsageStats: (timeRange = '30d') => 
      this.request(`/analytics/usage?range=${timeRange}`),

    getLearningStats: () => 
      this.request('/analytics/learning'),
  };

  // Resource endpoints
  resources = {
    getFiles: (filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderResourcesApi.getFiles(filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/resources/files?${params}`, { cacheTtlMs: 60000, staleWhileRevalidate: true });
    },

    trackView: (fileId) =>
      PLACEHOLDER_MODE
        ? placeholderResourcesApi.trackView(fileId)
        : this.request(`/resources/${fileId}/view`, {
            method: 'POST',
          }),

    getAccessedFileIds: () =>
      PLACEHOLDER_MODE
        ? Promise.resolve({ success: true, data: { file_ids: [] } })
        : this.request('/resources/accessed-ids', { cacheTtlMs: 30000 }),

    downloadFile: (fileId) =>
      PLACEHOLDER_MODE
        ? placeholderResourcesApi.downloadFile(fileId)
        : this.request(`/resources/download/${fileId}`, {
            responseType: 'blob',
          }),

    uploadFile: (formData) =>
      PLACEHOLDER_MODE
        ? placeholderResourcesApi.uploadFile(formData)
        : this.request('/resources/upload', {
            method: 'POST',
            body: formData,
            headers: {},
          }).then((response) => {
            this.invalidateCache(['/resources/files']);
            return response;
          }),

    deleteFile: (fileId) =>
      PLACEHOLDER_MODE
        ? placeholderResourcesApi.deleteFile(fileId)
        : this.request(`/resources/${fileId}`, {
            method: 'DELETE',
          }).then((response) => {
            this.invalidateCache(['/resources/files']);
            return response;
          }),
  };

  // Course catalog endpoints
  courses = {
    getAll: (filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderCoursesApi.getAll(filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses?${params}`, { cacheTtlMs: 60000 });
    },
    getPrograms: (filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderCoursesApi.getPrograms(filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses/programs?${params}`, { cacheTtlMs: 60000 });
    },
    getProgram: (programId, filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderCoursesApi.getProgram(programId, filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses/programs/${programId}?${params}`);
    },
    getOfferings: (filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderCoursesApi.getOfferings(filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses/offerings?${params}`);
    },
    getCurrent: (filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return Promise.resolve({
          success: true,
          data: {
            courses: [],
            academic_profile: null,
            missing_profile: true,
          },
        });
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses/current${params ? `?${params}` : ''}`, { cacheTtlMs: 120000, staleWhileRevalidate: true });
    },
    getById: (courseId) =>
      PLACEHOLDER_MODE
        ? placeholderCoursesApi.getById(courseId)
        : this.request(`/courses/${courseId}`, { cacheTtlMs: 180000, staleWhileRevalidate: true }),
    getLessons: (courseId, filters = {}) => {
      if (PLACEHOLDER_MODE) {
        return placeholderCoursesApi.getLessons(courseId, filters);
      }
      const params = new URLSearchParams(filters).toString();
      return this.request(`/courses/${courseId}/lessons?${params}`, { cacheTtlMs: 120000, staleWhileRevalidate: true });
    },
    getEnrolled: () =>
      this.request('/courses/user-enrolled', { cacheTtlMs: 60000 }),
    addEnrolled: (courseId) =>
      this.request(`/courses/user-enrolled/${courseId}`, { method: 'POST' }).then((r) => {
        this.invalidateCache(['/courses/user-enrolled', '/courses/current']);
        return r;
      }),
    removeEnrolled: (courseId) =>
      this.request(`/courses/user-enrolled/${courseId}`, { method: 'DELETE' }).then((r) => {
        this.invalidateCache(['/courses/user-enrolled', '/courses/current']);
        return r;
      }),
    getExcluded: () =>
      this.request('/courses/user-excluded', { cacheTtlMs: 60000 }),
    addExcluded: (courseId) =>
      this.request(`/courses/user-excluded/${courseId}`, { method: 'POST' }).then((r) => {
        this.invalidateCache(['/courses/user-excluded', '/courses/current']);
        return r;
      }),
    removeExcluded: (courseId) =>
      this.request(`/courses/user-excluded/${courseId}`, { method: 'DELETE' }).then((r) => {
        this.invalidateCache(['/courses/user-excluded', '/courses/current']);
        return r;
      }),
  };

  studyGroups = {
    getCurrent: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return this.request(`/study-groups/current${params ? `?${params}` : ''}`, {
        cache: 'no-store',
      });
    },
    discover: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return this.request(`/study-groups/discover${params ? `?${params}` : ''}`, {
        cache: 'no-store',
      });
    },
    getRoom: (groupId) => this.request(`/study-groups/${groupId}`, {
      cache: 'no-store',
    }),
    getMessages: (groupId, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/study-groups/${groupId}/messages${q ? `?${q}` : ''}`, {
        cache: 'no-store',
      });
    },
    postMessage: (groupId, payload) =>
      this.request(`/study-groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),
    postVoiceMessage: (groupId, formData) =>
      this.request(`/study-groups/${groupId}/messages/voice`, {
        method: 'POST',
        body: formData,
        headers: {},
      }),
    postFileMessage: (groupId, formData) =>
      this.request(`/study-groups/${groupId}/messages/file`, {
        method: 'POST',
        body: formData,
        headers: {},
      }),
    join: (groupId) =>
      this.request(`/study-groups/${groupId}/join`, {
        method: 'POST',
      }),
    leave: (groupId) =>
      this.request(`/study-groups/${groupId}/leave`, {
        method: 'POST',
      }),
  };

  // Ranking endpoints

  // Support endpoints
  support = {
    submitReport: (payload) =>
      this.request('/support/report', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getSuccessStories: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/support/success-stories${query ? `?${query}` : ''}`, {
        cacheTtlMs: 60000,
        staleWhileRevalidate: true,
      });
    },
  };

  siteContent = {
    getTeam: () => this.request('/site-content/team', { cacheTtlMs: 60000 }),
    getUpdates: () => this.request('/site-content/updates', { cacheTtlMs: 60000 }),
  };

  publicConfig = {
    get: () => this.request('/public-config', { cacheTtlMs: 60000 }),
  };


  // Notifications endpoints
  notifications = {
    getAll: () => this.request('/notifications'),
    markAllRead: () =>
      this.request('/notifications/read-all', { method: 'POST' }),
    markRead: (id) =>
      this.request(`/notifications/${id}/read`, { method: 'POST' }),
  };

  // Rewards endpoints
  rewards = {
    getSummary: () => this.request('/rewards/summary'),
    getTransactions: () => this.request('/rewards/transactions'),
    claim: (payload) =>
      this.request('/rewards/claim', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    requestPayout: (payload) =>
      this.request('/rewards/payout', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    setPayoutContact: (payload) =>
      this.request('/rewards/payout-contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    trackDownload: (payload) =>
      this.request('/rewards/referral-download', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

  // Comment endpoints
  comments = {
    upvote: (id) =>
      this.request(`/comments/${id}/upvote`, { method: 'POST' }),
    remove: (id) =>
      this.request(`/comments/${id}`, { method: 'DELETE' }),
  };

  // Community endpoints
  community = {
    getChatRoom: (opts = {}) => {
      const q = new URLSearchParams();
      if (opts.limit != null) q.set('limit', String(opts.limit));
      const s = q.toString();
      return this.request(`/community/chat-room${s ? `?${s}` : ''}`);
    },
    postChatMessage: (payload) =>
      this.request('/community/chat-room/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    postChatVoiceMessage: (formData) =>
      this.request('/community/chat-room/messages/voice', {
        method: 'POST',
        body: formData,
        headers: {},
      }),
    postChatFileMessage: (formData) =>
      this.request('/community/chat-room/messages/file', {
        method: 'POST',
        body: formData,
        headers: {},
      }),
    getPosts: () => this.request('/community/posts'),
    createPost: (payload) =>
      this.request('/community/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getPost: (id) => this.request(`/community/posts/${id}`),
    addReply: (id, payload) =>
      this.request(`/community/posts/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };
}

export const api = new ApiService();
export default api;

// Resolve a backend-relative upload URL (e.g. "/uploads/foo.webm") to an
// absolute URL using the API server's origin. R2/S3 URLs are already absolute
// and are returned unchanged.
const _apiOrigin = (() => {
  try { return new URL(API_BASE_URL).origin; } catch { return ''; }
})();
const _siteOrigin = (() => {
  try { return new URL(import.meta.env.VITE_SITE_URL || window.location.origin).origin; } catch { return ''; }
})();
export const resolveUploadUrl = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const isUploadPath = parsed.pathname.startsWith('/uploads/');
      const isKnownWebOrigin =
        parsed.origin === _siteOrigin ||
        (typeof window !== 'undefined' && parsed.origin === window.location.origin) ||
        parsed.hostname === 'learnda-web.onrender.com';

      if (isUploadPath && isKnownWebOrigin && _apiOrigin) {
        return `${_apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return url;
    }
    return url;
  }
  return _apiOrigin ? `${_apiOrigin}${url.startsWith('/') ? '' : '/'}${url}` : url;
};
