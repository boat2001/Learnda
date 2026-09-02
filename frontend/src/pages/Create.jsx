import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowRight,
  FiBookOpen,
  FiEdit3,
  FiFeather,
  FiFileText,
  FiInfo,
  FiMessageSquare,
  FiSmile,
  FiUploadCloud,
  FiVideo,
} from 'react-icons/fi';
import CreatorSubmissionModal from '../components/content/CreatorSubmissionModal';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { readCreatorDrafts, removeCreatorDraft } from '../utils/creatorDrafts';
import './SharedPages.css';
import './Create.css';

const creatorSections = [
  {
    id: 'study-tools',
    title: 'Learning Resources',
    description: 'Build the materials that help students study smarter.',
    items: [
      {
        id: 'file',
        title: 'Files',
        icon: FiFileText,
        description: 'Share the notes, slides, and helpful resources that make studying feel lighter.',
      },
      {
        id: 'video',
        title: 'Video Lessons',
        icon: FiVideo,
        description: 'Turn a tricky idea into a friendly walkthrough people can replay when they need it.',
      },
    ],
  },
  {
    id: 'deep-dives',
    title: 'Guides and Long Reads',
    description: 'Deep dives, narratives, and guides for the curious learner.',
    items: [
      {
        id: 'survival-guide',
        title: 'Survival Guides',
        icon: FiBookOpen,
        description: 'Pack the shortcuts, warnings, and comfort tips you wish someone gave you earlier.',
      },
      {
        id: 'article',
        title: 'Articles',
        icon: FiEdit3,
        description: 'Write a clear deep dive for curious minds that want the fuller story.',
      },
      {
        id: 'story',
        title: 'Stories',
        icon: FiFeather,
        description: 'Wrap a lesson in a tale with heart, surprise, and something worth remembering.',
      },
    ],
  },
  {
    id: 'quick-sparks',
    title: 'Quick Edutainment',
    description: 'Bite-sized content that entertains and teaches at the same time.',
    items: [
      {
        id: 'quote',
        title: 'Quotes',
        icon: FiMessageSquare,
        description: "Drop a small spark of wisdom that can brighten someone's study break.",
      },
      {
        id: 'did-you-know',
        title: 'Did You Know',
        icon: FiInfo,
        description: 'Share a tiny fact with enough charm to make someone pause and say, "wait, really?"',
      },
      {
        id: 'joke',
        title: 'Jokes',
        icon: FiSmile,
        description: 'Add a smart little laugh for the moments when learning needs a playful breath.',
      },
    ],
  },
];

const creatorTypes = creatorSections.flatMap((s) => s.items);
const toList = (response, key) => (Array.isArray(response?.[key]) ? response[key] : []);

const formatDate = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const titleFor  = (item) => item?.title || item?.original_name || 'Untitled content';
const typeFor   = (item) => String(item?.kind || item?.type || item?.subtype || item?.content_type || 'content').replace(/_/g, ' ');
const statusFor = (item) => String(item?.status || 'pending').toLowerCase();

function StudioShelf({ title, icon: Icon, count, empty, children }) {
  return (
    <div className="contribute-shelf">
      <div className="contribute-shelf__header">
        <span className="contribute-shelf__icon-wrap" aria-hidden="true"><Icon /></span>
        <h3 className="contribute-shelf__title">{title}</h3>
        {count != null && (
          <span className="contribute-shelf__count">{count}</span>
        )}
      </div>
      {children || <p className="contribute-shelf__empty">{empty}</p>}
    </div>
  );
}

