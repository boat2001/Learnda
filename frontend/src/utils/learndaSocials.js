const LEARNDA_SOCIAL_GROUPS = [
  {
    group: 'Social Media Handles',
    desc: 'Public pages and handles for quick follows, replies, and general Learnda activity.',
    channels: [
      {
        name: 'X',
        handle: '@learnda',
        purpose: 'Fast conversations, public announcements, and quick Learnda notes.',
        cta: 'Follow',
        href: 'https://x.com/learnda',
        iconKey: 'x',
        color: '#111827',
        bg: 'rgba(17, 24, 39, 0.08)',
        border: 'rgba(17, 24, 39, 0.16)',
      },
    ],
  },
  {
    group: 'Messages & Updates',
    desc: 'Direct channels for announcements, release notes, reminders, and community messages.',
    channels: [
      {
        name: 'Telegram Channel',
        handle: '@learnda',
        purpose: 'Learning tips, launch notes, and focused update drops in a quiet channel.',
        cta: 'Join',
        href: 'https://t.me/learnda',
        iconKey: 'telegram',
        color: '#2aabee',
        bg: 'rgba(42, 171, 238, 0.1)',
        border: 'rgba(42, 171, 238, 0.24)',
      },
    ],
  },
  {
    group: 'Videos',
    desc: 'Watch long tutorials, short explainers, product moments, and study tips.',
    channels: [
      {
        name: 'YouTube',
        handle: '@learnda',
        purpose: 'Tutorials, walkthroughs, and longer Learnda explainers.',
        cta: 'Subscribe',
        href: 'https://www.youtube.com/@learnda',
        iconKey: 'youtube',
        color: '#ff0000',
        bg: 'rgba(255, 0, 0, 0.09)',
        border: 'rgba(255, 0, 0, 0.2)',
      },
      {
        name: 'TikTok',
        handle: '@learnda',
        purpose: 'Short study tips, product moments, and quick platform videos.',
        cta: 'Follow',
        href: 'https://tiktok.com/@learnda',
        iconKey: 'tiktok',
        color: '#111827',
        bg: 'rgba(17, 24, 39, 0.08)',
        border: 'rgba(17, 24, 39, 0.16)',
      },
    ],
  },
  {
    group: 'Photos & Cute Updates',
    desc: 'Visual stories, photos, reels, behind-the-scenes moments, and lighter community updates.',
    channels: [
      {
        name: 'Instagram',
        handle: '@learnda',
        purpose: 'Photos, reels, community stories, cute moments, and visual updates.',
        cta: 'Follow',
        href: 'https://instagram.com/learnda',
        iconKey: 'instagram',
        color: '#e1306c',
        bg: 'rgba(225, 48, 108, 0.1)',
        border: 'rgba(225, 48, 108, 0.22)',
      },
    ],
  },
];

const LEARNDA_SOCIAL_CHANNELS = LEARNDA_SOCIAL_GROUPS.flatMap((group) =>
  group.channels.map((channel) => ({ ...channel, group: group.group }))
);

export { LEARNDA_SOCIAL_CHANNELS, LEARNDA_SOCIAL_GROUPS };
