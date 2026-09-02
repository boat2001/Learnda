const config = require('../config/env');

/** Shown in-app — never expose internal campaign name to users. */
const USER_NOTIFICATION_TYPE = 'learning_reminder';
const USER_NOTIFICATION_TITLE = 'Learnda missing you';
const DEFAULT_CTA_LABEL = 'Open your personal learning space';
const DEFAULT_CTA_PATH = '/pls';

const REENGAGEMENT_MESSAGE_TEMPLATES = [
  {
    id: 'gentle_comeback',
    label: 'Gentle check-in',
    tone: 'gentle',
    message:
      'Hey {name}, your courses and saved progress are still here whenever you are ready. No rush — pick up one lesson today and keep moving.',
    ctaLabel: DEFAULT_CTA_LABEL,
  },
  {
    id: 'sweet_note',
    label: 'Sweet & warm',
    tone: 'sweet',
    message:
      'Hi {name} 💛 Learnda has been quieter without you. Your study space, groups, and materials are waiting — drop in when you can.',
    ctaLabel: 'Visit your space',
  },
  {
    id: 'friendly_nudge',
    label: 'Friendly nudge',
    tone: 'nice',
    message:
      'Hello {name}! A quick study session can make a big difference. Open Learnda and continue where you left off.',
    ctaLabel: 'Continue learning',
  },
  {
    id: 'study_buddy',
    label: 'Study buddy',
    tone: 'interesting',
    message:
      '{name}, your future self will thank you for one focused block today. Lessons, practice, and notes are ready on Learnda.',
    ctaLabel: 'Start a session',
  },
  {
    id: 'campus_energy',
    label: 'Campus energy',
    tone: 'interesting',
    message:
      'Hey {name}! Classmates are still learning on Learnda — jump back in, review a topic, and stay in the loop.',
    ctaLabel: 'See what’s new',
  },
  {
    id: 'light_humor',
    label: 'Light humor',
    tone: 'funny',
    message:
      '{name}, your books called. They said you ghosted them 😄 Come say hi on Learnda — even 15 minutes counts.',
    ctaLabel: 'Answer the books',
  },
  {
    id: 'exam_mode',
    label: 'Exam mode',
    tone: 'funny',
    message:
      'Plot twist, {name}: the syllabus did not pause while you were away. Learnda still has your practice questions ready.',
    ctaLabel: 'Practice now',
  },
  {
    id: 'streak_tease',
    label: 'Streak tease',
    tone: 'funny',
    message:
      '{name}, your streak is giving us the silent treatment. One login, one lesson — let’s bring it back to life on Learnda.',
    ctaLabel: 'Revive my streak',
  },
  {
    id: 'motivational',
    label: 'Motivational',
    tone: 'nice',
    message:
      '{name}, small steps every day beat cramming later. Learnda is set up to help you learn smarter — open your space and take the next step.',
    ctaLabel: 'Take the next step',
  },
  {
    id: 'community_waiting',
    label: 'Community waiting',
    tone: 'gentle',
    message:
      'Hi {name}, your study groups and saved content are still active on Learnda. Reconnect today and keep your momentum going.',
    ctaLabel: 'Reconnect on Learnda',
  },
];

const templateById = new Map(REENGAGEMENT_MESSAGE_TEMPLATES.map((t) => [t.id, t]));

const getPublicBaseUrl = () =>
  String(config.app?.publicUrl || process.env.APP_PUBLIC_URL || 'https://learnda.app').replace(/\/$/, '');

const getEngagementCta = (ctaPath = DEFAULT_CTA_PATH) => {
  const base = getPublicBaseUrl();
  const path = String(ctaPath || DEFAULT_CTA_PATH).startsWith('/')
    ? ctaPath
    : `/${ctaPath}`;
  return `${base}${path}`;
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const personalizeMessage = (template, name) =>
  String(template || '').replace(/\{name\}/g, name);

const resolveMessageTemplate = (settings = {}, body = {}) => {
  const templateId = body.messageTemplateId || settings.messageTemplateId;
  const fromCatalog = templateId ? templateById.get(templateId) : null;
  const custom = body.messageTemplate || settings.messageTemplate;
  const message = custom || fromCatalog?.message || REENGAGEMENT_MESSAGE_TEMPLATES[0].message;
  const ctaLabel = body.ctaLabel || settings.ctaLabel || fromCatalog?.ctaLabel || DEFAULT_CTA_LABEL;
  const ctaPath = body.ctaPath || settings.ctaPath || DEFAULT_CTA_PATH;
  return {
    messageTemplate: message,
    messageTemplateId: templateId || fromCatalog?.id || REENGAGEMENT_MESSAGE_TEMPLATES[0].id,
    ctaLabel,
    ctaPath,
    templateMeta: fromCatalog,
  };
};

const buildEngagementEmailHtml = ({ title, name, message, ctaLabel, ctaUrl }) => {
  const safeName = name || 'there';
  const heading = title || USER_NOTIFICATION_TITLE;
  const body = escapeHtml(personalizeMessage(message, safeName));
  const label = escapeHtml(ctaLabel || DEFAULT_CTA_LABEL);
  const url = escapeHtml(ctaUrl || getEngagementCta());

  return `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${body}</p>
    <a href="${url}" style="display:inline-block;margin:8px 0 20px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>
    <p style="margin:0;font-size:13px;color:#9ca3af;">Or copy this link: <a href="${url}" style="color:#1f56db;">${url}</a></p>
  `;
};

const buildEngagementSmsText = ({ title, name, message, ctaLabel, ctaUrl }) => {
  const heading = title || USER_NOTIFICATION_TITLE;
  const body = personalizeMessage(message, name);
  const label = ctaLabel || DEFAULT_CTA_LABEL;
  const url = ctaUrl || getEngagementCta();
  return `${heading}\n\n${body}\n\n${label}: ${url}`;
};

const buildEngagementEmailText = ({ title, name, message, ctaLabel, ctaUrl }) =>
  buildEngagementSmsText({ title, name, message, ctaLabel, ctaUrl });

module.exports = {
  USER_NOTIFICATION_TYPE,
  USER_NOTIFICATION_TITLE,
  DEFAULT_CTA_LABEL,
  DEFAULT_CTA_PATH,
  REENGAGEMENT_MESSAGE_TEMPLATES,
  getEngagementCta,
  personalizeMessage,
  resolveMessageTemplate,
  buildEngagementEmailHtml,
  buildEngagementEmailText,
  buildEngagementSmsText,
};
