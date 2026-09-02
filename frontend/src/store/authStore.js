import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService from '../services/authService';
import { getNextOnboardingStep, ONBOARDING_STEPS } from '../utils/onboarding';
import { emitStateChanged, APP_STATE_SCOPES } from '../utils/appEvents';

const resolveNextStep = (user, nextStep) =>
  nextStep || getNextOnboardingStep(user) || ONBOARDING_STEPS.DONE;

const INCOMPLETE_ONBOARDING_FLAG_KEY = 'sharether_incomplete_onboarding_v1';

const setIncompleteOnboardingFlag = (nextStep) => {
  if (typeof window === 'undefined') return;
  const isIncomplete = Boolean(nextStep && nextStep !== ONBOARDING_STEPS.DONE);
  if (isIncomplete) {
    window.localStorage.setItem(INCOMPLETE_ONBOARDING_FLAG_KEY, 'true');
    return;
  }
  window.localStorage.removeItem(INCOMPLETE_ONBOARDING_FLAG_KEY);
};

const clearStoredAuthSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('auth-storage');
  window.localStorage.removeItem(INCOMPLETE_ONBOARDING_FLAG_KEY);
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      nextStep: ONBOARDING_STEPS.DONE,
      loading: false,
      error: null,
      hasChecked: false,

      login: async (email, password) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.login(email, password);

          if (response.success && response.user) {
            const nextStep = resolveNextStep(response.user, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            set({
              user: response.user,
              isAuthenticated: true,
              nextStep,
              loading: false,
              error: null,
            });
            return { success: true, next_step: nextStep };
          }

          set({
            loading: false,
            error: response.error || 'Login failed',
          });
          return { success: false, error: response.error };
        } catch (error) {
          if (error?.data?.resume_available) {
            set({
              loading: false,
              error: null,
            });
            return {
              success: false,
              resume_available: true,
              error: error.data.error || error.message,
              next_step: error.data.next_step,
              contact: error.data.contact,
              channel: error.data.channel,
              masked_contact: error.data.masked_contact,
            };
          }
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      forgotPasswordOtp: async (email) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.forgotPasswordOtp(email);
          set({ loading: false, error: null });
          return response;
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      resetPasswordWithOtp: async ({ email, otp, challenge_token, newPassword }) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.resetPasswordWithOtp({
            email,
            otp,
            challenge_token,
            newPassword,
          });
          set({ loading: false, error: null });
          return response;
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      loginWithGoogle: async (googlePayload) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.loginWithGoogle(googlePayload);

          if (response.success) {
            if (response.registration_session && !response.user) {
              setIncompleteOnboardingFlag(response.next_step || ONBOARDING_STEPS.PROFILE);
              set({
                user: null,
                isAuthenticated: false,
                nextStep: response.next_step || ONBOARDING_STEPS.PROFILE,
                loading: false,
                error: null,
                hasChecked: true,
              });
              return {
                success: true,
                next_step: response.next_step || ONBOARDING_STEPS.PROFILE,
                registration_session: response.registration_session,
              };
            }
            const nextStep = resolveNextStep(response.user, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            set({
              user: response.user,
              isAuthenticated: true,
              nextStep,
              loading: false,
              error: null,
              hasChecked: true,
            });
            return { success: true, next_step: nextStep };
          }

          set({
            loading: false,
            error: response.error || 'Google login failed',
          });
          return { success: false, error: response.error };
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      register: async (userData) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.register(userData);
          if (response.requires_otp) {
            setIncompleteOnboardingFlag(ONBOARDING_STEPS.DONE);
            set({
              user: null,
              isAuthenticated: false,
              nextStep: ONBOARDING_STEPS.DONE,
              loading: false,
              error: null,
            });
            return {
              success: true,
              requires_otp: true,
              challenge_token: response.challenge_token,
              contact: response.contact || response.email,
              email: response.email,
              channel: response.channel,
              masked_contact: response.masked_contact,
              expires_in: response.expires_in,
              dev_otp: response.dev_otp,
            };
          }

          if (response.success) {
            const nextStep = resolveNextStep(response.user, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            set({
              user: response.user,
              isAuthenticated: true,
              nextStep,
              loading: false,
              error: null,
            });
            return { success: true, next_step: nextStep };
          }

          set({
            loading: false,
            error: response.error || 'Registration failed',
          });
          return { success: false, error: response.error };
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      verifyRegisterOtp: async ({ contact, otp, challenge_token, password, full_name }) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.verifyRegisterOtp({ contact, otp, challenge_token, password, full_name });

          if (response.success && response.registration_session && !response.user) {
            setIncompleteOnboardingFlag(response.next_step || ONBOARDING_STEPS.PROFILE);
            set({
              user: null,
              isAuthenticated: false,
              nextStep: response.next_step || ONBOARDING_STEPS.PROFILE,
              loading: false,
              error: null,
            });
            return {
              success: true,
              next_step: response.next_step || ONBOARDING_STEPS.PROFILE,
              registration_session: response.registration_session,
            };
          }

          if (response.success && response.user) {
            const nextStep = resolveNextStep(response.user, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            set({
              user: response.user,
              isAuthenticated: true,
              nextStep,
              loading: false,
              error: null,
            });
            return { success: true, next_step: nextStep };
          }

          set({
            loading: false,
            error: response.error || 'OTP verification failed',
          });
          return { success: false, error: response.error };
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      resendRegisterOtp: async ({ contact, challenge_token }) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.resendRegisterOtp({ contact, challenge_token });
          set({ loading: false, error: null });
          return response;
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      logout: async () => {
        set({ loading: true });

        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          setIncompleteOnboardingFlag(ONBOARDING_STEPS.DONE);
          set({
            user: null,
            isAuthenticated: false,
            nextStep: ONBOARDING_STEPS.DONE,
            loading: false,
            error: null,
            hasChecked: true,
          });
        }

        return { success: true };
      },

      updateUser: async (userData) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.updateProfile(userData);

          if (response.success) {
            const currentUser = get().user || {};
            const nextUser = response.user
              ? { ...currentUser, ...response.user }
              : { ...currentUser, ...userData };
            const nextStep = resolveNextStep(nextUser, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            localStorage.setItem('user', JSON.stringify(nextUser));
            set({
              user: nextUser,
              nextStep,
              loading: false,
              error: null,
            });
            emitStateChanged([APP_STATE_SCOPES.PROFILE, APP_STATE_SCOPES.SETTINGS], {
              source: 'authStore.updateUser',
            });
            return { success: true, next_step: nextStep };
          }

          set({
            loading: false,
            error: response.error || 'Update failed',
          });
          return { success: false, error: response.error };
        } catch (error) {
          set({
            loading: false,
            error: error.message || 'Network error',
          });
          return { success: false, error: error.message };
        }
      },

      refreshToken: async () => {
        try {
          const token = await authService.refreshAccessToken();
          return { success: true, token };
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return { success: false, error: error.message };
        }
      },

      checkAuth: async (force = false) => {
        if (get().hasChecked && !force) {
          return;
        }

        set({ loading: true, error: null, hasChecked: true });
        let token = localStorage.getItem('token');
        const refreshToken = localStorage.getItem('refreshToken');
        const userStr = localStorage.getItem('user');

        if (!token && refreshToken) {
          try {
            token = await authService.refreshAccessToken();
          } catch (error) {
            console.error('Token refresh failed:', error);
            clearStoredAuthSession();
            set({
              user: null,
              isAuthenticated: false,
              nextStep: ONBOARDING_STEPS.DONE,
              loading: false,
              error: error.message || 'Session expired',
            });
            return;
          }
        }

        if (!token) {
          setIncompleteOnboardingFlag(ONBOARDING_STEPS.DONE);
          set({
            user: null,
            isAuthenticated: false,
            nextStep: ONBOARDING_STEPS.DONE,
            loading: false,
          });
          return;
        }

        try {
          const response = await authService.getProfile();

          if (response.success && response.user) {
            const nextStep = resolveNextStep(response.user, response.next_step);
            setIncompleteOnboardingFlag(nextStep);
            set({
              user: response.user,
              isAuthenticated: true,
              nextStep,
              loading: false,
            });
            return;
          }

          clearStoredAuthSession();

          set({
            user: null,
            isAuthenticated: false,
            nextStep: ONBOARDING_STEPS.DONE,
            loading: false,
          });
        } catch (error) {
          console.error('Auth check error:', error);
          const isSessionError = /session expired|invalid authentication token|authentication required|invalid refresh token/i.test(
            String(error?.message || '').toLowerCase()
          );

          if (!isSessionError && userStr) {
            try {
              const parsedUser = JSON.parse(userStr);
              const nextStep = getNextOnboardingStep(parsedUser);
              setIncompleteOnboardingFlag(nextStep);
              set({
                user: parsedUser,
                isAuthenticated: true,
                nextStep,
                loading: false,
                error: null,
              });
              return;
            } catch (parseError) {
              console.error('Error parsing stored user:', parseError);
            }
          }

          clearStoredAuthSession();

          set({
            user: null,
            isAuthenticated: false,
            nextStep: ONBOARDING_STEPS.DONE,
            loading: false,
            error: error.message || 'Session check failed',
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      initializeFromStorage: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (!token || !userStr) {
          return;
        }

        try {
          const parsedUser = JSON.parse(userStr);
          const nextStep = getNextOnboardingStep(parsedUser);
          setIncompleteOnboardingFlag(nextStep);
          set({
            user: parsedUser,
            isAuthenticated: true,
            nextStep,
            loading: false,
            error: null,
          });
        } catch (error) {
          console.error('Error parsing stored user:', error);
          clearStoredAuthSession();
        }
      },

      getCurrentUser: () => get().user,
      getIsAuthenticated: () => get().isAuthenticated,
      getLoading: () => get().loading,
      getError: () => get().error,
      getNextStep: () => get().nextStep,

      hasRole: (role) => {
        const user = get().user;
        return user?.role === role;
      },

      hasAnyRole: (roles) => {
        const user = get().user;
        return roles.includes(user?.role);
      },

      isAdmin: () => {
        const user = get().user;
        return user?.role === 'admin';
      },

      isContributor: () => {
        const user = get().user;
        return Boolean(user?.is_contributor) || user?.role === 'admin';
      },

      isLecturer: () => {
        const user = get().user;
        return ['lecturer', 'admin'].includes(user?.role);
      },

      clearSession: () => {
        set({
          user: null,
          isAuthenticated: false,
          nextStep: ONBOARDING_STEPS.DONE,
          loading: false,
          error: null,
          hasChecked: true,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        nextStep: state.nextStep,
      }),
    }
  )
);
