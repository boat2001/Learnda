import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBookOpen, FiPlay, FiFolder, FiUsers,
  FiUploadCloud, FiAward, FiSearch, FiSettings,
  FiMessageSquare, FiHelpCircle, FiFlag,
  FiBarChart2, FiStar, FiX, FiArrowRight, FiLayers,
  FiZap,
} from 'react-icons/fi';
import { FEATURE_FLAGS } from '../config/featureFlags';
import './SharedPages.css';

/* ─── Feature card data ─────────────────────────────────────────────────── */
const ALL_FEATURES = [
  {
    id: 'learn',
    icon: FiBookOpen,
    label: 'Learn',
    tagline: 'Your subjects, for your class',
    description:
      'Learn shows the subjects your class studies. Kindergarten learners see Learning Areas with pictures and audio; Basic, JHS and SHS learners see their subjects for the year.',
    howTo: [
      'Open Learn from the bottom navigation.',
      'Tap a subject to see its lessons.',
      'In Kindergarten and Basic, tap the speaker icon to hear a subject read aloud.',
    ],
    tips: 'Your subjects come from your class. There is nothing to add or remove.',
    href: '/learn',
  },
  {
    id: 'classes',
    icon: FiLayers,
    label: 'Your class',
    tagline: 'One class per school year',
    description:
      'Learnda follows the real school timeline from KG 1 to SHS 3. You study your own class, you can revise every class you have already passed, and classes ahead of you stay locked until the next school year.',
    howTo: [
      'Your class is set once, when you first open Learn.',
      'Use the class strip at the top of Learn or Practice to revise an earlier class.',
      'Classes above yours show a padlock and open next academic year.',
    ],
    tips: 'You move up automatically when the school year turns — there is nothing to do.',
  },
  {
    id: 'practice',
    icon: FiZap,
    label: 'Practice',
    tagline: 'Questions for your class',
    description:
      'Practice sets follow the same class rules as lessons. Basic learners get short, gentle question sets with no pressure. JHS and SHS learners get full practice and exam preparation.',
    howTo: [
      'Open Practice from the bottom navigation.',
      'Choose a subject and work through its question set.',
      'Revise an earlier class using the class strip.',
    ],
    tips: 'Kindergarten has no tests. Learning at that age is for playing, listening and exploring.',
    href: '/practice',
  },
  {
    id: 'my-space',
    icon: FiFolder,
    label: 'My Space',
    tagline: 'Everything you saved',
    description:
      'My Space holds the lessons and files you have saved, organised into folders you create.',
    howTo: [
      'Save a lesson or file while reading it.',
      'Open My Space from the bottom navigation.',
      'Create folders to group what you have saved.',
    ],
    href: '/my-space',
  },
  {
    id: 'search',
    icon: FiSearch,
    label: 'Search',
    tagline: 'Find a subject or lesson',
    description:
      'Search looks across the subjects and lessons available to your class. It will never return content from a class above yours.',
    howTo: [
      'Type a subject or topic in the search bar at the top of any page.',
      'Tap a result to open it.',
    ],
  },
  {
    id: 'progress',
    icon: FiBarChart2,
    label: 'Progress',
    tagline: 'Points, stages and streaks',
    description:
      'You earn Learning Points as you study. Points move you through Stages, from Beginner to Master Learner, and a day streak counts the days you keep learning.',
    howTo: [
      'Complete lessons and practice sets to earn Learning Points.',
      'Open Progress to see your Stage and your streak.',
    ],
    tips: 'Stages are about your own learning, not a competition with other learners.',
    href: '/progress',
  },
  {
    id: 'groups',
    icon: FiUsers,
    label: 'Study groups',
    tagline: 'Study together, JHS and SHS',
    description:
      'Study groups let JHS and SHS learners work through a subject together. They are not available in Kindergarten or Basic school.',
    howTo: [
      'Open a subject and choose its study group.',
      'Post questions and answers for your classmates.',
    ],
  },
  {
    id: 'forum',
    icon: FiMessageSquare,
    label: 'Community',
    tagline: 'Ask and answer, JHS and SHS',
    description:
      'The community is a moderated space for JHS and SHS learners to ask questions about their subjects.',
    howTo: [
      'Open Community from the More menu.',
      'Ask a question or answer one.',
    ],
  },
  {
    id: 'create',
    icon: FiUploadCloud,
    label: 'Contribute',
    tagline: 'Share what you know',
    description:
      'Teachers and approved contributors can submit lessons and practice questions for a subject and class.',
    howTo: [
      'Open Contribute and choose a subject and class.',
      'Submit your material for review before it is published.',
    ],
    href: '/create',
  },
  {
    id: 'settings',
    icon: FiSettings,
    label: 'Settings',
    tagline: 'Your account',
    description:
      'Update your name, photo and contact details. Your class is shown here but cannot be edited.',
    howTo: [
      'Open Settings from the More menu.',
      'Edit your profile details and save.',
    ],
    href: '/settings',
  },
];

