import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import { FEATURE_FLAGS } from '../config/featureFlags';
import PageHeader from '../components/common/PageHeader';
import PrimaryPageAction from '../components/common/PrimaryPageAction';
import RelatedPageLink from '../components/common/RelatedPageLink';
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
    <div className="page-shell action-page">
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

      <PageHeader icon="feature" title="Suggest a feature" description="Share what would make Learnda better.">
        <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
          Make a wish
        </button>
        {FEATURE_FLAGS.community && (
          <Link className="btn btn-secondary" to="/forum">
            Open community forum
          </Link>
        )}
      </PageHeader>
      <PrimaryPageAction icon="wish" label="Make a wish" onClick={() => setShowModal(true)} />
      <details className="action-page-details">
        <summary>How we prioritise</summary>
        <ul>
          {PRIORITIES.map((item) => <li key={item.title}><strong>{item.title}:</strong> {item.body}</li>)}
        </ul>
      </details>
      <RelatedPageLink to="/roadmap" icon="roadmap" title="Explore the roadmap" description="See what is coming next." />
    </div>
  );
}
