import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../services/api';
import { saveBlobAsFile, withDownloadLock } from '../../utils/downloadManager';
import { consumeGuestContentView } from '../../utils/guestContentAccess';
import { playUiSound } from '../../utils/uiSounds';
import DownloadCountdownModal from '../../components/resources/DownloadCountdownModal';
import '../SharedPages.css';
import './Resources.css';

const CATEGORY_META = {
  'course-outlines': {
    title: 'Course outlines',
    subtitle: 'Stay aligned with official syllabi and study checkpoints.',
    categories: ['course_outline', 'curriculum_policy', 'course_notes'],
  },
  'past-exams': {
    title: 'Past exams',
    subtitle: 'Download past papers and get exam-ready.',
    categories: ['exam'],
  },
  'past-quizzes': {
    title: 'Past quizzes',
    subtitle: 'Practice weekly quizzes and measure progress.',
    categories: ['quiz_internal', 'quiz_external'],
  },
  'answers-solutions': {
    title: 'Answers and solutions',
    subtitle: 'Review worked solutions for harder questions.',
    categories: ['sample_questions', 'course_notes'],
  },
};

const getFilesFromResponse = (response) => response?.files || response?.data?.files || [];

export default function ResourceCategory() {
  const { category = 'course-outlines' } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();

  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [pendingDownloadFile, setPendingDownloadFile] = useState(null);

  const meta = CATEGORY_META[category] || CATEGORY_META['course-outlines'];
  const getResourceTitle = (item) => item?.title || item?.file_name || 'Untitled resource';
  usePageTitle(meta?.title || 'Resources');

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      try {
        const categories = meta.categories || [];
        const requests = categories.length
          ? categories.map((item) => api.resources.getFiles({ category: item }))
          : [api.resources.getFiles()];

        const responses = await Promise.all(requests);
        const merged = responses
          .map(getFilesFromResponse)
          .flat();

        const seen = new Set();
        const normalized = merged.filter((file) => {
          if (seen.has(file.id)) return false;
          seen.add(file.id);
          return true;
        });

        setResources(normalized);
      } catch (error) {
        console.error('Error loading resources:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResources();
  }, [category]);

  useEffect(() => {
    setSelectedCourse('all');
    setSelectedYear('all');
  }, [category]);

  const courses = useMemo(() => {
    const values = new Set(resources.map((item) => (item.course || '').trim()).filter(Boolean));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [resources]);

  const years = useMemo(() => {
    const values = new Set(resources.map((item) => (item.year || '').trim()).filter(Boolean));
    return ['all', ...Array.from(values).sort((a, b) => Number(b) - Number(a))];
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      if (selectedCourse !== 'all' && String(item.course || '').trim() !== selectedCourse) return false;
      if (selectedYear !== 'all' && String(item.year || '').trim() !== selectedYear) return false;
      if (!search) return true;
      const haystack = `${getResourceTitle(item)} ${item.description || ''} ${item.course || ''} ${item.year || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [resources, search, selectedCourse, selectedYear]);

  const executeDownload = async (file) => {
    if (!file) return;
    await withDownloadLock(
      async () => {
        setDownloadingFileId(file.id);
        try {
          trackEvent('resource_download_attempt', {
            file_id: file.id,
            category: file.category,
          });

          await api.resources.trackView(file.id);
          const blob = await api.resources.downloadFile(file.id);
          saveBlobAsFile(blob, file.file_name || file.title);
          playUiSound('fileDownload');

          trackEvent('resource_downloaded', {
            file_id: file.id,
            category: file.category,
          });
        } catch (error) {
          console.error('Error downloading file:', error);
        } finally {
          setDownloadingFileId(null);
          setPendingDownloadFile(null);
        }
      },
      () => trackEvent('resource_download_blocked_active_download', { file_id: file.id })
    );
  };

  const handleDownload = async (file) => {
    if (!isAuthenticated) {
      const access = consumeGuestContentView({ isAuthenticated, contentType: 'resource_file', contentId: file.id });
      if (!access.allowed) {
        window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
        return;
      }
    }

    if (file.is_premium && currentPlan?.name === 'Basic Student') {
      window.dispatchEvent(new CustomEvent('openUpgradePrompt', {
        detail: { feature: 'premium_content', plan: 'Serious Student' }
      }));
      return;
    }

    setPendingDownloadFile(file);
  };

  const handleSaveToPLS = async (file) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
      return;
    }

    try {
      const response = await api.pls.addToPLS(file.id, 'file');
      if (response?.success) {
        trackEvent('resource_saved', { file_id: file.id });
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  return (
    <>
    <div className="page-shell resources-page">
      <section className="page-hero">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Resources library</span>
            <h1 className="hero-title">{meta.title}</h1>
            <p className="hero-subtitle">{meta.subtitle}</p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button">
                Upload a resource
              </button>
              <button className="btn btn-secondary" type="button">
                Save to PLS
              </button>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What you get</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Verified sources</strong>
                  <p>Resources curated by the Learnda community.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Fast filters</strong>
                  <p>Search by subject, year, and resource type.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Structured practice</strong>
                  <p>Move from outline to quiz to solution review.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Explore resources</h2>
          <p>Search, filter, and save what you need for your next study sprint.</p>
        </div>
        <div className="form-card">
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="resource-search">Search resources</label>
              <input
                id="resource-search"
                type="text"
                placeholder="Search by title, course, or year"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course === 'all' ? 'All Courses' : course}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year === 'all' ? 'All Years' : year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading resources...</p>
          </div>
        ) : (
          filteredResources.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">Resources</div>
              <h3>No matching resources</h3>
              <p>Try adjusting your search, course, or year filters.</p>
            </div>
          ) : (
            <div className="card-grid">
              {filteredResources.map((item) => (
                <div key={item.id} className="info-card">
                  <h3>{getResourceTitle(item)}</h3>
                  <p>{item.description || getResourceTitle(item)}</p>
                  <div className="pill-row">
                    {item.course && <span className="pill">{item.course}</span>}
                    {item.year && <span className="pill">{item.year}</span>}
                    <span className="pill">{item.category || 'resource'}</span>
                    <span className="pill">{item.downloads || 0} downloads</span>
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={Boolean(downloadingFileId)}
                    >
                      {downloadingFileId === item.id ? 'Downloading...' : 'Download'}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => handleSaveToPLS(item)}>
                      Save to PLS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
    <DownloadCountdownModal
      open={Boolean(pendingDownloadFile)}
      fileName={pendingDownloadFile?.file_name || pendingDownloadFile?.title || 'resource file'}
      isProcessing={Boolean(downloadingFileId)}
      onCancel={() => {
        if (!downloadingFileId) setPendingDownloadFile(null);
      }}
      onConfirm={() => executeDownload(pendingDownloadFile)}
    />
    </>
  );
}

