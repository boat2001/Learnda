import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('edu_last_tab') || 'notes');
  const [lastReadArticle, setLastReadArticle] = useState(() => localStorage.getItem('edu_last_article') || null);

  useEffect(() => {
    // Warm the cache for all tabs in parallel so tab switches feel instant
    api.prefetch('/eduvhibe/notes', 120000);
    api.prefetch('/eduvhibe/videos', 120000);
    api.prefetch('/eduvhibe/guides', 120000);
  }, []);

  useEffect(() => {
    localStorage.setItem('edu_last_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (lastReadArticle) {
      localStorage.setItem('edu_last_article', lastReadArticle);
      return;
    }
    localStorage.removeItem('edu_last_article');
  }, [lastReadArticle]);

  const value = {
    session: isAuthenticated && user ? { user } : null,
    isAdmin: user?.role === 'admin' || Boolean(user?.is_contributor),
    activeTab,
    setActiveTab,
    lastReadArticle,
    setLastReadArticle,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
