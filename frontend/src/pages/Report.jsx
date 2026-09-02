import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import './SharedPages.css';

const CATEGORIES = ['Bug', 'Content issue', 'Payment', 'Community', 'Other'];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function Report() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', category: 'Bug', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const category = searchParams.get('category');
    const subject = searchParams.get('subject');
    const message = searchParams.get('message');
    setForm((prev) => ({
      ...prev,
      category: category || prev.category,
      subject: subject || prev.subject,
      message: message || prev.message,
    }));
    if (category || subject || message) setShowModal(true);
  }, [searchParams]);

  const updateField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : form.name,
        email: isAuthenticated ? user?.email : form.email,
        subject: form.subject,
        category: form.category,
        message: form.message,
      });
      setSubmitted(true);
      setForm((prev) => ({ ...prev, subject: '', message: '' }));
    } catch (err) {
      setError(err.message || 'Could not send your report. Please try again.');
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
        title="Submit a report"
        subtitle="Include as much detail as possible so we can help quickly."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Report received. The Sharether team will investigate and follow up within 24–48 hours.</p>
            <button className="btn btn-primary" type="button" onClick={closeModal}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="r-name">Full name</label>
                  <input id="r-name" type="text" value={form.name} onChange={updateField('name')} placeholder="Your name" required />
                </div>
                <div className="form-row">
                  <label htmlFor="r-email">Email</label>
                  <input id="r-email" type="email" value={form.email} onChange={updateField('email')} placeholder="name@email.com" required />
                </div>
              </>
            )}
            <div className="form-row">
              <label htmlFor="r-category">Category</label>
              <select id="r-category" value={form.category} onChange={updateField('category')}>
                {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="r-subject">Subject</label>
              <input id="r-subject" type="text" value={form.subject} onChange={updateField('subject')} placeholder="Short summary of the issue" required />
            </div>
            <div className="form-row">
              <label htmlFor="r-message">Details</label>
              <textarea id="r-message" value={form.message} onChange={updateField('message')} placeholder="Describe what happened — steps to reproduce, device, and any screenshots help a lot." rows={5} required />
            </div>
            {error && <p className="fm-feedback error">{error}</p>}
            <div className="fm-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send report'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        )}
      </FormModal>

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-development">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Issue intake</span>
            <h1 className="hero-title">Flag the issue before it slows someone else down.</h1>
            <p className="hero-subtitle">
              We review every message and respond within 24–48 hours. Use this page for bugs,
              feedback, or account issues.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                Report an issue
              </button>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">24–48h</span>
                <span className="stat-label">Expected response window for most reports that need follow-up.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{CATEGORIES.length} categories</span>
                <span className="stat-label">Enough routing detail to get your issue to the right team.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Direct triage</span>
                <span className="stat-label">Reports are logged for investigation, not dropped into a black box.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What happens next</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>We triage</strong>
                  <p>Your report is logged and tagged for the right team.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>We respond</strong>
                  <p>Expect a reply from a Sharether admin within 2 days.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>You speed things up</strong>
                  <p>Clear steps, screenshots, and device context make debugging far easier.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>What makes a good report</h3>
          <p>The more context you include, the faster we can reproduce and fix the issue.</p>
          <div className="panel-list">
            <div className="panel-list-item">
              <span className="panel-dot" />
              <div><strong>Steps to reproduce</strong><p>What did you click or do before the issue appeared?</p></div>
            </div>
            <div className="panel-list-item">
              <span className="panel-dot" />
              <div><strong>Device and browser</strong><p>Chrome on Android? Safari on iOS? This narrows the root cause quickly.</p></div>
            </div>
            <div className="panel-list-item">
              <span className="panel-dot" />
              <div><strong>Expected vs actual</strong><p>What did you expect to happen, and what actually happened?</p></div>
            </div>
          </div>
        </div>
        <div className="info-card">
          <h3>Ready to report?</h3>
          <p>Open the report form, choose a category, and describe the issue with as much detail as you have.</p>
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            Report an issue
          </button>
        </div>
      </section>
    </div>
  );
}
