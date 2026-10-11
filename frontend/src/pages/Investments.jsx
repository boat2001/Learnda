import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import PageHeader from '../components/common/PageHeader';
import PrimaryPageAction from '../components/common/PrimaryPageAction';
import RelatedPageLink from '../components/common/RelatedPageLink';
import './SharedPages.css';

const HIGHLIGHTS = [
  { title: 'Student-first market', body: 'Learnda focuses on practical tools with measurable learning outcomes.' },
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
    <div className="page-shell action-page">
      <FormModal
        isOpen={showModal}
        onClose={closeModal}
        title="Investment inquiry"
        subtitle="Send the context of your interest and the team will respond with the right next step."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Investment inquiry sent. The Learnda team can now follow up directly.</p>
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

      <PageHeader icon="investments" title="Invest in Learnda" description="Help build better learning for Ghanaian children.">
        <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
          Contact investment desk
        </button>
        <Link className="btn btn-secondary" to="/about">
          About Learnda
        </Link>
      </PageHeader>
      <PrimaryPageAction icon="investment" label="Start an investment inquiry" onClick={() => setShowModal(true)} />
      <details className="action-page-details">
        <summary>Why invest</summary>
        <ul>
          {HIGHLIGHTS.map((item) => <li key={item.title}><strong>{item.title}:</strong> {item.body}</li>)}
        </ul>
      </details>
      <RelatedPageLink to="/partnerships" icon="partnership" title="Explore partnerships" description="Prefer to collaborate? Find a way to work together." />
    </div>
  );
}
