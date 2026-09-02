import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getNextOnboardingStep, isOnboardingComplete } from '../utils/onboarding';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    nextStep,
    loading,
    error,
    login,
    forgotPasswordOtp,
    resetPasswordWithOtp,
    loginWithGoogle,
    register,
    resendRegisterOtp,
    verifyRegisterOtp,
    logout,
    updateUser,
    refreshToken,
    checkAuth,
    clearError,
    hasRole,
    hasAnyRole,
    isAdmin,
    isContributor,
    isLecturer,
    initializeFromStorage,
    hasChecked,
  } = useAuthStore();

  const currentPlan = user?.subscription?.plan || null;
  const derivedNextStep = nextStep || getNextOnboardingStep(user);

  useEffect(() => {
    if (!user && !isAuthenticated) {
      initializeFromStorage();
    }
  }, [user, isAuthenticated, initializeFromStorage]);

  useEffect(() => {
    if (!hasChecked) {
      checkAuth();
    }
  }, [checkAuth, hasChecked]);

  return {
    user,
    isAuthenticated,
    nextStep: derivedNextStep,
    onboardingComplete: isOnboardingComplete(user),
    loading,
    error,
    login,
    forgotPasswordOtp,
    resetPasswordWithOtp,
    loginWithGoogle,
    register,
    resendRegisterOtp,
    verifyRegisterOtp,
    logout,
    updateUser,
    refreshToken,
    checkAuth,
    clearError,
    hasRole,
    hasAnyRole,
    isAdmin,
    isContributor,
    isLecturer,
    currentPlan,
  };
}
