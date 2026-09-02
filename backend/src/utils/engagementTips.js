const DEFAULT_CTA_PATH = '/pls';

const tip = (id, label, tone, title, message, ctaLabel, ctaPath = DEFAULT_CTA_PATH) => ({
  id,
  label,
  tone,
  title,
  message,
  ctaLabel,
  ctaPath,
});

const STUDY_TIPS = [
  tip(
    'pomodoro',
    'Pomodoro focus',
    'productivity',
    'Study tip',
    'Hey {name}, try 25 minutes of deep focus, then a 5-minute break. Small bursts beat marathon cramming every time.',
    'Start a focus block',
    '/pls'
  ),
  tip(
    'active_recall',
    'Active recall',
    'learning',
    'Study tip',
    '{name}, close your notes and explain the topic out loud. If you can teach it, you truly know it.',
    'Practice recall',
    '/practice'
  ),
  tip(
    'spaced_review',
    'Spaced review',
    'learning',
    'Study tip',
    'Hi {name}! Review yesterday’s topic for 10 minutes today. Spaced repetition is one of the strongest memory hacks.',
    'Quick review',
    '/learn'
  ),
  tip(
    'past_questions',
    'Past questions',
    'exams',
    'Study tip',
    '{name}, examiners repeat patterns. Practise a few past questions on Sharether before class tests and finals.',
    'Try past questions',
    '/practice'
  ),
  tip(
    'study_group',
    'Study with others',
    'collaboration',
    'Study tip',
    'Hey {name}, teaching a friend one concept helps you master two. Jump into a study group and compare notes.',
    'Join a group',
    '/pls'
  ),
  tip(
    'phone_away',
    'Phone-free zone',
    'focus',
    'Study tip',
    '{name}, put your phone in another room for one study block. Your future grades will thank you.',
    'Focus now',
    '/pls'
  ),
  tip(
    'sleep_rest',
    'Rest matters',
    'wellness',
    'Study tip',
    'Hi {name} 💤 Sleep consolidates memory. A rested brain learns faster than an exhausted one.',
    'Plan tomorrow',
    '/pls'
  ),
  tip(
    'break_big_tasks',
    'Chunk your work',
    'productivity',
    'Study tip',
    '{name}, split big topics into tiny tasks: read → summarise → quiz. Check off one piece at a time on Sharether.',
    'Open your plan',
    '/pls'
  ),
  tip(
    'same_day_review',
    'Same-day review',
    'learning',
    'Study tip',
    'Hey {name}, spend 15 minutes tonight revisiting what you learned today. It locks knowledge in place.',
    'Review today',
    '/learn'
  ),
  tip(
    'timed_practice',
    'Timed practice',
    'exams',
    'Study tip',
    '{name}, simulate exam pressure with a timed quiz. Sharether practice mode helps you build speed and confidence.',
    'Timed quiz',
    '/practice'
  ),
  tip(
    'write_summaries',
    'One-page summary',
    'revision',
    'Study tip',
    'Hi {name}! After each lesson, write a one-page summary in your own words. It exposes gaps instantly.',
    'Summarise a lesson',
    '/learn'
  ),
  tip(
    'morning_slot',
    'Morning power hour',
    'habits',
    'Study tip',
    '{name}, protect one morning hour for your hardest course. Willpower is highest when the day is fresh.',
    'Schedule study',
    '/pls'
  ),
];

const SHARETHER_TIPS = [
  tip(
    'pls_overview',
    'Your learning space',
    'basics',
    'Sharether tip',
    'Hey {name}, your Personal Learning Space keeps courses, progress, and saved items in one place. Open it when you log in.',
    'Open PLS',
    '/pls'
  ),
  tip(
    'practice_mode',
    'Practice tests',
    'practice',
    'Sharether tip',
    '{name}, use Practice on Sharether to test yourself with real-style questions and track what you get wrong.',
    'Go to Practice',
    '/practice'
  ),
  tip(
    'download_resources',
    'Download resources',
    'resources',
    'Sharether tip',
    'Hi {name}! Found a useful PDF or note? Download it from Resources so you can study offline on the go.',
    'Browse resources',
    '/learn'
  ),
  tip(
    'study_groups_feature',
    'Study groups',
    'community',
    'Sharether tip',
    '{name}, create or join a study group on Sharether to share files, voice notes, and questions with classmates.',
    'Find groups',
    '/pls'
  ),
  tip(
    'track_progress',
    'Track progress',
    'progress',
    'Sharether tip',
    'Hey {name}, check your progress dashboard to see streaks, XP, and completed lessons — small wins add up.',
    'View progress',
    '/progress'
  ),
  tip(
    'edutainment',
    'Edutainment break',
    'fun',
    'Sharether tip',
    '{name}, take a light break with Edutainment on Sharether — learn something new without heavy textbook mode.',
    'Explore edutainment',
    '/edutainment'
  ),
  tip(
    'lesson_resume',
    'Resume lessons',
    'lessons',
    'Sharether tip',
    'Hi {name}! Pick up exactly where you stopped — open your last lesson and continue in one tap.',
    'Continue lesson',
    '/learn'
  ),
  tip(
    'course_filters',
    'Find your course fast',
    'navigation',
    'Sharether tip',
    '{name}, filter Learn by programme or semester so you reach the right course notes in seconds.',
    'Browse courses',
    '/learn'
  ),
  tip(
    'invite_classmate',
    'Invite a classmate',
    'community',
    'Sharether tip',
    'Hey {name}, learning is better together. Invite a course mate to Sharether and compare notes in a group.',
    'Invite friends',
    '/invite-friends'
  ),
  tip(
    'notifications_inbox',
    'Stay in the loop',
    'account',
    'Sharether tip',
    '{name}, turn on notifications for assignment reminders and platform updates so you never miss a beat.',
    'Open Sharether',
    '/pls'
  ),
  tip(
    'practice_wrong_answers',
    'Redo wrong answers',
    'practice',
    'Sharether tip',
    'Hi {name}! After practice, revisit questions you missed — that is where the real learning happens.',
    'Retry practice',
    '/practice'
  ),
  tip(
    'semester_organisation',
    'Semester organisation',
    'organisation',
    'Sharether tip',
    '{name}, align your PLS with this semester’s courses so every lecture and quiz stays one click away.',
    'Organise PLS',
    '/pls'
  ),
];

const studyById = new Map(STUDY_TIPS.map((entry) => [entry.id, entry]));
const sharetherById = new Map(SHARETHER_TIPS.map((entry) => [entry.id, entry]));

const resolveEngagementTip = (category, tipId, overrides = {}) => {
  const cat = String(category || '').trim();
  const catalog = cat === 'sharether' ? SHARETHER_TIPS : STUDY_TIPS;
  const map = cat === 'sharether' ? sharetherById : studyById;
  const picked = tipId ? map.get(tipId) : null;
  const fallback = catalog[0];

  const notificationType = cat === 'sharether' ? 'sharether_tip' : 'study_tip';
  const notificationTitle = overrides.title || picked?.title || fallback.title;

  return {
    category: cat === 'sharether' ? 'sharether' : 'study',
    tipId: picked?.id || fallback.id,
    notificationType,
    notificationTitle,
    message: overrides.message || picked?.message || fallback.message,
    ctaLabel: overrides.ctaLabel || picked?.ctaLabel || 'Open Sharether',
    ctaPath: overrides.ctaPath || picked?.ctaPath || DEFAULT_CTA_PATH,
    tipMeta: picked || fallback,
  };
};

module.exports = {
  STUDY_TIPS,
  SHARETHER_TIPS,
  resolveEngagementTip,
};
