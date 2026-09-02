import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Learnda';
const DEFAULT_SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://learnda.app').replace(/\/$/, '');
const DEFAULT_IMAGE = `${DEFAULT_SITE_URL}/learnda-logo.webp`;

const DEFAULT_META = {
  title: 'Learnda | Learn Like Never Before',
  description:
    'Learnda helps students learn smarter with courses, study resources, progress tracking, and focused learning tools.',
  keywords:
    'Learnda, Ghana K-12, NaCCA curriculum, kindergarten, basic school, JHS, SHS, BECE, WASSCE, class-scoped lessons',
  robots: 'index,follow',
  type: 'website'
};

const ROUTE_META = [
  // ─── Dynamic content routes (most specific first) ─────────────────────────────
  {
    match: (path) => path.startsWith('/blog/post/'),
    title: 'Blog | Learnda',
    description: 'Read learning insights, study tips, and educational updates on Learnda.',
    type: 'article'
  },
  {
    match: (path) =>
      path.startsWith('/learn/') && !path.startsWith('/learn/lesson/'),
    title: 'Course | Learnda',
    description: 'Explore course materials, study notes, and learning resources on Learnda.'
  },
  {
    match: (path) => path.startsWith('/learn/lesson/'),
    title: 'Lesson | Learnda',
    description: 'Continue your lesson and improve your study outcomes on Learnda.'
  },
  {
    match: (path) => path.startsWith('/practice/session/'),
    title: 'Practice Session | Learnda',
    description: 'Take a timed practice session and review your answers on Learnda.'
  },
  {
    match: (path) =>
      path.startsWith('/practice/') && !path.startsWith('/practice/session/'),
    title: 'Practice | Learnda',
    description: 'Work through practice questions and past exams for your courses.'
  },
  {
    match: (path) => path.startsWith('/resources/') && path !== '/resources',
    title: 'Resources | Learnda',
    description: 'Browse and download study files, notes, and academic resources on Learnda.'
  },

  // ─── Core platform pages ──────────────────────────────────────────────────────
  {
    match: (path) => path === '/',
    title: 'Learnda | Learn Like Never Before',
    description:
      'Learn with structured courses, study resources, and smart tools built for students.',
    keywords:
      'Learnda, learning platform, student courses, study app, academic resources, Ghana education'
  },
  { match: (path) => path === '/learn',            title: 'Learn | Learnda',            description: 'Browse courses, learning paths, and lessons tailored for students.' },
  { match: (path) => path === '/practice',         title: 'Practice | Learnda',         description: 'Practice with quizzes, past questions, and exams tailored to your courses.' },
  { match: (path) => path === '/resources',        title: 'Resources | Learnda',        description: 'Access study files, past questions, and academic resources for every course.' },
  { match: (path) => path === '/edutainment',      title: 'Edutainment | Learnda',      description: 'Entertaining content that makes learning stick — videos, facts, and study inspiration.' },
  { match: (path) => path === '/edutainment/feed', title: 'Edutainment Feed | Learnda', description: 'Your personalised edutainment feed — bite-sized content to keep you learning.' },
  { match: (path) => path === '/blog',             title: 'Blog | Learnda',             description: 'Study tips, platform updates, and student learning insights from the Learnda team.' },
  { match: (path) => path === '/success-stories',  title: 'Success Stories | Learnda',  description: 'Read how Learnda students are achieving their academic goals.' },
  { match: (path) => path === '/create',            title: 'Create Content | Learnda',   description: 'Share notes, past questions, and study materials to help fellow students.' },
  { match: (path) => path === '/contribute',        title: 'Contribute | Learnda',        description: 'Contribute funds to help keep Learnda alive and improving for students.' },
  { match: (path) => path === '/forum',            title: 'Community Forum | Learnda',  description: 'Chat with students across Ghana, ask questions, and share ideas.' },

  // ─── Company / info pages ─────────────────────────────────────────────────────
  { match: (path) => path === '/about',            title: 'Our Story | Learnda',           description: "One student couldn't find his course materials — so he built Learnda. Today it serves 200,000+ students across Ghana." },
  { match: (path) => path === '/features',         title: 'Contribution Plans | Learnda',    description: 'Start free, then chip in whatever fits your budget. Every contribution keeps Learnda online for students across Ghana.' },
  { match: (path) => path === '/roadmap',          title: 'Platform Roadmap | Learnda',    description: "See what's coming next on Learnda — upcoming features, improvements, and plans." },
  { match: (path) => path === '/events',           title: 'Ambassadors | Learnda',  description: 'Join the Learnda ambassador programme and represent your school.' },
  { match: (path) => path === '/contact',          title: 'Contact Us | Learnda',          description: 'Get in touch with the Learnda team for support, feedback, and partnership enquiries.' },
  { match: (path) => path === '/download',         title: 'Download Learnda',              description: 'Get the Learnda app and take your learning anywhere.' },
  { match: (path) => path === '/team',             title: 'Meet the Team | Learnda',       description: 'The people building Learnda — a student-led team on a mission to improve education in Ghana.' },
  { match: (path) => path === '/policies',         title: 'Policies | Learnda',            description: "Learnda's privacy policy, cookie policy, and platform terms — all in one place." },
  { match: (path) => path === '/terms',            title: 'Terms of Service | Learnda',    description: "Read Learnda's terms of service and understand your rights as a user." },
  { match: (path) => path === '/our-socials',      title: 'Our Socials | Learnda',         description: 'Follow Learnda on social media and stay connected with the community.' },
  { match: (path) => path === '/report',           title: 'Report a Bug | Learnda',        description: 'Found something broken? Help us fix it — report a bug to the Learnda team.' },
  { match: (path) => path === '/feature-requests', title: 'Feature Requests | Learnda',   description: 'Suggest a new feature or vote on what we should build next on Learnda.' },
  { match: (path) => path === '/investments',      title: 'Invest in Learnda',             description: 'Explore investment opportunities and help Learnda scale access to quality education.' },
  { match: (path) => path === '/partnerships',     title: 'Partnerships | Learnda',        description: 'Partner with Learnda to reach students and institutions across Ghana.' },
  { match: (path) => path === '/join',             title: 'Join the Revolution | Learnda', description: 'Be part of the movement transforming student learning in Ghana.' },
  { match: (path) => path === '/user-manual',      title: 'User Manual | Learnda',         description: 'How to get the most out of Learnda — a complete guide to all features and tools.' },

  // ─── PLS (authenticated, private) ────────────────────────────────────────────
  {
    match: (path) => path === '/pls',
    title: 'Personal Learning Space | Learnda',
    description:
      'Track your progress, continue your lessons, and keep learning at your own class level.',
    robots: 'noindex,nofollow'
  },

  // ─── Protected / private routes — no-index ───────────────────────────────────
  {
    match: (path) =>
      path.startsWith('/settings') ||
      path.startsWith('/admin') ||
      path.startsWith('/pls/') ||
      path.startsWith('/onboarding') ||
      path === '/login' ||
      path === '/register' ||
      path === '/notifications' ||
      path === '/reset-password' ||
      path === '/progress' ||
      path === '/groups' ||
      path.startsWith('/groups/') ||
      path === '/invite-friends' ||
      path === '/seven-day-streak' ||
      path === '/contribute-to-earn' ||
      path === '/upgrade',
    title: 'Learnda',
    description: DEFAULT_META.description,
    robots: 'noindex,nofollow'
  }
];

const normalizePath = (pathname) => {
  const value = String(pathname || '/').trim();
  if (!value || value === '/') return '/';
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/+$/, '') || '/';
};

const resolveMeta = (pathname) => {
  const matched = ROUTE_META.find((entry) => entry.match(pathname));
  return { ...DEFAULT_META, ...(matched || {}) };
};

export default function SeoManager() {
  const location = useLocation();
  const path = normalizePath(location.pathname);
  const meta = resolveMeta(path);
  const canonicalUrl = `${DEFAULT_SITE_URL}${path}`;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: DEFAULT_SITE_URL,
    logo: DEFAULT_IMAGE,
    sameAs: [
      'https://twitter.com/learnda',
      'https://github.com/learnda',
      'https://discord.gg/learnda',
      'https://linkedin.com/company/learnda'
    ]
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: DEFAULT_SITE_URL
  };

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="keywords" content={meta.keywords} />
      <meta name="robots" content={meta.robots} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={meta.type} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={DEFAULT_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />

      <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
    </Helmet>
  );
}
