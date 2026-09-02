const SHARETHER_SOCIAL_GROUPS = [
  {
    group: 'Social Media Handles',
    desc: 'Public pages and handles for quick follows, replies, and general Sharether activity.',
    channels: [
      {
        name: 'X',
        handle: '@sharether',
        purpose: 'Fast conversations, public announcements, and quick Sharether notes.',
        cta: 'Follow',
        href: 'https://x.com/sharether',
        iconKey: 'x',
        color: '#111827',
        bg: 'rgba(17, 24, 39, 0.08)',
        border: 'rgba(17, 24, 39, 0.16)',
      },
      {
        name: 'Facebook',
        handle: 'Sharether',
        purpose: 'Community posts, page updates, and longer social announcements.',
        cta: 'Like',
        href: 'https://www.facebook.com/people/Sharether/61573786536620/',
        iconKey: 'facebook',
        color: '#1877f2',
        bg: 'rgba(24, 119, 242, 0.1)',
        border: 'rgba(24, 119, 242, 0.24)',
      },
    ],
  },
  {
    group: 'Messages & Updates',
    desc: 'Direct channels for announcements, release notes, reminders, and community messages.',
    channels: [
      {
        name: 'WhatsApp Channel',
        handle: '@sharether',
        purpose: 'Announcements, community notes, and quick platform updates delivered to your phone.',
        cta: 'Join',
        href: 'https://whatsapp.com/channel/0029Vaf7UpGBKfhrqDPK6B1M',
        iconKey: 'whatsapp',
        color: '#25d366',
        bg: 'rgba(37, 211, 102, 0.1)',
        border: 'rgba(37, 211, 102, 0.24)',
      },
      {
        name: 'Telegram Channel',
        handle: '@sharether',
        purpose: 'Learning tips, launch notes, and focused update drops in a quiet channel.',
        cta: 'Join',
        href: 'https://t.me/sharether',
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
        handle: '@sharether',
        purpose: 'Tutorials, walkthroughs, and longer Sharether explainers.',
        cta: 'Subscribe',
        href: 'https://www.youtube.com/@sharether',
        iconKey: 'youtube',
        color: '#ff0000',
        bg: 'rgba(255, 0, 0, 0.09)',
        border: 'rgba(255, 0, 0, 0.2)',
      },
      {
        name: 'TikTok',
        handle: '@sharether',
        purpose: 'Short study tips, product moments, and quick platform videos.',
        cta: 'Follow',
        href: 'https://tiktok.com/@sharether',
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
        handle: '@sharether',
        purpose: 'Photos, reels, community stories, cute moments, and visual updates.',
        cta: 'Follow',
        href: 'https://instagram.com/sharether',
        iconKey: 'instagram',
        color: '#e1306c',
        bg: 'rgba(225, 48, 108, 0.1)',
        border: 'rgba(225, 48, 108, 0.22)',
      },
    ],
  },
];

const SHARETHER_SOCIAL_CHANNELS = SHARETHER_SOCIAL_GROUPS.flatMap((group) =>
  group.channels.map((channel) => ({ ...channel, group: group.group }))
);

export { SHARETHER_SOCIAL_CHANNELS, SHARETHER_SOCIAL_GROUPS };
