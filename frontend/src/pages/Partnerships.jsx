import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import PageHeader from '../components/common/PageHeader';
import PrimaryPageAction from '../components/common/PrimaryPageAction';
import './SharedPages.css';

const TRACKS = [
  {
    title: 'Schools',
    body: 'Give your pupils Learnda accounts and follow their progress class by class.',
  },
  {
    title: 'Teachers and PTAs',
    body: 'Run homework, revision or holiday-learning campaigns with your class or parents.',
  },
  {
    title: 'Content partners',
    body: 'Help us write, check and illustrate NaCCA-aligned lessons and practice.',
  },
];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function Partnerships() {
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

  const submitPartnership = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : formState.name,
        email: isAuthenticated ? user?.email : formState.email,
        subject: `Partnership inquiry${formState.organization ? `: ${formState.organization}` : ''}`,
        category: 'Partnership',
        message: formState.message,
      });
      setSubmitted(true);
      setFormState((previous) => ({ ...previous, organization: '', message: '' }));
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit partnership inquiry.');
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
        title="Partnership inquiry"
        subtitle="Share your organization, collaboration idea, and target outcome so we can route it properly."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Partnership inquiry sent. The team will follow up with the right collaboration path.</p>
            <button className="btn btn-primary" type="button" onClick={closeModal}>Done</button>
          </div>
        ) : (
          <form onSubmit={submitPartnership}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="partner-name">Full name</label>
                  <input id="partner-name" name="name" type="text" value={formState.name} onChange={handleChange} required />
                </div>
                <div className="form-row">
                  <label htmlFor="partner-email">Email</label>
                  <input id="partner-email" name="email" type="email" value={formState.email} onChange={handleChange} required />
                </div>
              </>
            )}
            <div className="form-row">
              <label htmlFor="partner-organization">Organization</label>
              <input
                id="partner-organization"
                name="organization"
                type="text"
                value={formState.organization}
                onChange={handleChange}
                placeholder="School, company, club, or community"
              />
            </div>
            <div className="form-row">
              <label htmlFor="partner-message">Proposal summary</label>
              <textarea
                id="partner-message"
                name="message"
                rows="5"
                value={formState.message}
                onChange={handleChange}
                placeholder="Describe the audience, collaboration model, and expected outcome."
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

      <PageHeader icon="partnerships" title="For schools" description="Bring Learnda to your school, class or community." />
      <PrimaryPageAction icon="partnership" label="Start a partnership" onClick={() => setShowModal(true)} />
      <details className="action-page-details">
        <summary>Ways to partner</summary>
        <ul>
          {TRACKS.map((item) => <li key={item.title}><strong>{item.title}:</strong> {item.body}</li>)}
        </ul>
      </details>
    </div>
  );
}
