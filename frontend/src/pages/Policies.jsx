import { useNavigate } from 'react-router-dom';
import './SharedPages.css';

const PRIVACY_SECTIONS = [
  {
    title: 'Information we collect',
    body: 'We collect account details, learning activity, and device data to improve the platform.',
  },
  {
    title: 'How we use data',
    body: 'We use data to personalize lessons, recommend content, and keep Sharether secure.',
  },
  {
    title: 'Data sharing',
    body: 'We only share data with trusted service providers for hosting, payments, and analytics.',
  },
  {
    title: 'Your controls',
    body: 'You can update preferences, request exports, and delete your account in settings.',
  },
];

const COOKIE_SECTIONS = [
  {
    title: 'Essential cookies',
    body: 'Required for login, security, and core site functionality.',
  },
  {
    title: 'Preference cookies',
    body: 'Remember your theme, language, and learning settings.',
  },
  {
    title: 'Analytics cookies',
    body: 'Help us understand usage patterns and improve performance.',
  },
];

export default function Policies() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-legal">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Transparency</span>
            <h1 className="hero-title">How Sharether handles your data and uses cookies.</h1>
            <p className="hero-subtitle">
              This page covers our privacy practices and cookie usage in one place — what we collect, why it matters, and where your control begins.
            </p>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Minimal</span>
                <span className="stat-label">We collect only what supports learning, security, and platform reliability.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">No ad tracking</span>
                <span className="stat-label">We are not using cookies or data to power third-party advertising profiles.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">User-controlled</span>
                <span className="stat-label">Preferences, exports, and account actions give you meaningful control over your data.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">Our commitments</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Minimal data</strong>
                  <p>We collect only what helps your learning experience.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Secure storage</strong>
                  <p>Data is encrypted in transit and at rest.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>No ads</strong>
                  <p>We do not use third-party ad tracking cookies.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Policy */}
      <section className="page-section">
        <div className="section-heading">
          <h2>Privacy policy</h2>
          <p>What we collect and how it powers your experience.</p>
        </div>
        <div className="card-grid">
          {PRIVACY_SECTIONS.map((section) => (
            <div key={section.title} className="info-card">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cookie Policy */}
      <section className="page-section">
        <div className="section-heading">
          <h2>Cookie policy</h2>
          <p>Small files, clear purpose, no ad-tech clutter.</p>
        </div>
        <div className="card-grid">
          {COOKIE_SECTIONS.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>Questions about your data?</h3>
          <p>
            If you have any concerns about how your data is handled, reach out to us directly.
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/contact?topic=Privacy%20and%20data')}
          >
            Contact us
          </button>
        </div>
      </section>
    </div>
  );
}
