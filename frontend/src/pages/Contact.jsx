import { useEffect, useState } from 'react';
import { useAnalyticsWithContext } from '../hooks/useAnalytics';
import { useSearchParams } from 'react-router-dom';
import { FiMail, FiMessageSquare, FiPhone } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa6';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import PageHeader from '../components/common/PageHeader';
import RelatedPageLink from '../components/common/RelatedPageLink';
import './SharedPages.css';


const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function Contact() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { trackEvent } = useAnalyticsWithContext();
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState({ name: '', email: '', topic: 'General', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const topic = searchParams.get('topic');
    const message = searchParams.get('message');
    setFormState((prev) => ({
      ...prev,
      topic: topic || prev.topic,
      message: message || prev.message,
    }));
    if (topic || message) setShowModal(true);
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.support.submitReport({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : formState.name,
        email: isAuthenticated ? user?.email : formState.email,
        subject: formState.topic,
        category: 'Support',
        message: formState.message,
      });
      if (response?.success) {
        setSubmitted(true);
        trackEvent('contact_form_submitted', { topic: formState.topic });
      } else {
        setError(response?.error || 'Unable to send your message right now.');
      }
    } catch (err) {
      setError(err.message || 'Unable to send your message right now.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitted(false);
    setError('');
  };

  return (
    <div className="page-shell footer-page compact-info-page">
      <FormModal
        isOpen={showModal}
        onClose={closeModal}
        title="Send us a message"
        subtitle="We'll reply with the next steps or resources you need."
      >
        {submitted ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>Message received. We aim to reply within 24–48 hours.</p>
            <button className="btn btn-primary" type="button" onClick={closeModal}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="c-name">Full name</label>
                  <input id="c-name" name="name" type="text" value={formState.name} onChange={handleChange} placeholder="Your name" required />
                </div>
                <div className="form-row">
                  <label htmlFor="c-email">Email</label>
                  <input id="c-email" name="email" type="email" value={formState.email} onChange={handleChange} placeholder="name@email.com" required />
                </div>
              </>
            )}
            <div className="form-row">
              <label htmlFor="c-topic">Topic</label>
              <select id="c-topic" name="topic" value={formState.topic} onChange={handleChange}>
                <option>General</option>
                <option>Plans and billing</option>
                <option>Creator support</option>
                <option>Partnerships</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="c-message">Message</label>
              <textarea id="c-message" name="message" rows="4" value={formState.message} onChange={handleChange} placeholder="Tell us how we can help" required disabled={loading} />
            </div>
            {error && <p className="fm-feedback error">{error}</p>}
            <div className="fm-actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send message'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        )}
      </FormModal>

      <PageHeader icon="contact" title="Contact us" description="Questions from parents, teachers or learners. We reply within 24‑48 hours." />

      <section className="page-section">
        <div className="contact-grid">
          <a className="contact-box" href="mailto:support@learnda.app">
            <div className="contact-box__icon"><FiMail /></div>
            <div className="contact-box__body">
              <span className="contact-box__label">Email</span>
              <span className="contact-box__value">support@learnda.app</span>
            </div>
          </a>
          <a className="contact-box" href="https://wa.me/233591661816" target="_blank" rel="noopener noreferrer">
            <div className="contact-box__icon contact-box__icon--whatsapp"><FaWhatsapp /></div>
            <div className="contact-box__body">
              <span className="contact-box__label">WhatsApp</span>
              <span className="contact-box__value">+233 591 661 816</span>
            </div>
          </a>
          <a className="contact-box" href="tel:+233591661816">
            <div className="contact-box__icon contact-box__icon--phone"><FiPhone /></div>
            <div className="contact-box__body">
              <span className="contact-box__label">Phone</span>
              <span className="contact-box__value">+233 591 661 816</span>
            </div>
          </a>
          <button className="contact-box" type="button" onClick={() => setShowModal(true)}>
            <div className="contact-box__icon contact-box__icon--message"><FiMessageSquare /></div>
            <div className="contact-box__body">
              <span className="contact-box__label">Send a message</span>
              <span className="contact-box__value">Open contact form</span>
            </div>
          </button>
        </div>
      </section>

      <RelatedPageLink to="/report" icon="idea" title="Something not working?" description="Report a problem instead." />
    </div>
  );
}
