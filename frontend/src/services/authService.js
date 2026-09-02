import api from './api';
import { ONBOARDING_STEPS, getNextOnboardingStep } from '../utils/onboarding';
import { collectClientContext } from '../utils/clientContext';
import { sanitizeAuthContact, sanitizeEmailAddress } from '../utils/authContact';

const safeTrackEvent = async (eventName, properties = {}) => {
  try {
    await api.analytics.trackEvent(eventName, properties);
  } catch (error) {
    console.error('Analytics event failed:', error);
  }
};

const normalizeAuthResponse = (response) => {
  const accessToken = response?.accessToken || response?.token || null;
  const nextStep =
    response?.next_step ||
    response?.nextStep ||
    getNextOnboardingStep(response?.user) ||
    ONBOARDING_STEPS.DONE;

  return {
    ...response,
    accessToken,
    token: accessToken,
    next_step: nextStep,
  };
};

const TRUSTED_DEVICE_TOKEN_KEY = 'trustedDeviceToken';

const persistTrustedDeviceToken = (response) => {
  const token = response?.trusted_device_token || response?.trustedDeviceToken || null;
  if (!token) return;
  localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
};

const getTrustedDeviceToken = () => localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY);

const persistSession = (response) => {
  const payload = normalizeAuthResponse(response);

  if (payload?.clear_trusted_device_token) {
    localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
  }
  persistTrustedDeviceToken(payload);

  if (!payload.success || !payload.token || !payload.user) {
    return payload;
  }

  api.setToken(payload.token);
  localStorage.setItem('user', JSON.stringify(payload.user));
  localStorage.setItem('has_registered', 'true');

  if (payload.refreshToken) {
    localStorage.setItem('refreshToken', payload.refreshToken);
  }

  return payload;
};

