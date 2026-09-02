import { useEffect, useState } from 'react';
import { FiCode, FiDatabase, FiDollarSign, FiGlobe } from 'react-icons/fi';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FormContactIdentity from '../components/common/FormContactIdentity';
import FormModal from '../components/common/FormModal';
import CelebrationContributors from '../components/common/CelebrationContributors';
import './SharedPages.css';
import './Contribute.css';

const SUPPORTER_ACCENTS = ['#38bdf8', '#34d399', '#f97316', '#2b62c4', '#eab308'];

const FALLBACK_SUPPORTERS = [
  { id: '1', name: 'Samuel Heighty', from: 'Student at Fosco' },
  { id: '2', name: 'Abigail Frimpong', from: 'Student at Fosco' },
  { id: '3', name: 'Kofi Boamah', from: 'Student' },
  { id: '4', name: 'Carlos', from: 'Student' },
  { id: '5', name: 'Christian', from: 'Student' },
];

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const IMPACT_AREAS = [
  {
    title: 'Domain & Hosting',
    description: 'Keeps learnda.app online and fast, every day of the semester — exam week included.',
    icon: FiGlobe,
    color: '#2b62c4',
    num: '01',
  },
  {
    title: 'Storage & Content delivery',
    description: 'Delivers millions of downloads a year. Every note, past question and lesson you open is served from here.',
    icon: FiDatabase,
    color: '#3e7fdd',
    num: '02',
  },
  {
    title: 'Development & Design',
    description: 'Pays for the ongoing work — new features, faster pages, and a smoother experience on web and mobile.',
    icon: FiCode,
    color: '#d97706',
    num: '03',
  },
];

const CONTRIBUTION_PRESETS = [10, 20, 50, 100, 250, 500];
const SUPPORT_TYPES = [
  { value: 'one_time', label: 'One-time contribution' },
  { value: 'monthly_pledge', label: 'Monthly pledge' },
  { value: 'institutional_support', label: 'Institutional support' },
];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

const toContribError = (msg) =>
  String(msg || '')
    .replace(/too many subscription changes[^.]*\.?/gi, 'Please try again.')
    .replace(/subscription changes?/gi, 'payment attempts')
    .replace(/subscription/gi, 'payment')
    .replace(/donation/gi, 'contribution')
    .replace(/donate/gi, 'contribute')
    .trim();

