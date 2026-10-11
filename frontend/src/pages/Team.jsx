import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CelebrationContributors from '../components/common/CelebrationContributors';
import { FiArrowRight, FiFacebook, FiGithub, FiInstagram, FiLinkedin, FiLink, FiMail, FiPhone, FiTwitter, FiX, FiYoutube } from 'react-icons/fi';
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '../hooks/useAuth';
import { lockBodyScroll } from '../utils/bodyScrollLock';
import api, { resolveUploadUrl } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
import './SharedPages.css';
import './Team.css';

const ACCENTS = ['#38bdf8', '#34d399', '#f97316'];

const SOCIAL_ICONS = {
  twitter:   FiTwitter,
  x:         FiTwitter,
  instagram: FiInstagram,
  facebook:  FiFacebook,
  linkedin:  FiLinkedin,
  youtube:   FiYoutube,
  tiktok:    SiTiktok,
  whatsapp:  FaWhatsapp,
  telegram:  FaTelegramPlane,
  github:    FiGithub,
  website:   FiLink,
};
const ACCENT_GRADIENTS = [
  'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)',
  'linear-gradient(135deg, #34d399 0%, #f97316 100%)',
  'linear-gradient(135deg, #f97316 0%, #38bdf8 100%)',
];

const BASE_ASSET = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

