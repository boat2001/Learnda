import { FaFacebookF, FaInstagram, FaTelegram, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import './OurSocials.css';
import './SharedPages.css';

const SOCIAL_GROUPS = [
  {
    group: 'Communication & Updates',
    desc: 'Stay in the loop with announcements, tips, and platform news.',
    channels: [
      {
        name: 'WhatsApp Channel',
        handle: '@sharether',
        purpose: 'Community communication, announcements, and platform updates delivered directly to your phone.',
        cta: 'Join Channel',
        href: 'https://whatsapp.com/channel/0029Vaf7UpGBKfhrqDPK6B1M',
        icon: FaWhatsapp,
        color: '#25d366',
        bg: 'rgba(37, 211, 102, 0.08)',
        border: 'rgba(37, 211, 102, 0.22)',
      },
      {
        name: 'Telegram Channel',
        handle: '@sharether',
        purpose: 'Quick updates, learning tips, and community news in a distraction-free channel.',
        cta: 'Join Channel',
        href: 'https://t.me/sharether',
        icon: FaTelegram,
        color: '#2aabee',
        bg: 'rgba(42, 171, 238, 0.08)',
        border: 'rgba(42, 171, 238, 0.22)',
      },
      {
        name: 'X (Twitter)',
        handle: '@sharether',
        purpose: 'Real-time communication, lighter updates, and the occasional cute moment from the Sharether team.',
        cta: 'Follow',
        href: 'https://x.com/sharether',
        icon: FaXTwitter,
        color: '#000000',
        bg: 'rgba(0, 0, 0, 0.06)',
        border: 'rgba(0, 0, 0, 0.14)',
      },
    ],
  },
  {
    group: 'Video Content',
    desc: 'Watch tutorials, walkthroughs, and short-form content that makes learning click.',
    channels: [
      {
        name: 'YouTube Channel',
        handle: '@sharether',
        purpose: 'Full-length video tutorials, feature walkthroughs, and learning guides to help you get the most out of Sharether.',
        cta: 'Subscribe',
        href: 'https://www.youtube.com/@sharether',
        icon: FaYoutube,
        color: '#ff0000',
        bg: 'rgba(255, 0, 0, 0.07)',
        border: 'rgba(255, 0, 0, 0.2)',
      },
      {
        name: 'TikTok Account',
        handle: '@sharether',
        purpose: 'Short promotional videos, quick study tips, and bite-sized updates about new features and events.',
        cta: 'Follow',
        href: 'https://tiktok.com/@sharether',
        icon: FaTiktok,
        color: '#010101',
        bg: 'rgba(1, 1, 1, 0.06)',
        border: 'rgba(1, 1, 1, 0.14)',
      },
    ],
  },
  {
    group: 'Photos & Community',
    desc: 'See the faces, stories, and moments behind the Sharether community.',
    channels: [
      {
        name: 'Facebook Page',
        handle: 'Sharether',
        purpose: 'Platform updates, community highlights, and photo content — a great place to share and stay connected.',
        cta: 'Like Page',
        href: 'https://www.facebook.com/people/Sharether/61573786536620/',
        icon: FaFacebookF,
        color: '#1877f2',
        bg: 'rgba(24, 119, 242, 0.08)',
        border: 'rgba(24, 119, 242, 0.22)',
      },
      {
        name: 'Instagram',
        handle: '@sharether',
        purpose: 'Photos, reels, and visual stories from the Sharether team and the students who use the platform.',
        cta: 'Follow',
        href: 'https://instagram.com/sharether',
        icon: FaInstagram,
        color: '#e1306c',
        bg: 'rgba(225, 48, 108, 0.08)',
        border: 'rgba(225, 48, 108, 0.22)',
      },
    ],
  },
];

export default function OurSocials() {

  return (
    <div className="page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-community">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Stay connected</span>
            <h1 className="hero-title">Find Sharether where you already spend your time.</h1>
            <p className="hero-subtitle">
              We are active across multiple platforms — each one with a distinct purpose. Pick the channels that fit how you like to stay informed.
            </p>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">7</span>
                <span className="stat-label">Active channels across messaging, video, and social platforms.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Updates</span>
                <span className="stat-label">Platform news, feature drops, and community moments posted regularly.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Community</span>
                <span className="stat-label">Join thousands of students already following our journey.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">Why follow us?</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Be the first to know</strong>
                  <p>New features, content drops, and platform updates land on our socials first.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Learn faster</strong>
                  <p>Video tutorials and tips help you get more from the platform.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Join the community</strong>
                  <p>Connect with fellow students and stay motivated together.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {SOCIAL_GROUPS.map((group) => (
        <section key={group.group} className="page-section">
          <div className="section-heading">
            <h2>{group.group}</h2>
            <p>{group.desc}</p>
          </div>
          <div className="socials-grid">
            {group.channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <div
                  key={channel.name}
                  className="social-card"
                  style={{ '--sc-color': channel.color, '--sc-bg': channel.bg, '--sc-border': channel.border }}
                >
                  <div className="social-card__icon-wrap">
                    <Icon className="social-card__icon" aria-hidden="true" />
                  </div>
                  <div className="social-card__body">
                    <div className="social-card__name">{channel.name}</div>
                    <div className="social-card__handle">{channel.handle}</div>
                    <p className="social-card__purpose">{channel.purpose}</p>
                  </div>
                  <a
                    href={channel.href}
                    className="social-card__cta"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${channel.cta} on ${channel.name}`}
                  >
                    {channel.cta}
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
