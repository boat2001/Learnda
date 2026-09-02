import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import './SharedPages.css';

const HIGHLIGHTS = [
  { title: 'Student-first market', body: 'Sharether focuses on practical tools with measurable learning outcomes.' },
  { title: 'Scalable platform', body: 'Built as a modular SPA with dedicated learning, practice, and resource pipelines.' },
  { title: 'Creator economy layer', body: 'Creator publishing and revenue sharing unlock sustainable content growth.' },
];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function Investments() {
  const { user, isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    organization: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormState((previous) => ({
      ...previous,
      name:
        previous.name ||
        user?.full_name ||
        user?.name ||
        [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      email: previous.email || user?.email || '',
    }));
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((previous) => ({ ...previous, [name]: value }));
  };

  const submitInquiry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : formState.name,
        email: isAuthenticated ? user?.email : formState.email,
        subject: `Investment inquiry${formState.organization ? `: ${formState.organization}` : ''}`,
        category: 'Investment',
        message: formState.message,
      });
      setSubmitted(true);
      setFormState((previous) => ({ ...previous, organization: '', message: '' }));
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit investment inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitted(false);
    setError('');
  };

  return (
    <div className="page-shell">
      <FormModal
        isOpen={showModal}
        onClose={closeModal}
        title="Investment inquiry"
        subtitle="Send the context of your interest and the team will respond with the right next step."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Investment inquiry sent. The Sharether team can now follow up directly.</p>
            <button className="btn btn-primary" type="button" onClick={closeModal}>Done</button>
          </div>
        ) : (
          <form onSubmit={submitInquiry}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="investor-name">Full name</label>
                  <input id="investor-name" name="name" type="text" value={formState.name} onChange={handleChange} required />
                </div>
                <div className="form-row">
                  <label htmlFor="investor-email">Email</label>
                  <input id="investor-email" name="email" type="email" value={formState.email} onChange={handleChange} required />
                </div>
              </>
            )}
            <div className="form-row">
              <label htmlFor="investor-organization">Organization</label>
              <input
                id="investor-organization"
                name="organization"
                type="text"
                value={formState.organization}
                onChange={handleChange}
                placeholder="Fund, firm, angel syndicate, or company"
              />
            </div>
            <div className="form-row">
              <label htmlFor="investor-message">Message</label>
              <textarea
                id="investor-message"
                name="message"
                rows="5"
                value={formState.message}
                onChange={handleChange}
                placeholder="Tell us the stage, interest area, and what you want to review first."
                required
              />
            </div>
            {error && <p className="fm-feedback error">{error}</p>}
            <div className="fm-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send inquiry'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        )}
      </FormModal>

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-development">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Growth capital</span>
            <h1 className="hero-title">Back the infrastructure behind better student outcomes.</h1>
            <p className="hero-subtitle">
              Explore investment opportunities supporting Sharether&apos;s long-term growth in student learning.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                Contact investment desk
              </button>
              <Link className="btn btn-secondary" to="/about">
                About Sharether
              </Link>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Student-first</span>
                <span className="stat-label">The product is built around study outcomes, not passive time-on-app.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Multi-layered</span>
                <span className="stat-label">Subscriptions, resources, and creator participation support platform growth.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Execution-focused</span>
                <span className="stat-label">Investment conversations center on traction, operations, and roadmap realism.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What investor conversations can cover</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Product traction</strong>
                  <p>Usage activity, retention signals, and learning completion metrics.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Commercial model</strong>
                  <p>Subscription and creator-revenue growth assumptions.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Roadmap visibility</strong>
                  <p>Execution priorities across platform, content, and community tracks.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Investment highlights</h2>
          <p>Core reasons investors engage with the Sharether mission.</p>
        </div>
        <div className="card-grid">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>Ready to connect?</h3>
          <p>Open the investment inquiry form and share the context of your interest — stage, focus area, and what you want to review first.</p>
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            Contact investment desk
          </button>
        </div>
        <div className="info-card">
          <h3>Explore partnerships</h3>
          <p>Looking to collaborate rather than invest? The partnerships track covers institutions, communities, and content teams.</p>
          <Link className="btn btn-secondary" to="/partnerships">
            View partnership tracks
          </Link>
        </div>
      </section>
    </div>
  );
}
