import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import './SharedPages.css';

const TRACKS = [
  {
    title: 'Campus institutions',
    body: 'Partner with colleges for curriculum-aligned content, mentorship programs, and support hubs.',
  },
  {
    title: 'Academic communities',
    body: 'Collaborate with study clubs and student groups for focused learning campaigns.',
  },
  {
    title: 'Content partners',
    body: 'Work with subject experts and contributor teams to expand high-quality learning content.',
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
    <div className="page-shell">
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

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-development">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Collaboration model</span>
            <h1 className="hero-title">Build programs that move from outreach to actual outcomes.</h1>
            <p className="hero-subtitle">
              Build meaningful educational partnerships that improve access, outcomes, and student success.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                Start a partnership
              </button>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Institutions</span>
                <span className="stat-label">Work with colleges to connect Learnda to real student contexts.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Communities</span>
                <span className="stat-label">Support study clubs, peer programs, and learning campaigns at scale.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Content teams</span>
                <span className="stat-label">Expand useful academic coverage through aligned expert collaborations.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What strong partnerships usually share</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Clear learner value</strong>
                  <p>The partnership should make studying more effective, not just more visible.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Operational fit</strong>
                  <p>Programs, content, and expectations have to work in practice, not just in theory.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Measured results</strong>
                  <p>Good partnerships define success through engagement, learning, and repeatable delivery.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Partnership tracks</h2>
          <p>Choose the model that best fits your organization.</p>
        </div>
        <div className="card-grid">
          {TRACKS.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>Ready to partner?</h3>
          <p>Open the partnership inquiry form and share your organization, collaboration idea, and target outcome.</p>
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            Start a partnership
          </button>
        </div>
        <div className="info-card">
          <h3>Explore investment</h3>
          <p>Looking to invest rather than collaborate? The investment track covers funding, growth capital, and commercial conversations.</p>
          <Link className="btn btn-secondary" to="/investments">
            View investment details
          </Link>
        </div>
      </section>
    </div>
  );
}
