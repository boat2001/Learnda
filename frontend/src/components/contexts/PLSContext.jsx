import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { APP_EVENTS, APP_STATE_SCOPES } from '../../utils/appEvents';

export const PLSContext = createContext();

const normalizeItem = (item) => {
  const content = item.content || {};
  return {
    ...content,
    id: item.id,
    content_id: item.content_id,
    item_type: item.item_type,
    folder_id: item.parent_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    title: item.title || content.title || 'Untitled',
    description: item.description || content.description || '',
    tags: item.tags || content.tags || [],
    thumbnail_url: content.thumbnail_url || null,
    is_premium: content.is_premium || false,
    content_type: content.type || item.item_type,
    file_url: item.file_url || content.file_url || null,
    file_size: item.file_size || content.file_size || null,
    progress: item.metadata?.progress || 0,
    is_favorite: item.is_favorite || false,
  };
};

const getAcademicFilterValue = (value) => {
  const match = String(value || '').match(/\d+/);
  return match?.[0] || String(value || '').trim();
};

const getCurrentLearningFilters = (user = {}, overrides = {}) => {
  const level = getAcademicFilterValue(overrides.level || user.academic_level || user.level || user.study_level);
  const semester = getAcademicFilterValue(overrides.semester || user.current_semester || user.semester);
  return {
    ...(level ? { level } : {}),
    ...(semester ? { semester } : {}),
  };
};

