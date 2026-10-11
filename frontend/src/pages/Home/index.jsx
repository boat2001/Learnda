// Home: a landing page for guests, a "today" page for learners.
import { useAuth } from '../../hooks/useAuth';
import HomePageSkeleton from '../../components/common/HomePageSkeleton';
import GuestHome from './GuestHome';
import LearnerHome from './LearnerHome';
import './Home.css';

export default function Home() {
  const { user, isAuthenticated, loading, hasChecked } = useAuth();

  // Avoid flashing the marketing page at a returning learner while the
  // session is still being checked.
  if (!hasChecked && loading) {
    return <HomePageSkeleton isAuthenticated={Boolean(user)} />;
  }

  return isAuthenticated && user ? <LearnerHome user={user} /> : <GuestHome />;
}
