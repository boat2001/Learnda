import { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormModal from '../components/common/FormModal';
import useHorizontalAutoScroll from '../hooks/useHorizontalAutoScroll';
import './SharedPages.css';

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function SuccessStories() {
  const { user, isAuthenticated } = useAuth();
  const railRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    college: '',
    focus: '',
    story: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showStoryModal, setShowStoryModal] = useState(false);

  useHorizontalAutoScroll(railRef, {
    enabled: stories.length > 1,
    interval: 4300,
    itemCount: stories.length,
    pauseOnInteractionMs: 5200,
    trackActiveIndex: false,
  });

  useEffect(() => {
    setFormState((previous) => ({
      ...previous,
      name: previous.name || getDisplayName(user),
      email: previous.email || user?.email || '',
    }));
  }, [user]);

  const loadStories = useCallback(async (isActive = () => true) => {
    setLoadingStories(true);
    try {
      const response = await api.support.getSuccessStories({ limit: 18 });
      if (isActive() && response?.success) {
        setStories(response.stories || []);
      }
    } catch {
      if (isActive()) setStories([]);
    } finally {
      if (isActive()) setLoadingStories(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadStories(() => active);
    return () => { active = false; };
  }, [loadStories]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const submitStory = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    setError('');

    try {
      await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : formState.name,
        email: isAuthenticated ? user?.email : formState.email,
        college: formState.college,
        subject: `Success story submission: ${formState.focus || formState.college || 'Sharether learner'}`,
        category: 'Success Story',
        message: formState.story,
      });
      await loadStories();
      setStatus('Story added. It is now visible on the community stories page.');
      setFormState((previous) => ({
        ...previous,
        college: '',
        focus: '',
        story: '',
      }));
      setShowStoryModal(false);
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your story right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowStoryModal(false);
    setError('');
  };

  return (
    <div className="page-shell success-page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-community success-hero-lean">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Student outcomes</span>
            <h1 className="hero-title">Community success stories</h1>
            <p className="hero-subtitle">
              Real wins students have shared from lessons, files, practice questions, and campus learning.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowStoryModal(true)}>
                Share your story
              </button>
              <a className="btn btn-secondary" href="#community-stories">
                Read stories <FiArrowRight aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section success-story-section" id="community-stories">
        <div className="section-heading">
          <h2>Stories from the community</h2>
          <p>Every win is a reminder that consistent learning pays off.</p>
        </div>

        {loadingStories ? (
          <div className="success-story-empty">Loading stories...</div>
        ) : stories.length ? (
          <div className="success-story-rail" ref={railRef}>
            {stories.map((story) => (
              <article key={story.id} className="success-story-card">
                <div className="success-story-head">
                  <img src="/sharether-logo.webp" alt="" loading="lazy" />
                  <div>
                    <h3>{story.name}</h3>
                    <p className="college">{story.college || story.focus || 'Sharether community'}</p>
                  </div>
                </div>
                <p className="success-story-card__achievement">{story.focus || story.college || 'Sharether learner'}</p>
                <p className="success-story-card__quote">"{story.story || story.testimony}"</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="success-story-empty">
            <h3>No stories yet</h3>
            <p>Be the first to share a result from your learning journey.</p>
            <button className="btn btn-primary" type="button" onClick={() => setShowStoryModal(true)}>
              Add your story
            </button>
          </div>
        )}
      </section>

      <section className="page-section success-submit-band" id="story-form">
        <div>
          <h2>Submit your outcome story</h2>
          <p>Share the shift, the resource or habit that helped, and what changed for you.</p>
          {status ? <p className="pricing-inline-feedback success status-inline">{status}</p> : null}
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShowStoryModal(true)}>
          Open story form
        </button>
      </section>

      <FormModal
        isOpen={showStoryModal}
        onClose={closeModal}
        title="Submit your outcome story"
        subtitle="Share a specific result so other students can see what is possible."
      >
        <form onSubmit={submitStory}>
          {!isAuthenticated ? (
            <div className="form-grid">
              <div className="form-row">
                <label htmlFor="story-name">Full name</label>
                <input id="story-name" name="name" type="text" value={formState.name} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <label htmlFor="story-email">Email</label>
                <input id="story-email" name="email" type="email" value={formState.email} onChange={handleChange} required />
              </div>
            </div>
          ) : null}
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="story-college">College</label>
              <input id="story-college" name="college" type="text" value={formState.college} onChange={handleChange} placeholder="Your college" required />
            </div>
            <div className="form-row">
              <label htmlFor="story-focus">Focus area</label>
              <input
                id="story-focus"
                name="focus"
                type="text"
                value={formState.focus}
                onChange={handleChange}
                placeholder="Course, exam, or topic"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="story-body">Story</label>
            <textarea
              id="story-body"
              name="story"
              rows="5"
              value={formState.story}
              onChange={handleChange}
              placeholder="What changed, what you used, and what outcome you saw."
              required
            />
          </div>
          {error ? <p className="pricing-inline-feedback error status-inline">{error}</p> : null}
          <div className="fm-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Submit story'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={closeModal} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
