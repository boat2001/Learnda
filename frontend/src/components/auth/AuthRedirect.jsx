import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

export default function AuthRedirect({ mode = 'login' }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('openAuthModal', {
      detail: { mode, returnOnClose: true },
    }));
  }, [mode]);

  return <Navigate to="/" replace />;
}
