import { useMemo, useState } from 'react';
import {
  FiCheck,
  FiClipboard,
  FiMail,
  FiMessageSquare,
  FiShare2,
} from 'react-icons/fi';
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaReddit,
  FaSnapchat,
  FaTiktok,
  FaTelegram,
  FaViber,
  FaWhatsapp,
  FaXTwitter,
} from 'react-icons/fa6';
import { useAuth } from '../hooks/useAuth';
import './SharedPages.css';

const encode = (value) => encodeURIComponent(value);

export default function InviteFriends() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedChannel, setCopiedChannel] = useState('');

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const code = user?.referral_code || user?.referralCode || user?.id || '';
    const url = new URL('/invite', window.location.origin);
    if (code) url.searchParams.set('ref', code);
    return url.toString();
  }, [user]);

  const inviteText = `Study with me on Learnda — the smarter way to learn together: ${inviteLink}`;

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch { /* ignore */ }
  };

  const copyForChannel = async (label) => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedChannel(label);
      window.setTimeout(() => setCopiedChannel(''), 2400);
    } catch { /* ignore */ }
  };

  const shareNative = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Learnda',
          text: 'Study with me on Learnda — the smarter way to learn together.',
          url: inviteLink,
        });
        return;
      } catch { /* cancelled */ }
    }
    await copyInvite();
  };

  const channels = [
    {
      label: 'WhatsApp',
      Icon: FaWhatsapp,
      color: '#25d366',
      href: `https://wa.me/?text=${encode(inviteText)}`,
    },
    {
      label: 'X',
      Icon: FaXTwitter,
      color: null,
      href: `https://twitter.com/intent/tweet?text=${encode('Study with me on Learnda — the smarter way to learn together.')}&url=${encode(inviteLink)}`,
    },
    {
      label: 'Telegram',
      Icon: FaTelegram,
      color: '#0088cc',
      href: `https://t.me/share/url?url=${encode(inviteLink)}&text=${encode('Study with me on Learnda.')}`,
    },
    {
      label: 'Facebook',
      Icon: FaFacebookF,
      color: '#1877f2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encode(inviteLink)}`,
    },
    {
      label: 'Instagram',
      Icon: FaInstagram,
      color: '#e1306c',
      copyOnly: true,
    },
    {
      label: 'TikTok',
      Icon: FaTiktok,
      color: '#fe2c55',
      copyOnly: true,
    },
    {
      label: 'Snapchat',
      Icon: FaSnapchat,
      color: '#c9960e',
      href: `https://www.snapchat.com/share?url=${encode(inviteLink)}`,
    },
    {
      label: 'LinkedIn',
      Icon: FaLinkedin,
      color: '#0a66c2',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encode(inviteLink)}`,
    },
    {
      label: 'Reddit',
      Icon: FaReddit,
      color: '#ff4500',
      href: `https://reddit.com/submit?url=${encode(inviteLink)}&title=${encode('Join me on Learnda — the smarter way to study')}`,
    },
    {
      label: 'Pinterest',
      Icon: FaPinterest,
      color: '#e60023',
      href: `https://pinterest.com/pin/create/button/?url=${encode(inviteLink)}&description=${encode(inviteText)}`,
    },
    {
      label: 'Viber',
      Icon: FaViber,
      color: '#7360f2',
      href: `viber://forward?text=${encode(inviteText)}`,
    },
    {
      label: 'SMS',
      Icon: FiMessageSquare,
      color: '#34c759',
      href: `sms:?&body=${encode(inviteText)}`,
    },
    {
      label: 'Email',
      Icon: FiMail,
      color: '#ea4335',
      href: `mailto:?subject=${encode('Join me on Learnda')}&body=${encode(inviteText)}`,
    },
  ];

  return (
    <div className="page-shell invite-friends-page">
      <section className="page-hero page-hero-compact page-hero-lean">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Invite friends</span>
            <h1 className="hero-title">Bring your study circle to Learnda.</h1>
            <p className="hero-subtitle">
              Share your personal invite link — every friend you bring makes the community stronger.
            </p>
          </div>
        </div>
      </section>

      <section className="invite-share-section">
        <div className="invite-link-row">
          <span className="invite-link-url" title={inviteLink || 'Sign in to generate your invite link'}>
            {inviteLink || 'Sign in to generate your personal invite link.'}
          </span>
          <button
            type="button"
            className={`invite-copy-btn ${copied ? 'is-copied' : ''}`}
            onClick={copyInvite}
            disabled={!inviteLink}
            aria-label={copied ? 'Copied' : 'Copy invite link'}
          >
            {copied ? <FiCheck aria-hidden /> : <FiClipboard aria-hidden />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <p className="invite-share-label">Share via</p>
        <div className="invite-share-grid">
          {channels.map(({ label, Icon, color, href, copyOnly }) =>
            copyOnly ? (
              <button
                key={label}
                type="button"
                className={`invite-share-btn ${copiedChannel === label ? 'is-channel-copied' : ''}`}
                onClick={() => copyForChannel(label)}
                style={color ? { '--isb-color': color } : undefined}
                aria-label={`Copy link for ${label}`}
                title="Copies your invite link — paste it in the app"
              >
                <Icon aria-hidden className="invite-share-btn__icon" />
                <span>{copiedChannel === label ? 'Copied!' : label}</span>
              </button>
            ) : (
              <a
                key={label}
                className="invite-share-btn"
                href={href}
                target="_blank"
                rel="noreferrer"
                style={color ? { '--isb-color': color } : undefined}
                aria-label={`Share on ${label}`}
              >
                <Icon aria-hidden className="invite-share-btn__icon" />
                <span>{label}</span>
              </a>
            )
          )}

          {typeof navigator !== 'undefined' && navigator.share ? (
            <button
              type="button"
              className="invite-share-btn"
              onClick={shareNative}
              aria-label="Share via system share sheet"
            >
              <FiShare2 aria-hidden className="invite-share-btn__icon" />
              <span>Share</span>
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