const DORMANT_FEATURE_IDS = {
  groups: FEATURE_FLAGS.studyGroups,
  forum: FEATURE_FLAGS.community,
};
const FEATURES = ALL_FEATURES.filter(
  (feature) => !(feature.id in DORMANT_FEATURE_IDS) || DORMANT_FEATURE_IDS[feature.id]
);

/* ─── FAQ sections ──────────────────────────────────────────────────────── */
const ALL_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Tap "Get Started" on any page and sign up with your phone number or email. You only need your name to get in — you choose your class the first time you open Learn.',
      },
      {
        q: 'Which class should I choose?',
        a: 'Choose the class you are actually in at school this year, from KG 1 to SHS 3. Your lessons and practice all come from that class, so it needs to be right.',
      },
      {
        q: 'I chose the wrong class. Can I change it?',
        a: 'Not by yourself. Your class moves up automatically each school year, so it is not something you set again. If it is wrong, ask a parent or your school to correct it for you.',
      },
      {
        q: 'I am in SHS. What is a learning area?',
        a: 'Your learning area is the pathway you are offering — Science, General Arts, Business, Applied Technology, Home Economics, Art, Agriculture, Languages, or STEM. It decides which elective subjects you study alongside your core subjects.',
      },
    ],
  },
  {
    id: 'classes-and-content',
    title: 'Classes and content',
    items: [
      {
        q: 'Why can I not see the next class?',
        a: 'Learnda follows the real school timeline. You study your own class, and classes above yours stay locked until the next academic year. This is deliberate — it keeps you learning at the right level instead of jumping ahead.',
      },
      {
        q: 'Can I go back to an earlier class?',
        a: 'Yes. Every class you have already passed stays open for revision. Use the class strip at the top of Learn or Practice and pick an earlier class.',
      },
      {
        q: 'When do I move up a class?',
        a: 'At the start of each academic year, in September. It happens automatically — you will see a short message welcoming you to your new class.',
      },
      {
        q: 'Why do I see different subjects from my friend?',
        a: 'Subjects come from your class. A Basic 3 learner and a JHS 1 learner study different subjects. In SHS, your learning area also changes which electives you see.',
      },
    ],
  },
  {
    id: 'kindergarten',
    title: 'For Kindergarten and parents',
    items: [
      {
        q: 'Are there tests in Kindergarten?',
        a: 'No. There are no exams and no quizzes in KG 1 or KG 2. Learning at that age is for listening, looking and playing, so Practice does not appear at all.',
      },
      {
        q: 'My child cannot read yet. Can they still use Learnda?',
        a: 'Yes. Kindergarten uses big pictures and audio. Tap the speaker icon on any Learning Area to hear its name read aloud, and lessons are audio-first.',
      },
      {
        q: 'Can my child chat with other users?',
        a: 'No. Community and messaging are switched off entirely for Kindergarten and Basic school learners.',
      },
    ],
  },
  {
    id: 'progress',
    title: 'Progress and awards',
    items: [
      {
        q: 'What are Learning Points?',
        a: 'You earn Learning Points for finishing lessons and practice sets. They add up over time and move you through Stages.',
      },
      {
        q: 'What are Stages?',
        a: 'Stages run from Beginner to Master Learner and show how much you have studied on Learnda. They are separate from your class at school — a Basic 2 learner and an SHS 2 learner can both be at any Stage.',
      },
      {
        q: 'What is a day streak?',
        a: 'It counts the days in a row you have learnt something. Missing a day resets it, and that is fine — it is meant to encourage you, not to worry you.',
      },
    ],
  },
  {
    id: 'community',
    title: 'Study groups and community',
    items: [
      {
        q: 'Who can join a study group?',
        a: 'JHS and SHS learners only. Groups are organised by subject so you study with classmates working on the same material.',
      },
      {
        q: 'Why can I not see the community?',
        a: 'Community features are limited to JHS and SHS. They are switched off for Kindergarten and Basic school to keep younger learners safe.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and support',
    items: [
      {
        q: 'How do I change my name or photo?',
        a: 'Open Settings, edit your profile details and save. Your class is shown there but cannot be edited.',
      },
      {
        q: 'Does Learnda work offline?',
        a: 'Yes. Lessons you have opened stay available without a connection, at every level.',
      },
      {
        q: 'Something is wrong. How do I report it?',
        a: 'Use the Report an issue button at the top of this page, or contact support directly.',
      },
    ],
  },
];

const SECTIONS = ALL_SECTIONS.filter(
  (section) => section.id !== 'community' || FEATURE_FLAGS.studyGroups || FEATURE_FLAGS.community
);

/* ─── Feature card modal ───────────────────────────────────────────────── */
function FeatureModal({ feature, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const Icon = feature.icon;

  return (
    <div className="um-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="um-modal"
        role="dialog"
        aria-modal="true"
        aria-label={feature.label}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <div className="um-modal-icon">
            <Icon size={20} />
          </div>
          <div className="um-modal-header-copy">
            <span className="um-modal-tagline">{feature.tagline}</span>
            <h3 className="um-modal-title">{feature.label}</h3>
          </div>
          <button type="button" className="um-modal-close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="um-modal-body">
          <p className="um-modal-description">{feature.description}</p>

          <div className="um-modal-how">
            <p className="um-modal-section-label">How to use it</p>
            <ol className="um-modal-steps">
              {feature.howTo.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {feature.tips && (
            <div className="um-modal-tip">
              <FiStar size={13} />
              <span>{feature.tips}</span>
            </div>
          )}
        </div>

        <div className="um-modal-footer">
          <button type="button" className="um-modal-cancel" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="um-modal-go"
            onClick={() => { onClose(); navigate(feature.href); }}
          >
            Go to {feature.label} <FiArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function UserManual() {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState(null);
  const [activeFeature, setActiveFeature] = useState(null);

  const toggle = (id) => setOpenItem((prev) => (prev === id ? null : id));

  return (
    <div className="page-shell">
      {activeFeature && (
        <FeatureModal
          feature={activeFeature}
          onClose={() => setActiveFeature(null)}
        />
      )}

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-support">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Help centre</span>
            <h1 className="hero-title">
              Everything you need to get the most out of Learnda.
            </h1>
            <p className="hero-subtitle">
              Step-by-step answers for every part of Learnda — from choosing your class to
              revising an earlier year and keeping track of your progress.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => navigate('/contact')}>
                Contact support
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate('/report')}>
                Report an issue
              </button>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">Jump to a section</p>
            <div className="panel-list">
              {SECTIONS.slice(0, 5).map((section) => (
                <div
                  key={section.id}
                  className="panel-list-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="panel-dot" />
                  <div><strong>{section.title}</strong></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Platform features</h2>
          <p>Click any card to see what it does and how to use it.</p>
        </div>
        <div className="trending-highlights-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                type="button"
                className="info-card um-feature-card"
                onClick={() => setActiveFeature(feature)}
              >
                <div className="um-card-icon-row">
                  <span className="um-card-icon"><Icon size={16} /></span>
                  <span className="um-card-tap-hint">Tap to learn more</span>
                </div>
                <h3>{feature.label}</h3>
                <p>{feature.tagline}</p>
              </button>
            );
          })}
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="page-section">
          <div className="section-heading">
            <h2>{section.title}</h2>
          </div>
          <div className="faq-list">
            {section.items.map((item) => {
              const id = `${section.id}-${item.q}`;
              return (
                <div key={id} className="faq-item">
                  <button
                    className="faq-toggle"
                    type="button"
                    onClick={() => toggle(id)}
                    aria-expanded={openItem === id}
                  >
                    <span>{item.q}</span>
                    <span className="faq-chevron">{openItem === id ? '−' : '+'}</span>
                  </button>
                  {openItem === id && <div className="faq-body">{item.a}</div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="page-section split-grid">
        <div className="info-card">
          <FiHelpCircle size={18} style={{ color: 'var(--primary-color)' }} />
          <h3>Still need help?</h3>
          <p>Our support team replies within 24–48 hours. Reach out with your account email and a clear description of the issue.</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/contact')}>
            Contact support
          </button>
        </div>
        <div className="info-card">
          <FiFlag size={18} style={{ color: 'var(--primary-color)' }} />
          <h3>Found a bug?</h3>
          <p>Report broken features, incorrect content, or anything that isn't working the way it should.</p>
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/report')}>
            Report an issue
          </button>
        </div>
      </section>
    </div>
  );
}
