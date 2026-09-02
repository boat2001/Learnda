import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const hasChecked = useAuthStore((s) => s.hasChecked);

  if (loading || !hasChecked) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
}