export default function Contribute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(searchParams.get('open') === '1');
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    amount: '50',
    supportType: 'one_time',
    message: '',
  });
  const [pendingPayment, setPendingPayment] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [supporters, setSupporters] = useState(FALLBACK_SUPPORTERS);

  useEffect(() => {
    api.siteContent.getTeam()
      .then((res) => {
        const donors = res?.team?.donors;
        if (res?.success && Array.isArray(donors) && donors.length > 0) {
          setSupporters(donors);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setFormState((prev) => ({
      ...prev,
      name: prev.name || getDisplayName(user),
      email: prev.email || user?.email || '',
      phone: prev.phone || user?.phone_number || '',
    }));
  }, [user, isAuthenticated]);

  // Detect Paystack callback redirect (/contribute?reference=xxx) and auto-verify
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) return;
    setShowModal(true);
    setProcessing(true);
    api.payment.verifyContribution(reference, 'paystack')
      .then((res) => {
        const d = res?.data || res;
        const amountStr = d?.amount ? ` with ${d?.currency || 'GHS'} ${d.amount}` : '';
        setStatus(`Contribution received. Thank you for supporting Learnda${amountStr}.`);
        setFormState((prev) => ({ ...prev, amount: '50', message: '' }));
      })
      .catch((err) => {
        setPendingPayment({ reference, provider: 'paystack' });
        setError(toContribError(err.message) || 'Contribution could not be verified. Please try again.');
      })
      .finally(() => {
        setProcessing(false);
        navigate('/contribute', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const numericAmount = Number(formState.amount || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitializeContribution = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setStatus('');
    setError('');
    try {
      const response = await api.payment.initializeContribution({
        name: isAuthenticated ? (getDisplayName(user) || user?.email) : formState.name,
        email: isAuthenticated ? user?.email : formState.email,
        phone: isAuthenticated ? (user?.phone_number || '') : formState.phone,
        amount: numericAmount,
        supportType: formState.supportType,
        message: formState.message,
        paymentMethod: 'paystack',
        callbackBase: window.location.origin,
      });
      const data = response?.data || response;
      if (!data?.authorizationUrl) throw new Error('Unable to initialize payment.');
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(toContribError(err.message) || 'Unable to process contribution.');
      setProcessing(false);
    }
  };

  const handleVerifyContribution = async () => {
    if (!pendingPayment?.reference) return;
    setProcessing(true);
    setStatus('');
    setError('');
    try {
      const response = await api.payment.verifyContribution(pendingPayment.reference, pendingPayment.provider);
      const data = response?.data || response;
      setStatus(`Contribution received. Thank you for supporting Learnda with ${data?.currency || 'GHS'} ${data?.amount || pendingPayment.amount}.`);
      setPendingPayment(null);
      setFormState((prev) => ({ ...prev, amount: '50', message: '' }));
    } catch (err) {
      setError(toContribError(err.message) || 'Unable to verify contribution.');
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setPendingPayment(null);
    setShowModal(false);
    setStatus('');
    setError('');
  };

  return (
    <div className="page-shell page-shell--contribute">
      <FormModal
        isOpen={showModal}
        onClose={closeModal}
        title="Contribute funds"
        subtitle="Choose any amount that works for you — you'll come straight back here after payment."
      >
        {status && !error && !pendingPayment ? (
          <div className="fm-success">
            <div className="fm-success-icon">✓</div>
            <p>{status}</p>
            <button className="btn btn-primary" type="button" onClick={() => { setShowModal(false); setStatus(''); }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleInitializeContribution}>
            {isAuthenticated && user ? (
              <FormContactIdentity user={user} />
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="d-name">Full name</label>
                  <input id="d-name" name="name" type="text" value={formState.name} onChange={handleChange} placeholder="Your name" required />
                </div>
                <div className="form-row">
                  <label htmlFor="d-email">Email</label>
                  <input id="d-email" name="email" type="email" value={formState.email} onChange={handleChange} placeholder="name@example.com" required />
                </div>
                <div className="form-row">
                  <label htmlFor="d-phone">Phone <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional, for MoMo follow-up)</span></label>
                  <input id="d-phone" name="phone" type="tel" value={formState.phone} onChange={handleChange} placeholder="e.g. 024 000 0000" />
                </div>
              </>
            )}

            <div className="form-row">
              <label htmlFor="d-support-type">Support type</label>
              <select id="d-support-type" name="supportType" value={formState.supportType} onChange={handleChange}>
                {SUPPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="form-row">
              <label>Amount (GHS)</label>
              <div className="amount-grid dn-amount-strip">
                <button
                  className={`amount-chip${isCustomAmount ? ' active' : ''}`}
                  type="button"
                  onClick={() => {
                    setIsCustomAmount(true);
                    setFormState((prev) => ({ ...prev, amount: '' }));
                  }}
                >
                  Custom
                </button>
                {CONTRIBUTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`amount-chip${!isCustomAmount && Number(formState.amount) === preset ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setIsCustomAmount(false);
                      setFormState((prev) => ({ ...prev, amount: String(preset) }));
                    }}
                  >
                    GH₵{preset}
                  </button>
                ))}
              </div>
            </div>

            {isCustomAmount && (
              <div className="form-row">
                <label htmlFor="d-amount">Enter amount (GHS)</label>
                <input id="d-amount" name="amount" type="number" min="5" step="1" value={formState.amount} onChange={handleChange} placeholder="e.g. 75" required />
              </div>
            )}

            <div className="form-row">
              <label htmlFor="d-message">Message <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
              <textarea id="d-message" name="message" rows="3" value={formState.message} onChange={handleChange} placeholder="Optional note for the Learnda team" />
            </div>

            <div className="fm-summary">
              <div className="fm-summary-row"><span>Contribution</span><strong>GH₵{Number.isFinite(numericAmount) ? numericAmount : 0}</strong></div>
              <div className="fm-summary-row"><span>Type</span><strong>{SUPPORT_TYPES.find((t) => t.value === formState.supportType)?.label || 'One-time contribution'}</strong></div>
            </div>

            {pendingPayment && (
              <div className="fm-pending-strip">
                <div>
                  <p>Payment tab is open. Complete the checkout, then return here to verify.</p>
                  <p className="fm-pending-ref">Ref: {pendingPayment.reference} · {pendingPayment.currency} {pendingPayment.amount}</p>
                </div>
              </div>
            )}

            {status && !pendingPayment && <p className="fm-feedback success">{status}</p>}
            {error && (
              <div className="dn-error-block">
                <p className="fm-feedback error">{error}</p>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setError('');
                    if (pendingPayment) handleVerifyContribution();
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            <div className="fm-actions">
              {pendingPayment ? (
                <button className="btn btn-primary" type="button" onClick={handleVerifyContribution} disabled={processing}>
                  {processing ? 'Verifying…' : 'Verify payment'}
                </button>
              ) : (
                <button className="btn btn-primary" type="submit" disabled={processing}>
                  {processing ? 'Starting checkout…' : 'Continue to payment'}
                </button>
              )}
              {!pendingPayment && (
                <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
              )}
            </div>
          </form>
        )}
      </FormModal>

      <section className="page-hero page-hero-compact page-hero-lean hero-theme-support">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Mission support</span>
            <h1 className="hero-title">Every contribution keeps a student learning.</h1>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                <FiDollarSign aria-hidden /> Contribute funds
              </button>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Paystack</span>
                <span className="stat-label">Card and mobile money checkout in a secure redirect flow.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Flexible</span>
                <span className="stat-label">One-time, monthly pledge, or institutional support options.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Verified</span>
                <span className="stat-label">Complete payment, then verify so the team can track and confirm it.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What your support helps fund</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Learning resources</strong>
                  <p>More structured materials and student-ready study support.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Platform reliability</strong>
                  <p>Ongoing fixes, performance work, and a smoother experience.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot" />
                <div>
                  <strong>Long-term growth</strong>
                  <p>More room to invest in features that help students learn with less friction.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {supporters.length > 0 && (
        <section className="page-section">
          <div className="cost-reality-banner">
            <svg className="cost-reality-banner__frame" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="crb-sketch-contribute" x="-8%" y="-8%" width="116%" height="116%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="7" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <path d="M 8 8 L 392 8 L 392 192 L 8 192 Z" filter="url(#crb-sketch-contribute)" />
            </svg>
            <p>Learnda runs on real costs &mdash; domain, hosting, storage, SSL, content design and development.</p>
            <p>A handful of people have carried those costs so far. Now anyone who finds Learnda useful can share the load, at whatever amount works for them.</p>
            <p className="cost-reality-banner__cta">Your contribution keeps Learnda online, free to start, and getting better each semester.</p>
          </div>
          <CelebrationContributors contributors={supporters} totalAmount={1888} />
        </section>
      )}

      <section className="page-section">
        <div className="section-heading">
          <h2>Where your contribution goes</h2>
          <p>No overheads, no middlemen — every cedi goes straight into keeping Learnda online and improving.</p>
        </div>
        <div className="dn-impact-grid">
          {IMPACT_AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <div
                key={area.title}
                className="dn-impact-card"
                style={{ '--impact-color': area.color }}
              >
                <div className="dn-impact-card__top">
                  <div className="dn-impact-card__icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <span className="dn-impact-card__num">{area.num}</span>
                </div>
                <h3 className="dn-impact-card__title">{area.title}</h3>
                <p className="dn-impact-card__desc">{area.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="page-section split-grid">
        <div className="info-card">
          <h3>Ready to chip in?</h3>
          <p>Pick an amount and a payment channel — card or mobile money. It takes under two minutes.</p>
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            Contribute funds
          </button>
        </div>
        <div className="info-card">
          <h3>Other ways to support</h3>
          <p>For sponsorships, in-kind support, or institutional partnerships, reach out through the contact page.</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/contact?topic=Partnerships&message=I%20want%20to%20discuss%20a%20partnership%20or%20non-cash%20support%20option.')}
          >
            Contact the team
          </button>
        </div>
      </section>
    </div>
  );
}
