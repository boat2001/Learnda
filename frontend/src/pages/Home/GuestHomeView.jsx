import { Children, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { playUiSound } from '../../utils/uiSounds';
import { FiLink, FiMapPin } from 'react-icons/fi';
import PlanCard from '../../components/subscription/PlanCard';
import ContributionAppeal from '../../components/subscription/ContributionAppeal';
import FormModal from '../../components/common/FormModal';
import useHorizontalAutoScroll from '../../hooks/useHorizontalAutoScroll';
import api from '../../services/api';

function AutoSwipeStrip({ children, interval = 3800 }) {
  const sliderRef = useRef(null);
  const childCount = useMemo(() => Children.count(children), [children]);

  useHorizontalAutoScroll(sliderRef, {
    enabled: childCount > 1,
    interval,
    itemCount: childCount,
    pauseOnInteractionMs: 5200,
    trackActiveIndex: false,
  });

  return (
    <div className="auto-slider" ref={sliderRef}>
      {children}
    </div>
  );
}

function GuestSection({ title, subtitle, className, children }) {
  return (
    <div className="guest-section-block">
      <div className="section-header">
        <h2>{title}</h2>
        <p className="section-subtitle">{subtitle}</p>
      </div>
      <section className={className}>{children}</section>
    </div>
  );
}

const getCollegeMetaParts = (college) => ({
  location: String(college?.established || '').trim(),
  affiliation: String(college?.affiliation || '').trim(),
});

const formatProgramLabel = (program = '') =>
  String(program || '')
    .replace(/\s+Education$/i, '')
    .trim();

const HERO_SLIDES = ['/learning-1.jpg', '/learning-2.jpg', '/learning-3.jpg'];

export default function GuestHomeView({
  normalizedGuestPlans,
  guestColleges,
  guestSuccessStories,
  logoSrc,
  navigate,
}) {
  const guestPlanFeatureRows = Math.max(
    0,
    ...normalizedGuestPlans.map((plan) =>
      Array.isArray(plan.features) ? plan.features.length : 0
    )
  );
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => playUiSound('welcomeGuest'), 700);
    return () => clearTimeout(id);
  }, []);

  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storySubmitting, setStorySubmitting] = useState(false);
  const [storyStatus, setStoryStatus] = useState('');
  const [storyError, setStoryError] = useState('');
  const [publicStories, setPublicStories] = useState([]);
  const [storyForm, setStoryForm] = useState({
    name: '',
    college: '',
    story: '',
    rating: 5,
  });
  const storyCollegeOptions = useMemo(() => (
    [...new Set(
      guestColleges
        .map((college) => String(college?.name || '').trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right))
  ), [guestColleges]);
  const visibleStories = publicStories;

  const loadPublicStories = useCallback(async (isActive = () => true) => {
    try {
      const response = await api.support.getSuccessStories({ limit: 10 });
      if (isActive() && response?.success) {
        setPublicStories(response.stories || []);
      }
    } catch {
      if (isActive()) setPublicStories([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadPublicStories(() => active);
    return () => { active = false; };
  }, [loadPublicStories]);

  const onStoryInput = (event) => {
    const { name, value } = event.target;
    setStoryForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitStory = async (event) => {
    event.preventDefault();
    setStorySubmitting(true);
    setStoryStatus('');
    setStoryError('');
    try {
      await api.support.submitReport({
        name: storyForm.name,
        college: storyForm.college,
        subject: `Guest success story: ${storyForm.college || 'Learnda learner'}`,
        category: 'Success story',
        message: storyForm.story,
        rating: storyForm.rating,
      });
      await loadPublicStories();
      setStoryStatus('Thanks! Your story has been added.');
      setStoryForm((prev) => ({ ...prev, college: '', story: '' }));
      setStoryModalOpen(false);
    } catch (error) {
      setStoryError(error?.message || 'Could not submit story right now.');
    } finally {
      setStorySubmitting(false);
    }
  };

  return (
    <div className="home-page">
      <section className="hero-section guest-hero-section">
        <div className="hero-bg-slider" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <div
              key={src}
              className={`hero-bg-slide${i === heroIdx ? ' hero-bg-slide--active' : ''}`}
              style={{ backgroundImage: `url('${src}')` }}
            />
          ))}
        </div>
        <div className="hero-bg-overlay" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">Learn Like Never Before 🎉</span>
            <h1>Best platform to learn, get files, practice, and excel.</h1>
            <p>
              Get ahead with smart lessons, practice tests, and a community
              that keeps you accountable.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }))}
              >
                Get started
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }))}
              >
                Continue learning
              </button>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/resources')}
              >
                Get files instead
              </button>
            </div>
          </div>

          <div className="hero-panel">
            <button type="button" className="highlight-card" onClick={() => navigate('/learn')}>
              <h4>Interactive lessons</h4>
              <p>Structured flows of chunks that match your pace.</p>
            </button>
            <button type="button" className="highlight-card" onClick={() => navigate('/practice')}>
              <h4>Practice in minutes</h4>
              <p>Quizzes, Exams and try questions ready on the tap.</p>
            </button>
            <button type="button" className="highlight-card" onClick={() => navigate('/resources')}>
              <h4>Get files and learn</h4>
              <p>Past questions, Outlines and Notes ready to download.</p>
            </button>
          </div>
        </div>
      </section>

      <GuestSection
        title="Colleges on Learnda"
        subtitle="Institutions actively learning on Learnda."
        className="home-section colleges-section"
      >
        <AutoSwipeStrip interval={4200}>
          {guestColleges.map((college, index) => {
            const meta = getCollegeMetaParts(college);
            return (
              <article
                key={`${college.id}-${index}`}
                className="guest-college-card"
              >
                <div className="guest-college-media">
                  <img src={college.image || logoSrc} alt={college.name} loading="lazy" />
                </div>
                <h3>{college.name}</h3>
                <div className="guest-college-programs">
                  {(college.programs || []).map((program) => (
                    <span key={`${college.id}-${program}`}>{formatProgramLabel(program)}</span>
                  ))}
                </div>
                <div className="guest-college-meta">
                  {meta.location ? (
                    <span className="guest-college-location">
                      <FiMapPin aria-hidden="true" />
                      <span>{meta.location}</span>
                    </span>
                  ) : null}
                  {meta.affiliation ? (
                    <span className="guest-college-affiliation">
                      <FiLink aria-hidden="true" />
                      <span>{meta.affiliation}</span>
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </AutoSwipeStrip>
      </GuestSection>

      <GuestSection
        title="Why learners stay"
        subtitle="Tools designed to keep progress consistent."
        className="stats-section"
      >
        <div className="stats-grid">
          <div className="stat-card">
            <h3>3x</h3>
            <p>Faster revision with structured learning flow</p>
          </div>
          <div className="stat-card">
            <h3>280+</h3>
            <p>Courses with lessons and test items for Students</p>
          </div>
          <div className="stat-card">
            <h3>24/7</h3>
            <p>Access on mobile, web, and desktop</p>
          </div>
        </div>
      </GuestSection>

      {/* No plans CTA here — the plans grid is the very next section. */}
      <ContributionAppeal className="page-contribution-appeal" />

      <GuestSection
        title="Support Learnda, unlock more"
        subtitle="Contribute to support the platform, or use it for free."
        className="home-section"
      >
        <div className="plans-grid">
          {[...normalizedGuestPlans].reverse().map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan.name}
              price={plan.price}
              features={plan.features}
              highlight={plan.name === 'Master Student'}
              onUpgrade={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }))}
              upgradeLabel={Number(plan.price || 0) > 0 ? 'Contribute' : 'Start free'}
            />
          ))}
        </div>
      </GuestSection>

      <GuestSection
        title="Success stories"
        subtitle="Real progress from learners using Learnda every week."
        className="home-section success-stories-section"
      >
        <AutoSwipeStrip interval={4600}>
          {visibleStories.map((story, index) => {
            const storyText = story.testimony || story.story || story.focus || '';
            const rating = story.rating ? Number(story.rating) : null;
            return (
              <article key={`${story.id}-${index}`} className="guest-story-card">
                {rating && (
                  <div className="story-stars" aria-label={`${rating} out of 5 stars`}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} className={`story-star ${i <= rating ? 'filled' : ''}`} aria-hidden="true">★</span>
                    ))}
                  </div>
                )}
                <span className="story-quote-mark" aria-hidden="true">&ldquo;</span>
                <p className="testimony">{storyText}</p>
                <div className="story-author-row">
                  <img src={story.image || logoSrc} alt={story.name} loading="lazy" className="story-avatar" />
                  <div>
                    <h3 className="story-name">{story.name}</h3>
                    <p className="story-college">{story.college || story.focus}</p>
                  </div>
                </div>
              </article>
            );
          })}

          <article className="guest-story-card guest-story-add-card">
            <span className="story-add-icon" aria-hidden="true">✦</span>
            <h3>Your turn.</h3>
            <p>Your experience could be the story that inspires another student.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStoryModalOpen(true)}
            >
              Add your story
            </button>
          </article>
        </AutoSwipeStrip>
        {storyStatus ? <p className="guest-story-submit-status">{storyStatus}</p> : null}
      </GuestSection>

      <FormModal
        isOpen={storyModalOpen}
        onClose={() => !storySubmitting && setStoryModalOpen(false)}
        title="Add your success story"
        subtitle="Share your outcome in a few lines so other students can learn from it."
      >
        <form className="guest-story-form" onSubmit={submitStory}>
          <div className="form-row story-rating-row">
            <label>How would you rate Learnda?</label>
            <div className="story-star-picker">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`story-star-pick ${storyForm.rating >= star ? 'active' : ''}`}
                  onClick={() => setStoryForm(prev => ({ ...prev, rating: star }))}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="guest-story-name">Full name</label>
            <input
              id="guest-story-name"
              name="name"
              value={storyForm.name}
              onChange={onStoryInput}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="guest-story-college">College</label>
            <input
              id="guest-story-college"
              name="college"
              list="guest-story-college-options"
              value={storyForm.college}
              onChange={onStoryInput}
              placeholder="Start typing your college"
              autoComplete="off"
              required
            />
            <datalist id="guest-story-college-options">
              {storyCollegeOptions.map((college) => (
                <option key={college} value={college} />
              ))}
            </datalist>
          </div>
          <div className="form-row">
            <label htmlFor="guest-story-text">Your story</label>
            <textarea
              id="guest-story-text"
              name="story"
              rows={4}
              value={storyForm.story}
              onChange={onStoryInput}
              placeholder="What changed for you after using Learnda?"
              required
            />
          </div>
          {storyError ? <p className="guest-story-submit-error">{storyError}</p> : null}
          <div className="fm-actions">
            <button type="submit" className="btn btn-primary" disabled={storySubmitting}>
              {storySubmitting ? 'Submitting...' : 'Submit story'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStoryModalOpen(false)}
              disabled={storySubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </FormModal>

    </div>
  );
}