export const authService = {
  // Login with email and password
  login: async (email, password) => {
    try {
      const normalizedContact = sanitizeAuthContact(email);
      const response = persistSession(await api.auth.login({
        email: normalizedContact,
        password,
        trusted_device_token: getTrustedDeviceToken(),
        client_context: collectClientContext(),
      }));

      if (response.success && response.token) {
        // Track login event
        await safeTrackEvent('user_login', {
          userId: response.user.id,
          email: response.user.email,
          plan: response.user.subscription_plan,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Register new user
  register: async (userData) => {
    try {
      const normalizedUserData = {
        ...userData,
        contact: userData?.contact ? sanitizeAuthContact(userData.contact) : userData?.contact,
        email: userData?.email ? sanitizeEmailAddress(userData.email) : userData?.email,
        phone_number: userData?.phone_number ? sanitizeAuthContact(userData.phone_number, 'phone') : userData?.phone_number,
      };
      const response = persistSession(await api.auth.register({
        ...normalizedUserData,
        client_context: collectClientContext(),
      }));

      if (response.success && response.token) {
        // Track registration event
        await safeTrackEvent('user_registered', {
          userId: response.user.id,
          email: response.user.email,
          userType: response.user.role,
          hasInstitution: !!normalizedUserData.institution,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  verifyRegisterOtp: async ({ contact, otp, challenge_token, password, full_name }) => {
    try {
      const response = persistSession(
        await api.auth.verifyRegisterOtp({
          contact: sanitizeAuthContact(contact),
          otp,
          challenge_token,
          password,
          full_name: full_name ? String(full_name).trim() : undefined,
          client_context: collectClientContext(),
        })
      );

      if (response.success && response.token) {
        await safeTrackEvent('user_registered', {
          userId: response.user.id,
          email: response.user.email,
          method: 'identity_otp',
        });
      }

      return response;
    } catch (error) {
      console.error('Verify register OTP error:', error);
      throw error;
    }
  },

  resendRegisterOtp: async ({ contact, challenge_token }) => {
    try {
      return await api.auth.resendRegisterOtp({
        contact: sanitizeAuthContact(contact),
        challenge_token,
        client_context: collectClientContext(),
      });
    } catch (error) {
      console.error('Resend register OTP error:', error);
      throw error;
    }
  },

  getRegistrationAcademicCatalog: async () => {
    try {
      return await api.auth.getRegistrationAcademicCatalog();
    } catch (error) {
      console.error('Get registration academic catalog error:', error);
      throw error;
    }
  },

  getRegistrationSession: async ({ registration_session_id, resume_token }) => {
    try {
      return await api.auth.getRegistrationSession({ registration_session_id, resume_token });
    } catch (error) {
      console.error('Get registration session error:', error);
      throw error;
    }
  },

  uploadRegistrationAvatar: async ({ registration_session_id, resume_token, file }) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('registration_session_id', registration_session_id);
      formData.append('resume_token', resume_token);
      return await api.auth.uploadRegistrationAvatar(formData);
    } catch (error) {
      console.error('Upload registration avatar error:', error);
      throw error;
    }
  },

  completeRegistrationProfile: async (payload) => {
    try {
      return normalizeAuthResponse(await api.auth.updateRegistrationProfile({
        ...payload,
        client_context: collectClientContext(),
      }));
    } catch (error) {
      console.error('Complete registration profile error:', error);
      throw error;
    }
  },

  selectRegistrationPlan: async (payload) => {
    try {
      return persistSession(await api.auth.selectRegistrationPlan({
        ...payload,
        client_context: collectClientContext(),
      }));
    } catch (error) {
      console.error('Select registration plan error:', error);
      throw error;
    }
  },

  checkoutRegistration: async (payload) => {
    try {
      return await api.auth.checkoutRegistration({
        ...payload,
        client_context: collectClientContext(),
      });
    } catch (error) {
      console.error('Checkout registration error:', error);
      throw error;
    }
  },

  verifyRegistrationPayment: async (payload) => {
    try {
      return persistSession(await api.auth.verifyRegistrationPayment({
        ...payload,
        client_context: collectClientContext(),
      }));
    } catch (error) {
      console.error('Verify registration payment error:', error);
      throw error;
    }
  },

  // Login/register with Google OAuth payload (authorization code or id token)
  loginWithGoogle: async (googlePayload) => {
    try {
      const payload =
        typeof googlePayload === 'string'
          ? { idToken: googlePayload, client_context: collectClientContext() }
          : { ...(googlePayload || {}), client_context: collectClientContext() };

      const response = persistSession(await api.auth.googleLogin(payload));

      if (response.success && response.token) {

        await safeTrackEvent('user_login', {
          userId: response.user.id,
          email: response.user.email,
          method: 'google'
        });
      }

      return response;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  },

  // Logout user
  logout: async () => {
    try {
      // Track logout event
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await safeTrackEvent('user_logout', {
        userId: user.id,
      });

      // Call logout endpoint
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      api.setToken(null);
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('auth-storage');
    }
  },

  // Refresh access token
  refreshAccessToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.auth.refreshToken(refreshToken);
      const accessToken = response?.accessToken || response?.token;

      if (response.success && accessToken) {
        api.setToken(accessToken);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        return accessToken;
      }
      
      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh error:', error);
      // Clear tokens on refresh failure
      api.setToken(null);
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('auth-storage');
      throw error;
    }
  },

  // Verify email
  verifyEmail: async (token) => {
    try {
      const response = await api.auth.verifyEmail(token);
      
      if (response.success) {
        // Update user verification status
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.email_verified = true;
        localStorage.setItem('user', JSON.stringify(user));
        
        await safeTrackEvent('email_verified', {
          userId: user.id,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    try {
      const normalizedEmail = sanitizeEmailAddress(email);
      const response = await api.auth.forgotPassword(normalizedEmail);
      
      if (response.success) {
        await safeTrackEvent('password_reset_requested', { email: normalizedEmail });
      }
      
      return response;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  },

  forgotPasswordOtp: async (email) => {
    try {
      const normalizedEmail = sanitizeEmailAddress(email);
      const response = await api.auth.forgotPasswordOtp(normalizedEmail);

      if (response.success) {
        await safeTrackEvent('password_reset_otp_requested', { email: normalizedEmail });
      }

      return response;
    } catch (error) {
      console.error('Forgot password OTP error:', error);
      throw error;
    }
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    try {
      const response = await api.auth.resetPassword(token, newPassword);
      
      if (response.success) {
        await safeTrackEvent('password_reset_completed');
      }
      
      return response;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  resetPasswordWithOtp: async ({ email, otp, challenge_token, newPassword }) => {
    try {
      const normalizedEmail = sanitizeEmailAddress(email);
      const response = await api.auth.resetPasswordWithOtp({
        email: normalizedEmail,
        otp,
        challenge_token,
        newPassword
      });

      if (response.success) {
        await safeTrackEvent('password_reset_otp_completed', { email: normalizedEmail });
      }

      return response;
    } catch (error) {
      console.error('Reset password with OTP error:', error);
      throw error;
    }
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const response = await api.me.get();
      if (!response) {
        throw new Error('Session expired');
      }
      
      if (response.success) {
        // Update local user data
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Track profile view
        await safeTrackEvent('profile_viewed', {
          userId: response.user.id,
        });
      }
      
      return normalizeAuthResponse(response);
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (userData) => {
    try {
      const response = await api.user.updateProfile(userData);
      
      if (response.success) {
        // Update local user data
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Track profile update
        await safeTrackEvent('profile_updated', {
          userId: updatedUser.id,
          fields_updated: Object.keys(userData),
        });
      }
      
      return response;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  completeProfile: async (payload) => {
    try {
      const response = await api.me.updateProfile(payload);
      if (response.success && response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      return normalizeAuthResponse(response);
    } catch (error) {
      console.error('Complete profile error:', error);
      throw error;
    }
  },

  createPassword: async (password) => {
    try {
      const response = await api.me.updatePassword(password);
      if (response.success && response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      return normalizeAuthResponse(response);
    } catch (error) {
      console.error('Create password error:', error);
      throw error;
    }
  },

  selectPlan: async (planId) => {
    try {
      const response = await api.me.selectPlan(planId);
      if (response.success && response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      return normalizeAuthResponse(response);
    } catch (error) {
      console.error('Select plan error:', error);
      throw error;
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await api.user.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        await safeTrackEvent('password_changed');
      }
      
      return response;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  },

  // Delete account
  deleteAccount: async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const response = await api.user.deleteAccount();
      
      if (response.success) {
        // Clear local storage
        api.setToken(null);
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        
        await safeTrackEvent('account_deleted', {
          userId: user.id,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      return false;
    }
    
    // Check if token is expired (basic check - actual validation happens on server)
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      return tokenData.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },

  // Get current user
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  },

  // Update user in local storage
  updateLocalUser: (updates) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      console.error('Error updating local user:', error);
      return null;
    }
  },

  // Check if user has specific role
  hasRole: (role) => {
    const user = authService.getCurrentUser();
    return user?.role === role;
  },

  // Check if user has any of the specified roles
  hasAnyRole: (roles) => {
    const user = authService.getCurrentUser();
    return roles.includes(user?.role);
  },

  // Check if user is admin
  isAdmin: () => {
    return authService.hasRole('admin');
  },

  // Check if user is contributor
  isContributor: () => {
    const u = authService.getCurrentUser();
    return Boolean(u?.is_contributor) || authService.hasRole('admin');
  },

  // Check if user is lecturer
  isLecturer: () => {
    return authService.hasAnyRole(['lecturer', 'admin']);
  },
};

export default authService;
