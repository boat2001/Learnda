import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiClipboard, FiFolder } from 'react-icons/fi';
import { playUiSound } from '../../utils/uiSounds';
import { readLastActivity, ACTIVITY_TYPES } from '../../utils/lastActivity';
import ProfileCompletionBanner from '../../components/common/ProfileCompletionBanner';
import './AuthenticatedHomeView.css';

const RESUME_META = {
  [ACTIVITY_TYPES.LEARNING]: { icon: FiBookOpen, label: 'Learning' },
  [ACTIVITY_TYPES.PRACTICE]: { icon: FiClipboard, label: 'Practice' },
  [ACTIVITY_TYPES.FILES]: { icon: FiFolder, label: 'Files' },
};

/* Flat illustration for the greeting card: a graduation cap on a stack of
   books with a little plant and sparkles — self-contained (no external asset). */
function GreetingArt() {
  const Sparkle = ({ x, y, s = 1, fill }) => (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0,-8 C1,-2.4 2.4,-1 8,0 C2.4,1 1,2.4 0,8 C-1,2.4 -2.4,1 -8,0 C-2.4,-1 -1,-2.4 0,-8 Z"
      fill={fill}
    />
  );

  return (
    <svg className="home-hero-art" viewBox="0 0 240 180" role="img" aria-label="Potted plant beside a stack of books with a graduation cap" fill="none">
      <defs>
        <linearGradient id="greeting-blue-cover" x1="65" y1="126" x2="210" y2="151" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="greeting-green-cover" x1="72" y1="76" x2="198" y2="102" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <filter id="greeting-shadow" x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0f2740" floodOpacity="0.2" />
        </filter>
      </defs>

      <Sparkle x={210} y={42} s={0.9} fill="#60a5fa" />
      <Sparkle x={48} y={50} s={0.65} fill="#93c5fd" />
      <Sparkle x={220} y={105} s={0.55} fill="#38bdf8" />

      <ellipse cx="127" cy="155" rx="95" ry="8" fill="#0f2740" opacity="0.12" />

      {/* Clearly defined potted plant */}
      <g filter="url(#greeting-shadow)" transform="translate(-2 21) scale(0.86)">
        <path d="M39 127 C38 111 35 99 29 88" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
        <path d="M39 127 C40 108 47 94 57 84" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
        <path d="M39 127 C39 105 39 92 40 78" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
        <path d="M31 91 C18 91 14 82 14 73 C26 73 34 79 31 91 Z" fill="#34d399" />
        <path d="M55 89 C67 87 72 78 70 69 C58 70 51 78 55 89 Z" fill="#10b981" />
        <path d="M40 82 C30 75 30 65 35 57 C45 63 49 72 40 82 Z" fill="#22c55e" />
        <path d="M21 126 H58 L53 154 H27 Z" fill="#e8f1f8" stroke="#b9cee0" strokeWidth="2" />
        <path d="M18 124 C18 121.8 19.8 120 22 120 H57 C59.2 120 61 121.8 61 124 V130 H18 Z" fill="#f8fbfd" stroke="#b9cee0" strokeWidth="2" />
        <path d="M28 137 H52" stroke="#c8d9e7" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Three recognizable books with covers, page blocks, and spine details */}
      <g filter="url(#greeting-shadow)" transform="translate(8 0)">
        <rect x="64" y="126" width="146" height="8" rx="4" fill="url(#greeting-blue-cover)" />
        <path d="M71 134 H202 V145 H71 C67 145 67 134 71 134 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M78 138 H191 M78 142 H181" stroke="#dbe4ee" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="64" y="145" width="146" height="8" rx="4" fill="#2563eb" />
        <rect x="64" y="126" width="9" height="27" rx="4" fill="#1d4ed8" />

        <rect x="78" y="101" width="119" height="8" rx="4" fill="#fb923c" />
        <path d="M85 109 H190 V120 H85 C81 120 81 109 85 109 Z" fill="#fffaf0" stroke="#fed7aa" strokeWidth="1.5" />
        <path d="M91 113 H181 M91 117 H174" stroke="#fde0ba" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="78" y="120" width="119" height="8" rx="4" fill="#f97316" />
        <rect x="78" y="101" width="9" height="27" rx="4" fill="#ea580c" />

        <rect x="70" y="76" width="132" height="8" rx="4" fill="url(#greeting-green-cover)" />
        <path d="M78 84 H194 V95 H78 C74 95 74 84 78 84 Z" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5" />
        <path d="M85 88 H185 M85 92 H176" stroke="#c8f2d6" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="70" y="95" width="132" height="8" rx="4" fill="#059669" />
        <rect x="70" y="76" width="9" height="27" rx="4" fill="#047857" />
      </g>

      {/* Graduation cap sitting visibly on the top book */}
      <g filter="url(#greeting-shadow)" transform="translate(8 0)">
        <path className="home-hero-cap-body" d="M119 61 H153 V75 C146 80 126 80 119 75 Z" fill="#334155" />
        <path className="home-hero-cap-board" d="M136 35 L187 53 L136 71 L85 53 Z" fill="#172033" />
        <path className="home-hero-cap-crown" d="M136 35 L187 53 L136 59 L85 53 Z" fill="#27364d" />
        <circle cx="136" cy="53" r="3.5" fill="#f59e0b" />
        <path d="M136 53 C166 51 173 55 173 63 V72" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <path d="M169 72 H177 L175 83 H171 Z" fill="#fb923c" />
      </g>
    </svg>
  );
}

