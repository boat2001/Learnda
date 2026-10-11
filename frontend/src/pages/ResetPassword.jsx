import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import PageHeader from '../components/common/PageHeader';
import './SharedPages.css';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }, [location.search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const isResetFlow = Boolean(token);

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('');

    try {
      const response = await authService.forgotPassword(email.trim());
      if (response?.success) {
        setStatus('Check your email for a reset link. If it exists, it will arrive shortly.');
      } else {
        setError(response?.error || 'Unable to request password reset.');
      }
    } catch (err) {
      setError(err.message || 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPassword(token, password);
      if (response?.success) {
        setStatus('Password updated. You can now sign in with your new password.');
        setPassword('');
        setConfirm('');
      } else {
        setError(response?.error || 'Unable to reset password.');
      }
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader icon="password" title={isResetFlow ? 'Set a new password' : 'Forgot your password?'} description={isResetFlow ? 'Choose a new password for your Learnda account.' : 'We will send a reset link to your email.'}>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => navigate('/contact')}
        >
          Open support page
        </button>
      </PageHeader>

      <section className="page-section">
        <div className="section-heading">
          <h2>{isResetFlow ? 'Set new password' : 'Request reset link'}</h2>
          <p>{isResetFlow ? 'Use a strong password you have not used before.' : 'We will email you a secure reset link.'}</p>
        </div>

        <form className="form-card" onSubmit={isResetFlow ? handleResetPassword : handleRequestReset}>
          {!isResetFlow && (
            <div className="form-row">
              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@university.edu"
                required
                disabled={loading}
              />
            </div>
          )}

          {isResetFlow && (
            <>
              <div className="form-row">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a new password"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-row">
                <label htmlFor="reset-confirm">Confirm password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repeat your new password"
                  required
                  disabled={loading}
                />
              </div>
            </>
          )}

          {error && <p className="report-status">{error}</p>}
          {status && <p className="report-status">{status}</p>}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : isResetFlow ? 'Update password' : 'Send reset link'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }))}
            >
              Back to sign in
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
