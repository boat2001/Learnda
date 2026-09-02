import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import CoursePageSkeleton from './CoursePageSkeleton';
import HomePageSkeleton from './HomePageSkeleton';
import PageSkeleton from './PageSkeleton';

export default function RouteFallback({ compact = false }) {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();

  if (pathname === '/') {
    return <HomePageSkeleton isAuthenticated={isAuthenticated} />;
  }

  if (/^\/learn\/[^/]+$/.test(pathname)) {
    return <CoursePageSkeleton />;
  }

  return (
    <PageSkeleton
      title="Loading Learnda"
      subtitle="Preparing the next experience."
      cardCount={8}
      compact={compact}
    />
  );
}
