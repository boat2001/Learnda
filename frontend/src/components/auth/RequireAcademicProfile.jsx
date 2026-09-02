import { useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasClassPlacement } from '../../utils/onboarding';
import ClassPlacementPrompt from '../../pages/learn/ClassPlacementPrompt';

/**
 * Gate for class content (Learn, Practice).
 *
 * A learner cannot be shown any lesson or practice set until we know their
 * class, because every content query is scoped to it (§5). Sign-up stays short:
 * a name gets you into the app, and the class is asked for here, the first time
 * class content is opened.
 *
 * Guests keep browsing public pages freely.
 */
export default function RequireAcademicProfile({ children }) {
  const { isAuthenticated, user, loading, checkAuth } = useAuth();

  // Re-read the session so the freshly saved placement reaches this component.
  const handlePlaced = useCallback(() => { checkAuth?.(true); }, [checkAuth]);

  if (loading) {
    return children;
  }

  if (isAuthenticated && !hasClassPlacement(user)) {
    return (
      <ClassPlacementPrompt
        mode={user?.class_level ? 'pathway' : 'class'}
        classLevel={user?.class_level || null}
        onPlaced={handlePlaced}
      />
    );
  }

  return children;
}