export const PLSProvider = ({ children }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [currentCourses, setCurrentCourses] = useState([]);
  const [currentResources, setCurrentResources] = useState([]);
  const [currentCoursesMeta, setCurrentCoursesMeta] = useState(null);
  const [lastPracticeActivity, setLastPracticeActivity] = useState(null);
  const [currentStudyGroups, setCurrentStudyGroups] = useState([]);
  const [currentStudyGroupsMeta, setCurrentStudyGroupsMeta] = useState(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [plsStats, setPlsStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshPLS = useCallback(async (academicOverrides = null) => {
    if (!user) {
      setCourses([]);
      setCurrentCourses([]);
      setCurrentResources([]);
      setCurrentCoursesMeta(null);
      setLastPracticeActivity(null);
      setCurrentStudyGroups([]);
      setCurrentStudyGroupsMeta(null);
      setFiles([]);
      setFolders([]);
      setPlsStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentLearningFilters = getCurrentLearningFilters(user, academicOverrides || {});
      const [dashboardResult, itemsResult, currentCoursesResult, currentGroupsResult] = await Promise.allSettled([
        api.pls.getDashboard(),
        api.pls.getItems(),
        api.courses.getCurrent(currentLearningFilters),
        api.studyGroups.getCurrent(currentLearningFilters)
      ]);

      const dashboardRes = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const itemsRes = itemsResult.status === 'fulfilled' ? itemsResult.value : null;
      const currentCoursesRes = currentCoursesResult.status === 'fulfilled' ? currentCoursesResult.value : null;
      const currentGroupsRes = currentGroupsResult.status === 'fulfilled' ? currentGroupsResult.value : null;

      if (dashboardRes?.success) {
        setFolders(dashboardRes.data?.folders || []);
      } else {
        setFolders([]);
      }

      const items = Array.isArray(itemsRes?.data) ? itemsRes.data : [];
      const normalized = items.map(normalizeItem);
      const courseItems = normalized.filter((item) => item.item_type !== 'file');
      const fileItems = normalized.filter((item) => item.item_type === 'file');

      setCourses(courseItems);
      setFiles(fileItems);
      setCurrentCourses(currentCoursesRes?.data?.courses || []);
      setCurrentResources(currentCoursesRes?.data?.resources || []);
      setCurrentCoursesMeta({
        academicProfile: currentCoursesRes?.data?.academic_profile || null,
        missingProfile: Boolean(currentCoursesRes?.data?.missing_profile),
        resolvedProgramCategories: currentCoursesRes?.data?.resolved_program_categories || [],
      });
      setLastPracticeActivity(currentCoursesRes?.data?.last_practice_activity || null);
      setCurrentStudyGroups(currentGroupsRes?.data?.groups || []);
      setCurrentStudyGroupsMeta({
        academicProfile: currentGroupsRes?.data?.academic_profile || null,
        missingProfile: Boolean(currentGroupsRes?.data?.missing_profile),
        resolvedProgramCategories: currentGroupsRes?.data?.resolved_program_categories || [],
      });

      const stats = dashboardRes?.data?.stats || {};
      setPlsStats({
        ...stats,
        total_courses: courseItems.length,
        total_files: fileItems.length,
      });

      const requestErrors = [
        dashboardResult.status === 'rejected' ? dashboardResult.reason : null,
        itemsResult.status === 'rejected' ? itemsResult.reason : null,
        currentCoursesResult.status === 'rejected' ? currentCoursesResult.reason : null,
        currentGroupsResult.status === 'rejected' ? currentGroupsResult.reason : null,
      ].filter(Boolean);

      if (requestErrors.length) {
        const hasCurrentLearningData = Boolean(
          (currentCoursesRes?.data?.courses?.length || 0) ||
          (currentGroupsRes?.data?.groups?.length || 0)
        );
        setError(
          hasCurrentLearningData
            ? null
            : (requestErrors[0]?.message || 'Failed to load PLS data')
        );
      }
    } catch (err) {
      setCurrentCourses([]);
      setCurrentResources([]);
      setCurrentCoursesMeta(null);
      setLastPracticeActivity(null);
      setCurrentStudyGroups([]);
      setCurrentStudyGroupsMeta(null);
      setError(err.message || 'Failed to load PLS data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addToPLS = async (contentId, type = 'course') => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const response = await api.pls.addToPLS(contentId, type);
      if (response?.success) {
        await refreshPLS();
      }
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const removeFromPLS = async (itemId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const response = await api.pls.removeFromPLS(itemId);
      if (response?.success) {
        setCourses((prev) => prev.filter((item) => item.id !== itemId));
        setFiles((prev) => prev.filter((item) => item.id !== itemId));
      }
      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const createFolder = async (name) => {
    const response = await api.pls.createFolder(name);
    if (response?.success && response.data) {
      setFolders((prev) => [...prev, response.data]);
    }
    return response;
  };

  const renameFolder = async (folderId, newName) => {
    const response = await api.pls.updateFolder(folderId, { name: newName });
    if (response?.success) {
      setFolders((prev) => prev.map((folder) =>
        folder.id === folderId ? { ...folder, name: newName } : folder
      ));
    }
    return response;
  };

  const removeFolder = async (folderId) => {
    const response = await api.pls.deleteFolder(folderId);
    if (response?.success) {
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    }
    return response;
  };

  const moveToFolder = async (itemType, itemId, folderId) => {
    const response = await api.pls.moveToFolder(itemId, folderId);
    if (response?.success) {
      const updateItem = (item) => (item.id === itemId ? { ...item, folder_id: folderId } : item);
      if (itemType === 'file') {
        setFiles((prev) => prev.map(updateItem));
      } else {
        setCourses((prev) => prev.map(updateItem));
      }
    }
    return response;
  };

  const getFolderContents = async (folderId) => {
    const response = await api.pls.getItems({ folder_id: folderId });
    if (response?.success) {
      return (response.data || []).map(normalizeItem);
    }
    return [];
  };

  const getCourseProgress = (itemId) => {
    const item = courses.find((course) => course.id === itemId);
    return item?.progress || 0;
  };

  useEffect(() => {
    if (!user) return;
    refreshPLS();
  }, [refreshPLS, user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return undefined;

    const handleStateChanged = (event) => {
      const scopes = event?.detail?.scopes || [];
      if (!scopes.includes(APP_STATE_SCOPES.ACADEMIC)) return;
      refreshPLS(event?.detail?.academic || null);
    };

    window.addEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
    return () => window.removeEventListener(APP_EVENTS.STATE_CHANGED, handleStateChanged);
  }, [refreshPLS, user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return undefined;

    let timeoutId = null;
    const handleLearningProgressUpdated = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        refreshPLS();
      }, 450);
    };

    window.addEventListener('sharether:learning-progress-updated', handleLearningProgressUpdated);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('sharether:learning-progress-updated', handleLearningProgressUpdated);
    };
  }, [refreshPLS, user]);

  const value = {
    courses,
    currentCourses,
    currentResources,
    currentCoursesMeta,
    lastPracticeActivity,
    currentStudyGroups,
    currentStudyGroupsMeta,
    files,
    folders,
    plsStats,
    loading,
    error,
    refreshPLS,
    addToPLS,
    removeFromPLS,
    createFolder,
    removeFolder,
    renameFolder,
    moveToFolder,
    getFolderContents,
    getCourseProgress,
  };

  return (
    <PLSContext.Provider value={value}>
      {children}
    </PLSContext.Provider>
  );
};
