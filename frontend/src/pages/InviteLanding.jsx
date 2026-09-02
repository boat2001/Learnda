import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './SharedPages.css';

const VISITOR_KEY = 'learnda_visitor_id';

const getVisitorId = () => {
  if (typeof window === 'undefined') return null;
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(VISITOR_KEY, next);
  return next;
};

export default function InviteLanding() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  useEffect(() => {
    if (!referralCode) return;
    localStorage.setItem('referral_code', referralCode);

    const visitorId = getVisitorId();
    const trackedKey = `referral_download_tracked_${referralCode}`;
    const alreadyTracked = localStorage.getItem(trackedKey);

    if (!alreadyTracked) {
      api.rewards.trackDownload({
        referral_code: referralCode,
        visitor_id: visitorId,
        source: 'invite_landing'
      }).then(() => {
        localStorage.setItem(trackedKey, 'true');
      }).catch(() => {
        // ignore tracking errors
      });
    }
  }, [referralCode]);

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">You are invited</span>
            <h1 className="hero-title">Welcome to Learnda.</h1>
            <p className="hero-subtitle">
              Sign up to start learning, keep streaks, and unlock rewards with your invite.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }))}
              >
                Create account
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }))}
              >
                I already have an account
              </button>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What you get</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Curated lessons</strong>
                  <p>Study with resources designed for your curriculum.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Rewards</strong>
                  <p>Earn for streaks and referrals.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