function ExploreCard({ icon: Icon, accent, title, description, descriptionBelow = false, cta, onClick, isTaken, variant = '' }) {
  return (
    <button
      type="button"
      className={`explore-card accent-${accent}${variant ? ` ${variant}` : ''}${isTaken ? ' is-taken' : ''}`}
      onClick={onClick}
    >
      <span className="explore-card-body">
        <span className="explore-card-icon"><Icon /></span>
        <span className="explore-card-heading">
          <span className="explore-card-title">{title}</span>
          {description && !descriptionBelow && <span className="explore-card-description">{description}</span>}
        </span>
        <span className="explore-card-arrow" aria-hidden="true"><FiArrowRight /></span>
      </span>
      {description && descriptionBelow && (
        <span className="explore-card-description explore-card-description-below">{description}</span>
      )}
      <span className="explore-card-cta">{cta}</span>
    </button>
  );
}

export default function AuthenticatedHomeView({ home }) {
  const { isAuthenticated } = home;

  useEffect(() => {
    const id = setTimeout(() => playUiSound(isAuthenticated ? 'welcomeAuth' : 'welcomeGuest'), 650);
    return () => clearTimeout(id);
  }, [isAuthenticated]);

  const {
    firstName,
    dailyHighlights,
    newContentCounts,
    consumedState,
    openMomentsViewer,
    pickupCtaLabel,
    pickupCourseName,
    pickupCourseCode,
    pickupCourseCredits,
    normalizedPickupProgress,
    openStudySection,
    practiceCtaLabel,
    normalizedPracticeProgress,
  } = home;

  const navigate = useNavigate();
  const openAuth = (mode) => {
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: mode }));
  };
  // Read once on mount — localStorage is synchronous and this only needs to
  // reflect the state at page load.
  const [lastActivity] = useState(readLastActivity);

  const [quoteItem, factItem, jokeItem, articleItem, storyItem] = dailyHighlights || [];

  const isTaken = (item) => Boolean(item && consumedState?.[item.stateKey || item.key]);
  const newCountLabel = (type, singular, plural = `${singular}s`) => {
    const count = Number(newContentCounts?.[type] || 0);
    const noun = count === 1 ? singular : plural;
    return `${count} new ${noun}`;
  };

  // Build the "pick up where you left off" card. Prefer the student's real last
  // activity (this device); otherwise fall back to the recommended course so the
  // section still guides brand-new users into learning.
  const resume = lastActivity
    ? {
        type: lastActivity.type,
        title: lastActivity.title || RESUME_META[lastActivity.type]?.label || 'Continue',
        subtitle: lastActivity.subtitle,
        credits: lastActivity.credits,
        path: lastActivity.path,
        cta: 'Continue',
      }
    : {
        type: ACTIVITY_TYPES.LEARNING,
        title: pickupCourseName,
        subtitle: pickupCourseCode,
        credits: pickupCourseCredits,
        path: '/learn',
        cta: pickupCtaLabel,
      };
  const ResumeIcon = RESUME_META[resume.type]?.icon || FiBookOpen;
  const resumeTypeLabel = RESUME_META[resume.type]?.label || 'Learning';
  const fallbackResumeProgress = resume.type === ACTIVITY_TYPES.PRACTICE
    ? normalizedPracticeProgress
    : resume.type === ACTIVITY_TYPES.LEARNING
      ? normalizedPickupProgress
      : null;
  const resumeProgressCandidate = lastActivity?.progress ?? fallbackResumeProgress;
  const resumeProgress = Number.isFinite(Number(resumeProgressCandidate))
    ? Math.max(0, Math.min(100, Math.round(Number(resumeProgressCandidate))))
    : null;
  const showsCourseCredits = resume.type === ACTIVITY_TYPES.LEARNING || resume.type === ACTIVITY_TYPES.PRACTICE;
  const rawResumeCredits = resume.credits || (showsCourseCredits ? pickupCourseCredits : '');
  const creditNumber = String(rawResumeCredits || '').match(/\d+(?:\.\d+)?/)?.[0] || '';
  const resumeCredits = showsCourseCredits ? `${creditNumber || '3'} credit hours` : '';

  return (
    <div className="authenticated-home">
      <section className="home-hero has-resume">
        <div className="home-hero-intro">
          <div className="home-hero-text">
            <p className="home-hero-eyebrow">{isAuthenticated ? 'Welcome back,' : 'Welcome to Sharether'}</p>
            <h1 className="home-hero-name">
              {isAuthenticated ? `${firstName || 'there'}!` : 'Scholar'} <span className="home-hero-wave">👋</span>
            </h1>
            <p className="home-hero-subtitle">
              {isAuthenticated ? 'Learn like never before.' : 'Learn like never before.'}
            </p>
          </div>
          <GreetingArt />
        </div>

        {isAuthenticated && resume.title ? (
          <section className="home-resume" aria-label="Pick up where you left off">
          <p className="home-resume-label">Pick up where you left off</p>
          <button
            type="button"
            className={`home-resume-card resume-${resume.type}`}
            onClick={() => navigate(resume.path)}
          >
            <span className="home-resume-icon"><ResumeIcon /></span>
            <span className="home-resume-body">
              <span className="home-resume-type">{resumeTypeLabel}</span>
              <span className="home-resume-title">{resume.title}</span>
              {(resume.subtitle || resumeCredits) && (
                <span className="home-resume-subtitle">
                  {resume.subtitle && <span>{resume.subtitle}</span>}
                  {resume.subtitle && resumeCredits && <span aria-hidden="true">•</span>}
                  {resumeCredits && <span>{resumeCredits}</span>}
                </span>
              )}
              {resumeProgress !== null && (
                <span className="home-resume-progress">
                  <span
                    className="home-resume-progress-track"
                    role="progressbar"
                    aria-label={`${resumeTypeLabel} progress`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={resumeProgress}
                  >
                    <span style={{ width: `${resumeProgress}%` }} />
                  </span>
                  <strong className="home-resume-progress-value">{resumeProgress}%</strong>
                </span>
              )}
            </span>
            <span className="home-resume-cta">
              {resume.cta}
              <FiArrowRight aria-hidden="true" />
            </span>
          </button>
          </section>
        ) : !isAuthenticated ? (
          <section className="home-resume home-guest-course-access" aria-label="Get your courses">
            <p className="home-resume-label">Your learning</p>
            <div className="home-resume-card resume-learning home-guest-access-card">
              <span className="home-resume-icon"><FiBookOpen /></span>
              <span className="home-resume-body">
                <span className="home-resume-title">Register or log in to get your courses</span>
                <span className="home-resume-subtitle">Save your progress and continue where you left off.</span>
              </span>
              <span className="home-guest-auth-actions">
                <button type="button" className="home-guest-auth-button is-primary" onClick={() => openAuth('register')}>Register</button>
                <button type="button" className="home-guest-auth-button" onClick={() => openAuth('login')}>Log in</button>
              </span>
            </div>
          </section>
        ) : null}
      </section>

      <ProfileCompletionBanner />

      <section className="home-explore">
        <div className="home-explore-heading">
          <h2>Explore</h2>
        </div>

        <div className="home-explore-row row-discover">
          {quoteItem && (
            <ExploreCard
              icon={quoteItem.icon || FiBookOpen}
              accent="teal"
              title="Quotes"
              description="Quote of the day"
              descriptionBelow
              cta={newCountLabel('quote', 'quote')}
              variant="daily-card"
              isTaken={isTaken(quoteItem)}
              onClick={() => openMomentsViewer(quoteItem)}
            />
          )}
          {factItem && (
            <ExploreCard
              icon={factItem.icon || FiBookOpen}
              accent="blue"
              title="Facts"
              description="Did you know?"
              descriptionBelow
              cta={newCountLabel('fact', 'fact')}
              variant="daily-card"
              isTaken={isTaken(factItem)}
              onClick={() => openMomentsViewer(factItem)}
            />
          )}
          {jokeItem && (
            <ExploreCard
              icon={jokeItem.icon || FiBookOpen}
              accent="orange"
              title="Jocular"
              description="Spice up your day"
              descriptionBelow
              cta={newCountLabel('joke', 'jocular')}
              variant="daily-card"
              isTaken={isTaken(jokeItem)}
              onClick={() => openMomentsViewer(jokeItem)}
            />
          )}
          {articleItem && (
            <ExploreCard
              icon={articleItem.icon || FiBookOpen}
              accent="blue"
              title="Articles"
              description={newCountLabel('article', 'article')}
              descriptionBelow
              cta="View all articles"
              variant="content-card"
              isTaken={isTaken(articleItem)}
              onClick={() => openMomentsViewer(articleItem)}
            />
          )}
          {storyItem && (
            <ExploreCard
              icon={storyItem.icon || FiBookOpen}
              accent="green"
              title="Stories"
              description={newCountLabel('story', 'story', 'stories')}
              descriptionBelow
              cta="View all stories"
              variant="content-card"
              isTaken={isTaken(storyItem)}
              onClick={() => openMomentsViewer(storyItem)}
            />
          )}
        </div>

        <div className="home-explore-row row-actions">
          <ExploreCard
            icon={FiBookOpen}
            accent="blue-green"
            title="Learning"
            description="Study courses"
            cta={pickupCtaLabel}
            onClick={() => openStudySection('pickup', '/learn', { activeTab: 'study' })}
          />
          <ExploreCard
            icon={FiClipboard}
            accent="green-orange"
            title="Practice"
            description="Test yourself"
            cta={practiceCtaLabel}
            onClick={() => openStudySection('practice', '/practice', { activeTab: 'practice' })}
          />
          <ExploreCard
            icon={FiFolder}
            accent="orange-blue"
            title="Get Files"
            description="Notes and study resources"
            cta="Browse files"
            onClick={() => navigate('/resources')}
          />
        </div>
      </section>
    </div>
  );
}