export default function Create() {
  const { isAuthenticated } = useAuth();
  const [activeCreatorType, setActiveCreatorType] = useState(null);
  const [activeDraft, setActiveDraft] = useState(null);
  const [drafts, setDrafts] = useState(() => readCreatorDrafts());
  const [content, setContent] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.content.getMyContent(),
      api.contributions.getMine(),
    ]).then(([contentResult, contributionsResult]) => {
      if (cancelled) return;
      if (contentResult.status === 'fulfilled')       setContent(toList(contentResult.value, 'content'));
      if (contributionsResult.status === 'fulfilled') setContributions(toList(contributionsResult.value, 'contributions'));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const pendingContributions = useMemo(() => contributions.filter((i) => statusFor(i) === 'pending'), [contributions]);
  const publishedContent     = useMemo(() => content.filter((i) => !i?.status || statusFor(i) === 'published'), [content]);

  const openCreatorType = (creatorType) => {
    if (!isAuthenticated) { window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' })); return; }
    setActiveDraft(null);
    setActiveCreatorType(creatorType);
  };

  const openDraft = (draft) => {
    if (!isAuthenticated) { window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' })); return; }
    const creatorType = creatorTypes.find((i) => i.id === draft.creatorTypeId);
    if (!creatorType) return;
    setActiveDraft(draft);
    setActiveCreatorType(creatorType);
  };

  return (
    <div className="page-shell contribute-page">

      {/* ── Hero ── */}
      <section className="contribute-hero">
        <div className="contribute-hero__inner">
          <span className="contribute-hero__tag">Creator Studio</span>
          <h1 className="contribute-hero__title">
            Share what you know.<br />
            <span className="contribute-hero__title-accent">Make learning better.</span>
          </h1>
          <p className="contribute-hero__sub">
            Your files, insights, and ideas could be exactly what another student needs right now.
            Every piece of content you add makes Sharether stronger for everyone.
          </p>
          <div className="contribute-hero__actions">
            <a className="btn btn-primary" href="#creator-studio">Go to Creator Studio</a>
            <a className="btn btn-secondary" href="#what-to-create">What can I create?</a>
          </div>
        </div>
      </section>

      {/* ── What you can create ── */}
      <section className="page-section contribute-types-section" id="what-to-create">
        <div className="section-heading">
          <h2>What can you create?</h2>
          <p>Choose a format and start creating — every type of content has a home here.</p>
        </div>

        {creatorSections.map((section) => (
          <div
            key={section.id}
            className={`contribute-category contribute-category--${section.id}`}
          >
            <div className="contribute-category__header">
              <span className="contribute-category__label">{section.title}</span>
              {section.description && (
                <p className="contribute-category__desc">{section.description}</p>
              )}
            </div>

            <div className="contribute-cards">
              {section.items.map((contentType) => {
                const Icon = contentType.icon;
                return (
                  <button
                    key={contentType.id}
                    type="button"
                    className="contribute-card"
                    onClick={() => openCreatorType(contentType)}
                    aria-haspopup="dialog"
                  >
                    <span className="contribute-card__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="contribute-card__body">
                      <span className="contribute-card__title">{contentType.title}</span>
                      <span className="contribute-card__desc">{contentType.description}</span>
                    </span>
                    <FiArrowRight className="contribute-card__arrow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── Creator Studio ── */}
      <section className="page-section" id="creator-studio">
        <div className="section-heading">
          <h2>Creator Studio</h2>
          <p>Track your drafts, submissions in review, and content that&rsquo;s already live.</p>
        </div>

        {!isAuthenticated && !loading ? (
          <p className="contribute-notice">
            Sign in to load your uploaded content and review queue. Drafts saved on this device stay visible here.
          </p>
        ) : null}

        {/* Shelves */}
        <div className="contribute-studio-grid">
          <StudioShelf title="Drafts" icon={FiEdit3} count={drafts.length} empty="Save a creator form as a draft and it will wait here.">
            {drafts.length ? (
              <div className="contribute-studio-list">
                {drafts.slice(0, 5).map((draft) => (
                  <article className="contribute-row" key={draft.id}>
                    <div className="contribute-row__body">
                      <span className="contribute-row__name">{draft.title}</span>
                      <span className="contribute-row__meta">{draft.creatorTypeTitle} &middot; saved {formatDate(draft.savedAt)}</span>
                    </div>
                    <div className="contribute-row__actions">
                      <button className="contribute-row__btn" type="button" onClick={() => openDraft(draft)}>
                        Edit
                      </button>
                      <button className="contribute-row__btn contribute-row__btn--danger" type="button" onClick={() => setDrafts(removeCreatorDraft(draft.id))}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </StudioShelf>

          <StudioShelf title="Review queue" icon={FiUploadCloud} count={pendingContributions.length} empty="Submissions sent for review will appear here.">
            {contributions.length ? (
              <div className="contribute-studio-list">
                {contributions.slice(0, 5).map((item) => (
                  <article className="contribute-row" key={item.id}>
                    <div className="contribute-row__body">
                      <span className="contribute-row__name">{titleFor(item)}</span>
                      <span className="contribute-row__meta">{typeFor(item)} &middot; submitted {formatDate(item.created_at || item.createdAt)}</span>
                    </div>
                    <span className={`contribute-status contribute-status--${statusFor(item)}`}>
                      {statusFor(item)}
                    </span>
                  </article>
                ))}
              </div>
            ) : null}
          </StudioShelf>

          <StudioShelf title="Published content" icon={FiFileText} count={publishedContent.length} empty="Approved and published content will land here.">
            {publishedContent.length ? (
              <div className="contribute-studio-list">
                {publishedContent.slice(0, 6).map((item) => (
                  <article className="contribute-row" key={`${typeFor(item)}-${item.id}`}>
                    <div className="contribute-row__body">
                      <span className="contribute-row__name">{titleFor(item)}</span>
                      <span className="contribute-row__meta">{typeFor(item)} &middot; published {formatDate(item.published_at || item.created_at)}</span>
                    </div>
                    <span className="contribute-status contribute-status--published">Live</span>
                  </article>
                ))}
              </div>
            ) : null}
          </StudioShelf>
        </div>
      </section>

      <CreatorSubmissionModal
        creatorType={activeCreatorType}
        draft={activeDraft}
        onClose={() => { setActiveCreatorType(null); setActiveDraft(null); }}
        onDraftSaved={setDrafts}
      />
    </div>
  );
}
