import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import { FEATURE_FLAGS } from '../config/featureFlags';
import './SharedPages.css';

const PRIORITIES = [
  {
    title: 'Learning impact',
    body: 'Requests that improve learning outcomes and completion rates are prioritized first.',
  },
  {
    title: 'Implementation effort',
    body: 'We balance effort with value so useful improvements ship quickly and safely.',
  },
  {
    title: 'Community demand',
    body: 'Features requested by more students and tutors move faster in the roadmap queue.',
  },
];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function FeatureRequests() {
  const { user, isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : form.name,
        email: isAuthenticated ? user?.email : form.email,
        subject: `Feature request: ${form.subject}`,
        category: 'Wish',
        message: form.message,
      });
      setSubmitted(true);
      setForm((prev) => ({ ...prev, subject: '', message: '' }));
    } catch (err) {
      setError(err.message || 'Unable to submit feature request.');
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
        title="Make a wish"
        subtitle="Send the exact workflow problem, not just the feature label, so we can assess it properly."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Wish received. The product team can now review it with context.</p>
            <button className="btn btn-primary" type="button" onClick={closeModal}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="fr-name">Full name</label>
                  <input id="fr-name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Your name" required />
                </div>
                <div className="form-row">
                  <label htmlFor="fr-email">Email</label>
                  <input id="fr-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@email.com" required />
                </div>
              </>
            )}
            <div className="form-row">
              <label htmlFor="fr-subject">Short title</label>
              <input id="fr-subject" name="subject" type="text" value={form.subject} onChange={handleChange} placeholder="What should improve?" required />
            </div>
            <div className="form-row">
              <label htmlFor="fr-message">Why this matters</label>
              <textarea
                id="fr-message"
                name="message"
                rows="5"
                value={form.message}
                onChange={handleChange}
                placeholder="Describe the current friction, where it happens, and what outcome you expect."
                required
              />
            </div>
            {error && <p className="fm-feedback error">{error}</p>}
            <div className="fm-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send request'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        )}
      </FormModal>

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-development">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Product input</span>
            <h1 className="hero-title">Pitch the improvement students would actually feel.</h1>
            <p className="hero-subtitle">
              Share ideas for improvements to Learn, Practice, and Resources.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                Make a wish
              </button>
              {FEATURE_FLAGS.community && (
                <Link className="btn btn-secondary" to="/forum">
                  Open community forum
                </Link>
              )}
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Impact-first</span>
                <span className="stat-label">Requests that improve outcomes or remove friction rise faster.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Community-shaped</span>
                <span className="stat-label">Repeated requests carry more weight than isolated wish lists.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Roadmap-bound</span>
                <span className="stat-label">The strongest ideas influence both release planning and future priorities.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What makes a request strong</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Be specific</strong>
                  <p>Describe the exact friction, not just the feature name you want.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Anchor it in workflow</strong>
                  <p>Strong requests explain where the current experience breaks down.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Show the payoff</strong>
                  <p>Requests move faster when the learning benefit is obvious and defensible.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Prioritization criteria</h2>
          <p>We use the same criteria for all product requests.</p>
        </div>
        <div className="card-grid">
          {PRIORITIES.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>Got a wish?</h3>
          <p>Send your idea with a clear title and the workflow problem it solves. The product team reviews every submission.</p>
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            Make a wish
          </button>
        </div>
        <div className="info-card">
          <h3>Already requested?</h3>
          <p>Check the platform roadmap to see what's been acknowledged, planned, or in progress.</p>
          <Link className="btn btn-secondary" to="/roadmap">
            Review roadmap
          </Link>
        </div>
      </section>
    </div>
  );
}
