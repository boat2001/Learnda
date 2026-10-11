import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import PageHeader from '../components/common/PageHeader';
import PrimaryPageAction from '../components/common/PrimaryPageAction';
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
    <div className="page-shell footer-page action-page">
      <FormModal
        isOpen={showModal}
        onClose={closeModal}
        title="Submit a report"
        subtitle="Include as much detail as possible so we can help quickly."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Report received. The Learnda team will investigate and follow up within 24–48 hours.</p>
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

      <PageHeader icon="report" title="Report a problem" description="Tell us what needs fixing. We reply within 24‑48 hours." />
      <PrimaryPageAction icon="report" label="Report an issue" onClick={() => setShowModal(true)} />
      <details className="action-page-details">
        <summary>What makes a good report</summary>
        <ul>
          <li><strong>Steps:</strong> what you tapped or did before it happened.</li>
          <li><strong>Device:</strong> for example Chrome on Android or Safari on iPhone.</li>
          <li><strong>Expected vs actual:</strong> what you thought would happen, and what did.</li>
        </ul>
      </details>
    </div>
  );
}
