import { useAuth } from '../../hooks/useAuth';
import { hasFullAcademicProfile } from '../../utils/onboarding';
import AcademicProfileGate from './AcademicProfileGate';

/**
 * Gate for programme-specific content on otherwise-public routes (Learn,
 * Courses, Practice). Guests keep browsing freely; signed-in users who deferred
 * their academic details at sign-up are asked to add them here — the first time
 * they open course content — instead of in the sign-up funnel.
 */
export default function RequireAcademicProfile({ children }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return children;
  }

  if (isAuthenticated && !hasFullAcademicProfile(user)) {
    return <AcademicProfileGate />;
  }

  return children;
}