const resolveTeamPhoto = (photo) => {
  if (!photo) return null;
  if (/^https?:\/\//i.test(photo)) return photo;
  if (photo.startsWith('/uploads/')) return resolveUploadUrl(photo);
  return `${BASE_ASSET}${photo.replace(/^\//, '')}`;
};

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

function TeamAvatar({ name, photo, className }) {
  const [errored, setErrored] = useState(false);
  const src = resolveTeamPhoto(photo);
  if (src && !errored) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} tm-avatar--photo`}
        onError={() => setErrored(true)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <div className={className}>{getInitials(name)}</div>;
}

// Learnda has no published team roster yet. The forked platform's roster (real people, photos,
// personal socials, and COE testimonials) was removed per dev guide §10 / §11.
// Populate via the site-content admin endpoint, or fill these arrays.
const FALLBACK_TEAM = {
  core_team: [],
  content_support: [],
  notable_mentions: [],
  donors: [],
};

export default function Team() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [team, setTeam] = useState(FALLBACK_TEAM);
  const userDisplayName = user?.full_name || user?.name || user?.email || 'Learnda User';

  useEffect(() => {
    api.siteContent.getTeam()
      .then((res) => {
        if (res?.success && res.team) setTeam(res.team);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const release = lockBodyScroll();
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => { release(); window.removeEventListener('keydown', onKey); };
  }, [selected]);


  return (
    <div className="page-shell team-page">

      {/* Hero */}
      <PageHeader icon="team" title="Our team" description="The people behind Learnda." />

      {/* Celebratory callout */}
      <div className="tm-celebrate">
        <span className="tm-celebrate__mark" aria-hidden="true">&ldquo;</span>
        <blockquote className="tm-celebrate__line">
          Behind every resource downloaded, every lesson completed, every student
          who found what they needed &mdash; there is someone on this page who made
          it happen. This is their platform as much as it is yours. Let&rsquo;s honour them all. 🎉
        </blockquote>
      </div>

      {/* Section 1: Immediate team */}
      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="community" /><span className="section-heading__title">Immediate team</span></h2>
          <p>The people who build, curate, and run Learnda.</p>
        </div>
        <div className="tm-grid">
          {(team.core_team || []).map((m, i) => {
            const color = ACCENTS[i % ACCENTS.length];
            const gradient = ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
            <button
              key={m.id}
              type="button"
              className="tm-card"
              style={{ '--tm-color': color, '--tm-gradient': gradient }}
              onClick={() => setSelected({ member: m, color, gradient })}
            >
              <TeamAvatar name={m.name} photo={m.photo} className="tm-card__avatar" />
              <div className="tm-card__body">
                <span className="tm-badge">{m.role}</span>
                <strong className="tm-card__name">{m.name}</strong>
                <span className="tm-card__aka">&ldquo;{m.aka}&rdquo;</span>
              </div>
              <span className="tm-card__cta">
                View info <FiArrowRight aria-hidden="true" />
              </span>
            </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Content and Support */}
      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="support" /><span className="section-heading__title">Content and Support</span></h2>
          <p>People who did unimaginable things for Learnda.</p>
        </div>
        <div className="tm-contrib-grid">
          {(team.content_support || []).map((m, i) => {
            const color = m.color || ACCENTS[i % ACCENTS.length];
            const gradient = m.gradient || ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
              <button
                key={m.id}
                type="button"
                className="tm-contrib-card"
                style={{ '--tm-color': color }}
                onClick={() => setSelected({ member: m, color, gradient })}
              >
                <div className="tm-contrib-card__top" aria-hidden="true" />
                <TeamAvatar name={m.name} photo={m.photo} className="tm-contrib-avatar" />
                <div className="tm-contrib-body">
                  <strong className="tm-contrib-name">{m.name}</strong>
                  <span className="tm-badge">{m.role}</span>
                  {m.aka && <span className="tm-contrib-aka">{m.aka}</span>}
                </div>
                <span className="tm-card__cta">
                  View profile <FiArrowRight aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Notable Mentions */}
      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="award" /><span className="section-heading__title">Notable Mentions</span></h2>
          <p>People who helped shape what Learnda is today.</p>
        </div>
        <div className="tm-contrib-grid">
          {(team.notable_mentions || []).map((m, i) => {
            const color = m.color || ACCENTS[i % ACCENTS.length];
            const gradient = m.gradient || ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
              <button
                key={m.id}
                type="button"
                className="tm-contrib-card"
                style={{ '--tm-color': color }}
                onClick={() => setSelected({ member: m, color, gradient })}
              >
                <div className="tm-contrib-card__top" aria-hidden="true" />
                <TeamAvatar name={m.name} photo={m.photo} className="tm-contrib-avatar" />
                <div className="tm-contrib-body">
                  <strong className="tm-contrib-name">{m.name}</strong>
                  {(m.shortRole || m.role) && <span className="tm-badge">{m.shortRole || m.role}</span>}
                  {m.aka && <span className="tm-contrib-aka">{m.aka}</span>}
                </div>
                <span className="tm-card__cta">
                  View profile <FiArrowRight aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* And you */}
      <section className="page-section tm-you-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="community" /><span className="section-heading__title">And you.</span></h2>
          <p>Every great platform is shaped by many hands. Yours too.</p>
        </div>

        <div className="tm-contrib-grid tm-you-card-outer">
          <div
            className="tm-you-card"
            style={{
              '--tm-color': '#2b62c4',
              '--tm-gradient': 'linear-gradient(135deg, #2b62c4 0%, #38bdf8 55%, #34d399 100%)',
            }}
          >
            <div className="tm-you-card__top" aria-hidden="true" />
            <TeamAvatar
              name={isAuthenticated && user ? userDisplayName : 'You'}
              photo={isAuthenticated ? user?.avatar_url : null}
              className="tm-you-card__avatar"
            />
            <div className="tm-you-card__body">
              <span className="tm-badge">
                {isAuthenticated ? (user?.role || 'Member') : 'Visitor'}
              </span>
              <strong className="tm-you-card__name">
                {isAuthenticated ? userDisplayName : 'You.'}
              </strong>
              {isAuthenticated && user?.institution && (
                <span className="tm-you-card__college">{user.institution}</span>
              )}
              <p className="tm-you-card__message">
                {isAuthenticated
                  ? `${userDisplayName.split(' ')[0]}, you're not just a user here — you're the reason this platform exists. Every resource you access, every session you show up for, is what makes Learnda worth building.`
                  : "We don't know your name yet. But every single feature on this platform was built with someone exactly like you in mind — curious, determined, and showing up."}
              </p>
              <p className="tm-you-thanks">
                {isAuthenticated && user
                  ? `Thank you, ${userDisplayName.split(' ')[0]}. Genuinely.`
                  : 'Thank you for being here. This place is yours too.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="tm-section-divider" />

      {/* Contributors — celebration stage */}
      <section className="page-section">
        <div className="section-heading" style={{ textAlign: 'center', alignItems: 'center' }}>
          <h2><SectionHeadingIcon name="stories" /><span className="section-heading__title">Then our superheroes.</span></h2>
        </div>
        <CelebrationContributors contributors={team.donors || []} totalAmount={1888} />
        <div className="tm-superhero-cta">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/contribute?open=1')}
          >
            Become a superhero too
          </button>
          <p className="tm-superhero-cta__sub">Contribute to join them.</p>
        </div>
      </section>

      {/* Bio modal */}
      {selected && (
        <div
          className="tm-modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-modal-name"
            style={{ '--tm-color': selected.color, '--tm-gradient': selected.gradient }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tm-modal__close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <FiX />
            </button>

            <div className="tm-modal__header">
              <TeamAvatar name={selected.member.name} photo={selected.member.photo} className="tm-modal__avatar" />
              <div className="tm-modal__meta">
                <span className="tm-badge">{selected.member.role}</span>
                <h2 id="tm-modal-name" className="tm-modal__name">{selected.member.fullName || selected.member.name}</h2>
                {selected.member.aka && <p className="tm-modal__aka">&ldquo;{selected.member.aka}&rdquo;</p>}
              </div>
            </div>

            <div className="tm-modal__body">
              {(selected.member.bio || []).map((para, i) => <p key={i}>{para}</p>)}
              {(!selected.member.bio || selected.member.bio.length === 0) && (
                <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary, #94a3b8)' }}>No bio available yet.</p>
              )}
            </div>

            {(() => {
              const contact = selected.member.contact || {};
              const social = selected.member.social || {};
              const hasEmail = Boolean(contact.email);
              const hasPhone = Boolean(contact.phone);
              const hasPhone2 = Boolean(contact.phone2);
              const socialEntries = Object.entries(social).filter(([, url]) => Boolean(url));
              const hasContact = hasEmail || hasPhone || hasPhone2;
              const hasSocial = socialEntries.length > 0;
              if (!hasContact && !hasSocial) return null;
              return (
                <div className="tm-modal__footer">
                  {hasEmail && (
                    <a href={`mailto:${contact.email}`} className="tm-contact-chip">
                      <FiMail aria-hidden="true" /> {contact.email}
                    </a>
                  )}
                  {hasPhone && (
                    <a href={`tel:${contact.phone}`} className="tm-contact-chip">
                      <FiPhone aria-hidden="true" /> {contact.phone}
                    </a>
                  )}
                  {hasPhone2 && (
                    <a href={`tel:${contact.phone2}`} className="tm-contact-chip">
                      <FiPhone aria-hidden="true" /> {contact.phone2}
                    </a>
                  )}
                  {hasContact && hasSocial && <span className="tm-footer-divider" aria-hidden="true" />}
                  {socialEntries.map(([key, url]) => {
                    const Icon = SOCIAL_ICONS[key];
                    if (!Icon) return null;
                    const isWebsite = key === 'website';
                    return (
                      <a
                        key={key}
                        href={url}
                        className={isWebsite ? 'tm-contact-chip' : 'tm-social-chip'}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={key}
                      >
                        <Icon aria-hidden="true" />
                        {isWebsite ? ` ${url}` : null}
                      </a>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
