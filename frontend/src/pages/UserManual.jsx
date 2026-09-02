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
    id: 'search',
    icon: FiSearch,
    label: 'Search',
    tagline: 'Find anything instantly',
    description:
      'The global search bar at the top of every page lets you search across courses, notes, lessons, past questions, and articles all at once.',
    howTo: [
      'Type a course name, code, or topic in the search bar.',
      'Filter results by type — Notes, Lessons, Past Questions, or Articles.',
      'Tap a result to open it directly.',
    ],
    tips: 'Searching by course code (e.g. "MTH 101") gives the most precise results.',
    href: '/',
  },
  {
    id: 'courses',
    icon: FiBookOpen,
    label: 'Courses',
    tagline: 'Your full academic catalogue',
    description:
      'Browse every course available on Learnda, organised by programme, level, and semester. Each course page shows its lessons, notes, past questions, and study resources.',
    howTo: [
      'Go to Courses from the main navigation.',
      'Filter by programme, level (100–500), or semester to narrow results.',
      'Open a course to see all its available content.',
      'Add extra courses to your profile from Settings → Your Courses.',
    ],
    tips: 'Your programme courses load automatically in your PLS — you only need to add courses you take outside your programme.',
    href: '/learn',
  },
  {
    id: 'learn',
    icon: FiFolder,
    label: 'Learn & Practice',
    tagline: 'Your courses and tests',
    description:
      'Learn and Practice are your study home. Learn brings together your current programme courses and lessons; Practice holds your quizzes and past questions so you can pick up where you left off.',
    howTo: [
      'Open Learn from the sidebar or bottom nav to see all your current courses — tap one to continue.',
      'Open Practice to see your attempted tests and start new ones.',
      'Your progress, XP level, and streak show as you study.',
    ],
    tips: 'Add extra courses from Settings → Your Courses and they will appear in Learn and Practice automatically.',
    href: '/learn',
  },
  {
    id: 'groups',
    icon: FiUsers,
    label: 'Study Groups',
    tagline: 'Study together, achieve more',
    description:
      'Study groups let you collaborate in real time with classmates. Each group has a shared chat room where you can send messages, share files, and coordinate study sessions.',
    howTo: [
      'Go to Study Groups and search for a group by course name or group title.',
      'Click Join — open groups accept you immediately.',
      'Inside the group room, send messages and share files with members.',
      'Start your own group from the Study Groups page by filling in the group details and selecting a course.',
    ],
    tips: 'Groups tied to a specific course show how many members are currently active — choose busier groups for faster responses.',
    href: '/groups',
  },
  {
    id: 'eduvhibe',
    icon: FiLayers,
    label: 'Eduvhibe',
    tagline: 'UCC-focused learning hub',
    description:
      'Eduvhibe is Learnda\'s dedicated section for UCC students. It brings together curated notes, YouTube video tutorials, academic survival guides, and a CGPA calculator in one focused space.',
    howTo: [
      'Open Eduvhibe from the main navigation.',
      'Notes tab: browse and download course notes by level (100–400). Search by title.',
      'Videos tab: watch curated YouTube tutorials filtered by level. Click a card to play.',
      'Survival Guides tab: read academic strategy articles filtered by category (Academic, Lifestyle, Career, Tech, Campus Hacks).',
      'CGPA tab: add courses with their credit hours and letter grades to calculate your semester and cumulative GPA. You can clear a semester and re-enter at any time.',
    ],
    tips: 'The CGPA calculator is for personal use — results are not saved to the server, so keep a copy if you want to refer back later.',
    href: '/eduvhibe',
  },
  {
    id: 'contribute',
    icon: FiUploadCloud,
    label: 'Create Content',
    tagline: 'Share knowledge, earn rewards',
    description:
      'Learnda is creator-powered. Create files, video lessons, survival guides, articles, stories, quotes, fun facts, and jokes for learners across the platform.',
    howTo: [
      'Go to Create Content from the menu and choose the content format that fits your idea.',
      'Upload content — notes as PDF, video lessons as links or direct uploads, articles as rich text.',
      'Content is reviewed before going live.',
      'Track your submissions after review and improve the next upload from learner engagement.',
    ],
    tips: 'Content tagged to specific courses and levels gets significantly more views than untagged uploads.',
    href: '/contribute',
  },
  {
    id: 'settings',
    icon: FiSettings,
    label: 'Settings',
    tagline: 'Manage your account and courses',
    description:
      'Settings is where you control your profile, custom course enrolment, contribution plan, payout details, password, and display preferences.',
    howTo: [
      'Profile tab: update your name and profile photo, and manage your custom course list.',
      'Your Courses: add extra courses via the course picker or remove ones you added yourself.',
      'Academic info (Institution, Programme, Level) is locked after onboarding — contact support to correct it.',
      'Account tab: view and change your contribution plan, update your payout contact number, and change your password.',
      'Preferences tab: switch between Light, Dark, and Auto theme. Toggle interface sounds.',
    ],
    tips: 'Adding extra courses in Settings → Your Courses makes them appear in the Study, Practice, and Groups tabs of your PLS.',
    href: '/settings',
  },
  {
    id: 'practice',
    icon: FiZap,
    label: 'Practice',
    tagline: 'Test yourself, track progress',
    description:
      'The Practice section lets you attempt past questions and test sessions by course. See your scores, review correct answers, and build exam confidence over repeated attempts.',
    howTo: [
      'Open Practice from the navigation.',
      'Select a course to see available test items.',
      'Attempt questions and get feedback on your answers.',
      'Your attempt history is visible in the Practice tab of your PLS.',
    ],
    tips: 'Revisiting past questions from multiple semesters is one of the most effective ways to prepare for exams.',
    href: '/practice',
  },
  {
    id: 'rewards',
    icon: FiAward,
    label: 'Rewards',
    tagline: 'Earn XP, badges, and streak rewards',
    description:
      'Learnda has two reward tracks. The XP system levels you up (Newcomer to Grandmaster) and unlocks badges as you reach milestones. The cash rewards system pays out for maintaining a 7-day streak and referring friends. Contributing content earns you XP — not cash.',
    howTo: [
      'XP is earned automatically each time you complete a lesson, finish a practice attempt, hit a streak milestone, or get a content piece approved.',
      'As your XP total grows, your account level increases and new badges are unlocked — view them all on the Progress page.',
      'For cash rewards: maintain a 7-day learning streak to claim the streak reward from the Rewards section.',
      'Invite friends to unlock additional claimable rewards.',
      'Claim payouts to your registered mobile money number from Settings → Account.',
    ],
    tips: 'Keep your daily streak alive — even a short session counts — because the 7-day streak reward resets if you miss a day.',
    href: '/progress',
  },
  {
    id: 'forum',
    icon: FiMessageSquare,
    label: 'Community',
    tagline: 'Chat live with the whole community',
    description:
      'The Community is a shared real-time chat space for all Learnda students. Send text messages, share voice notes, attach files, and react to messages. External links are blocked to keep the space focused.',
    howTo: [
      'Go to Community Forum from the navigation.',
      'Type a message in the chat input and press Send.',
      'Hold the mic button to record a voice note.',
      'Use the paperclip icon to attach a file or image.',
      'Use the emoji button to open the emoji picker and react to messages.',
      'The Members panel on the right shows who is in the community and their online status.',
    ],
    tips: 'The Info panel on the right has quick links to Learn, Practice, and Groups — handy for jumping to content mid-conversation.',
    href: '/forum',
  },
  {
    id: 'progress',
    icon: FiBarChart2,
    label: 'Progress',
    tagline: 'See how far you\'ve come',
    description:
      'The Progress page shows your full learning profile — XP total, account level (Newcomer to Grandmaster), current streak, lessons and practice completed, and every badge you\'ve earned or are working towards.',
    howTo: [
      'Open Progress from the navigation.',
      'The top section shows your XP, current level name, and how close you are to the next level.',
      'Scroll down to see your badges — both earned and locked. Click a badge to see what it stands for and how to earn it.',
      'Your streak history and lesson/practice completion counts are shown in the stats section.',
      'The leaderboard shows how your XP ranking compares to other students.',
    ],
    tips: 'Badges have different rarity tiers — Common, Uncommon, Rare, Epic, and Legendary. Rarer badges award more bonus XP when unlocked.',
    href: '/progress',
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
        a: 'Click "Get Started" on any page. You\'ll be guided through choosing your institution, programme, and a study plan. Your academic level and programme are set here and cannot be changed later without contacting support.',
      },
      {
        q: 'How do I choose the right plan?',
        a: 'Learnda has three contribution levels: Free Learner (free), Helper, and Hero. Free Learner gives access to the core learning workflow. Helper and Hero unlock more lessons, deeper practice content, and greater contributor access. Visit Contribution Plans to compare in detail.',
      },
      {
        q: 'Can I change my plan later?',
        a: 'Yes — upgrade or downgrade at any time from Settings → Account. Changes take effect on your next billing cycle.',
      },
      {
        q: 'Why is my level locked in Settings?',
        a: 'Your academic level (100, 200, etc.) is tied to your onboarding profile and controls which courses and resources load automatically in your PLS. It is locked to prevent accidental data mismatches. If you need it corrected, contact support with your index number.',
      },
      {
        q: 'How do I set up my profile?',
        a: 'Go to Settings → Profile. You can update your name and profile photo here. Academic details (institution, programme, level) are read-only and were set during onboarding.',
      },
    ],
  },
  {
    id: 'content',
    title: 'Finding and using content',
    items: [
      {
        q: 'How do I find content for my course?',
        a: 'Use the search bar at the top of any page and type your course name or code (e.g. "MTH 101"). You can also browse by programme from the Courses section, or go directly to Eduvhibe for notes, video tutorials, and guides specific to UCC.',
      },
      {
        q: 'What types of content are available?',
        a: 'Learnda hosts past questions, course notes, lesson walkthroughs, YouTube video tutorials (via Eduvhibe), academic survival guides, educative articles, and practice test sessions — all organised by course, level, and semester.',
      },
      {
        q: 'Can I download notes?',
        a: 'Yes — notes on the platform can be downloaded to your device. On Eduvhibe, note cards have a download button that initiates a short countdown before saving the file.',
      },
      {
        q: 'Where does saved content appear?',
        a: 'Content you interact with — courses you study and practice sessions you attempt — is reflected in your PLS under the Study and Practice tabs.',
      },
    ],
  },
  {
    id: 'pls',
    title: 'Personal Learning Space (PLS)',
    items: [
      {
        q: 'What is the Personal Learning Space?',
        a: 'PLS is your private study dashboard. It has two tabs — Study and Practice — and shows your current courses and test attempt history in one place. Your XP level and streak are displayed at the top.',
      },
      {
        q: 'How are my courses loaded into PLS?',
        a: 'Your programme courses load automatically based on your institution, programme, and level set during onboarding. If you study courses outside your programme, add them in Settings → Your Courses and they will appear across the Study and Practice tabs.',
      },
      {
        q: 'How do I add extra courses to my PLS?',
        a: 'Go to Settings → Your Courses, then click "Add Course". A picker opens where you can search by course name or code and filter by programme, level, and semester. Added courses appear in your PLS immediately.',
      },
      {
        q: 'Can I remove a course from my PLS?',
        a: 'You can remove courses that you manually added — they will have a remove button (×) in the Your Courses section of Settings. Courses automatically assigned by your programme cannot be removed, as they are tied to your academic profile.',
      },
      {
        q: 'What are streaks?',
        a: 'Streaks track consecutive days of learning activity. They build a daily study habit and award XP towards your account level. A 7-day streak also unlocks a claimable cash reward from the Rewards section. Missing a day resets your streak.',
      },
      {
        q: 'What does the Practice tab show?',
        a: 'The Practice tab in PLS shows your previous test attempts — which courses you practised and your recent scores. You can jump back into a course\'s practice set directly from there.',
      },
    ],
  },
  {
    id: 'eduvhibe',
    title: 'Eduvhibe',
    items: [
      {
        q: 'What is Eduvhibe?',
        a: 'Eduvhibe is Learnda\'s dedicated learning hub for UCC students. It brings together curated course notes, YouTube video tutorials, academic strategy guides, and a CGPA calculator — all in one focused section accessible from the main navigation.',
      },
      {
        q: 'How do I find notes on Eduvhibe?',
        a: 'Open Eduvhibe and go to the Notes tab. You can search by title or filter by level (100–400). Notes are uploaded by creators and approved before going live. Click a note card to preview or download it.',
      },
      {
        q: 'How does the CGPA calculator work?',
        a: 'Go to Eduvhibe → CGPA tab. Add each course you took in a semester — enter the course name, credit hours, letter grade, and grade points. The calculator shows your semester GPA and cumulative GPA across all semesters. You can import results in bulk or clear a semester and re-enter.',
      },
      {
        q: 'Who can upload content to Eduvhibe?',
        a: 'Creators and admins can upload notes and add video links. If you have creator access, open the Notes or Videos tab and click "Upload Note" or "Add Video". Content is tagged to Eduvhibe so it appears in the right tab automatically.',
      },
      {
        q: 'Are the videos hosted on Learnda?',
        a: 'No — Eduvhibe videos are YouTube links. Creators paste a valid YouTube URL when adding a video. The platform extracts the video ID to display a thumbnail and embeds the video in a player modal when clicked.',
      },
    ],
  },
  {
    id: 'courses-enrollment',
    title: 'Your Courses',
    items: [
      {
        q: 'What is the "Your Courses" section in Settings?',
        a: 'This section in Settings → Your Courses shows the extra courses you have manually added. It is where you manage your personal course list on top of the courses your programme assigns automatically.',
      },
      {
        q: 'How do I add a course that isn\'t in my programme?',
        a: 'In Settings → Your Courses, click "Add Course". A picker modal opens. Search by title, code, or department. Use the Programme, Level, and Semester filters for precision. Click the + button on any course to add it.',
      },
      {
        q: 'Will added courses affect my whole PLS or just one tab?',
        a: 'Added courses appear across both PLS tabs — Study shows lessons for those courses and Practice includes their past questions. It is a full integration across the dashboard.',
      },
      {
        q: 'What happens when I remove a custom course?',
        a: 'It disappears from all PLS tabs immediately. Your programme\'s automatic courses are not affected. You can re-add it at any time from the course picker.',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community and groups',
    items: [
      {
        q: 'How do I join a study group?',
        a: 'Go to Study Groups, search for a group by course name or group title, and click Join. Open groups accept you immediately. Once inside the group room, you can chat with members and share files.',
      },
      {
        q: 'How do I create a study group?',
        a: 'From the Study Groups page, fill in the group creation form — add a name and select the relevant course. Once created, share the group with classmates so they can join.',
      },
      {
        q: 'What is the Community Forum?',
        a: 'The Community Forum is a shared real-time chat space for all Learnda students. It is not a thread or board system — it is a single live chat where you can send text messages, voice notes, and file attachments. External links are blocked automatically to keep the space focused.',
      },
      {
        q: 'Can I reply to a specific message in the community?',
        a: 'The community chat is a continuous conversation — there are no threaded replies or message quoting. If you want to address a specific point, mention it in your message so others have context.',
      },
    ],
  },
  {
    id: 'contributing',
    title: 'Contributing content',
    items: [
      {
        q: 'How do I create content?',
        a: 'Visit Create Content from the menu and start uploading. Notes go as PDF files, videos as YouTube links or direct uploads, and articles as rich text. All content goes through a review before it goes live.',
      },
      {
        q: 'How does creator pay work?',
        a: 'Creators earn based on engagement — downloads, views, and interactions with their content all factor in. When your balance is ready to claim, you can request a payout to your registered mobile money number from Settings → Account.',
      },
      {
        q: 'What content is accepted?',
        a: 'Past questions, course notes, lesson recordings, video tutorials, and academic articles relevant to supported programmes. All content must be accurate, clearly sourced, and original — or properly attributed if based on existing material.',
      },
      {
        q: 'Can I upload content to Eduvhibe directly?',
        a: 'Yes, if you have creator or admin access. Open Eduvhibe, go to the Notes or Videos tab, and use the Upload or Add Video button that appears for creators. The content is automatically tagged to appear in Eduvhibe.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and billing',
    items: [
      {
        q: 'How do I reset my password?',
        a: 'Click "Forgot password" on the sign-in screen. You\'ll receive a reset link by email or SMS within a few minutes. You can also change your password directly from Settings → Account once you are signed in.',
      },
      {
        q: 'How do I cancel or change my contribution plan?',
        a: 'Go to Settings → Account. You can view your current plan and switch to a different level. Downgrading to Friend takes effect after your current active period ends.',
      },
      {
        q: 'How do I set up my payout details?',
        a: 'Go to Settings → Account and enter your mobile money number. The platform detects your network (MTN, Telecel, AT) automatically. Use this number to receive cash rewards from the streak and invite programmes.',
      },
      {
        q: 'I was charged incorrectly. What do I do?',
        a: 'Contact support via the Contact page with your account email and a description of the charge. We investigate and resolve billing issues within 48 hours.',
      },
      {
        q: 'How do I change my institution or programme?',
        a: 'Institution, programme, and level are locked after onboarding because they control which courses load automatically in your PLS. Contact support with your index number and the correction needed — we will update it manually.',
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
              Step-by-step answers for every part of the platform — from creating an account and adding
              courses to contributing content and managing your subscription.
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
