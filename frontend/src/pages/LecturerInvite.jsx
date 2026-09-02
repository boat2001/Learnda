import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const QUALIFICATIONS = ['Diploma', 'HND', 'BSc / BA', 'BEd', 'MSc / MA / MEd', 'MPhil', 'PhD', 'Professor'];
const NETWORKS = ['MTN', 'Vodafone', 'AirtelTigo'];

export default function LecturerInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const checkAuth = useAuthStore((s) => s.checkAuth);

  const [invite, setInvite]   = useState(null);
  const [phase, setPhase]     = useState('loading'); // loading | form | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: '', phone: '',
    college: '', department: '',
    specialty_courses: '',
    highest_qualification: '',
    payout_channel: 'momo',
    payout_network: 'MTN',
    payout_account: '',
    payout_bank: '',
    payout_bank_branch: '',
    payout_account_name: '',
    password: '', confirm_password: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.lecturerInvite.validate(token)
      .then((res) => {
        if (res?.success) {
          setInvite(res);
          setForm((f) => ({
            ...f,
            email: res.contact_type === 'email' ? res.contact : '',
            phone: res.contact_type === 'phone' ? res.contact : '',
          }));
          setPhase('form');
        } else {
          setErrorMsg(res?.error || 'Invalid invitation link.');
          setPhase('error');
        }
      })
      .catch(() => { setErrorMsg('Failed to validate invitation link.'); setPhase('error'); });
  }, [token]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim())  errs.last_name  = 'Required';
    if (invite?.contact_type === 'phone' && !form.email.trim()) errs.email = 'Required';
    if (!form.college.trim())    errs.college    = 'Required';
    if (!form.department.trim()) errs.department = 'Required';
    if (!form.highest_qualification) errs.highest_qualification = 'Required';
    if (form.payout_channel === 'momo' && !form.payout_account.trim()) errs.payout_account = 'Required';
    if (form.payout_channel === 'bank' && !form.payout_bank.trim()) errs.payout_bank = 'Required';
    if (form.payout_channel === 'bank' && !form.payout_account.trim()) errs.payout_account = 'Account number required';
    if (!form.password || form.password.length < 8) errs.password = 'At least 8 characters';
    if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        college: form.college.trim(),
        department: form.department.trim(),
        specialty_courses: form.specialty_courses.split(',').map((s) => s.trim()).filter(Boolean),
        highest_qualification: form.highest_qualification,
        payout_channel: form.payout_channel,
        payout_network: form.payout_channel === 'momo' ? form.payout_network : undefined,
        payout_account: form.payout_account.trim() || undefined,
        payout_bank: form.payout_channel === 'bank' ? form.payout_bank.trim() : undefined,
        payout_bank_branch: form.payout_channel === 'bank' ? form.payout_bank_branch.trim() : undefined,
        payout_account_name: form.payout_account_name.trim() || undefined,
        password: form.password,
      };

      const res = await api.lecturerInvite.complete(token, payload);
      if (res?.success && res?.user) {
        if (res.token) {
          localStorage.setItem('token', res.token);
          if (res.refreshToken) localStorage.setItem('refreshToken', res.refreshToken);
          localStorage.setItem('user', JSON.stringify(res.user));
          await checkAuth(true);
        }
        setPhase('done');
        setTimeout(() => navigate('/'), 2500);
      } else {
        setErrors({ _form: res?.error || 'Submission failed. Please try again.' });
      }
    } catch (err) {
      setErrors({ _form: 'An error occurred. Please try again.' });
    }
    setSubmitting(false);
  };

  if (phase === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>Validating invitation…</div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Link Not Valid</h2>
            <p style={{ color: '#64748b', margin: '0 0 20px' }}>{errorMsg}</p>
            <button type="button" onClick={() => navigate('/')} style={btnStyle}>Go to Learnda</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Welcome to Learnda!</h2>
            <p style={{ color: '#64748b', margin: 0 }}>Your lecturer account is ready. Taking you to the platform…</p>
          </div>
        </div>
      </div>
    );
  }

  const Field = ({ label, name, children, required }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}</label>
      {children}
      {errors[name] && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors[name]}</div>}
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 640 }}>
        <Logo />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>Lecturer Registration</h1>
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
          Complete your profile to join Learnda as a lecturer.
        </p>

        {errors._form && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 20 }}>
            {errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Personal info */}
          <SectionTitle>Personal Information</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="First Name" name="first_name" required>
              <input style={inputStyle(errors.first_name)} value={form.first_name} onChange={set('first_name')} placeholder="e.g. Kofi" />
            </Field>
            <Field label="Last Name" name="last_name" required>
              <input style={inputStyle(errors.last_name)} value={form.last_name} onChange={set('last_name')} placeholder="e.g. Mensah" />
            </Field>
          </div>

          {invite?.contact_type === 'email' ? (
            <Field label="Email Address" name="email">
              <input style={{ ...inputStyle(), background: '#f8fafc', cursor: 'not-allowed' }} value={form.email} readOnly />
            </Field>
          ) : (
            <Field label="Email Address" name="email" required>
              <input style={inputStyle(errors.email)} type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" />
            </Field>
          )}

          {invite?.contact_type === 'phone' ? (
            <Field label="Phone Number" name="phone">
              <input style={{ ...inputStyle(), background: '#f8fafc', cursor: 'not-allowed' }} value={form.phone} readOnly />
            </Field>
          ) : (
            <Field label="Phone Number (optional)" name="phone">
              <input style={inputStyle()} value={form.phone} onChange={set('phone')} placeholder="e.g. 0241234567" />
            </Field>
          )}

          {/* Academic info */}
          <SectionTitle>Academic Profile</SectionTitle>
          <Field label="College / School / University" name="college" required>
            <input style={inputStyle(errors.college)} value={form.college} onChange={set('college')} placeholder="e.g. University of Ghana, School of Education" />
          </Field>
          <Field label="Department" name="department" required>
            <input style={inputStyle(errors.department)} value={form.department} onChange={set('department')} placeholder="e.g. Educational Psychology" />
          </Field>
          <Field label="Specialty Courses" name="specialty_courses">
            <input style={inputStyle()} value={form.specialty_courses} onChange={set('specialty_courses')} placeholder="Comma-separated, e.g. EBS 106, PSYC 201, EDUC 301" />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Separate multiple courses with commas</div>
          </Field>
          <Field label="Highest Qualification" name="highest_qualification" required>
            <select style={inputStyle(errors.highest_qualification)} value={form.highest_qualification} onChange={set('highest_qualification')}>
              <option value="">Select qualification</option>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>

          {/* Payout */}
          <SectionTitle>Payout Information</SectionTitle>
          <Field label="Payout Channel" name="payout_channel">
            <div style={{ display: 'flex', gap: 12 }}>
              {['momo', 'bank'].map((ch) => (
                <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="payout_channel" value={ch} checked={form.payout_channel === ch} onChange={set('payout_channel')} />
                  {ch === 'momo' ? 'Mobile Money' : 'Bank Account'}
                </label>
              ))}
            </div>
          </Field>

          {form.payout_channel === 'momo' && (
            <>
              <Field label="Mobile Network" name="payout_network">
                <select style={inputStyle()} value={form.payout_network} onChange={set('payout_network')}>
                  {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="MoMo Number" name="payout_account" required>
                <input style={inputStyle(errors.payout_account)} value={form.payout_account} onChange={set('payout_account')} placeholder="e.g. 0241234567" />
              </Field>
            </>
          )}

          {form.payout_channel === 'bank' && (
            <>
              <Field label="Bank Name" name="payout_bank" required>
                <input style={inputStyle(errors.payout_bank)} value={form.payout_bank} onChange={set('payout_bank')} placeholder="e.g. GCB Bank" />
              </Field>
              <Field label="Branch" name="payout_bank_branch">
                <input style={inputStyle()} value={form.payout_bank_branch} onChange={set('payout_bank_branch')} placeholder="e.g. Legon Branch" />
              </Field>
              <Field label="Account Number" name="payout_account" required>
                <input style={inputStyle(errors.payout_account)} value={form.payout_account} onChange={set('payout_account')} placeholder="Account number" />
              </Field>
            </>
          )}

          <Field label="Account Name" name="payout_account_name">
            <input style={inputStyle()} value={form.payout_account_name} onChange={set('payout_account_name')} placeholder="Name on the account" />
          </Field>

          {/* Password */}
          <SectionTitle>Set Your Password</SectionTitle>
          <Field label="Password" name="password" required>
            <input style={inputStyle(errors.password)} type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
          </Field>
          <Field label="Confirm Password" name="confirm_password" required>
            <input style={inputStyle(errors.confirm_password)} type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="Repeat your password" />
          </Field>

          <button type="submit" disabled={submitting} style={{ ...btnStyle, width: '100%', marginTop: 8, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Creating account…' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <img src={`${import.meta.env.BASE_URL}learnda-logo.webp`} alt="Learnda" style={{ height: 36 }} />
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '24px 0 12px' }}>
      {children}
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f1f5f9',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '32px 16px 64px',
};

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  padding: '32px 28px',
  width: '100%',
  maxWidth: 520,
  boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5,
};

const inputStyle = (err) => ({
  width: '100%',
  padding: '9px 12px',
  border: `1px solid ${err ? '#fca5a5' : '#e2e8f0'}`,
  borderRadius: 6,
  fontSize: 14,
  background: err ? '#fff5f5' : '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#1e293b',
});

const btnStyle = {
  padding: '11px 24px',
  background: '#2b62c4',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
