import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Rewards.css';

const TRACK_STEPS = [
  'Open Learnda and tap Practice > Quick quiz daily.',
  'Complete at least one lesson or quiz every day.',
  'Review your streak badge in the Rewards area after day 7.',
];

export default function SevenDayStreak() {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadSummary = async () => {
      try {
        const response = await api.rewards.getSummary();
        setSummary(response?.summary || null);
      } catch (error) {
        setStatus(error.message || 'Unable to load streak data.');
      }
    };
    loadSummary();
  }, [isAuthenticated]);

  const streakStage = summary?.stages?.streak || {};
  const streakDays = streakStage.days || 0;

  const claimStreak = async () => {
    try {
      const response = await api.rewards.claim({ type: 'streak_7_day' });
      if (response?.success) {
        setStatus('Streak reward claimed!');
        const refreshed = await api.rewards.getSummary();
        setSummary(refreshed?.summary || null);
      } else {
        setStatus(response?.error || 'Unable to claim streak reward.');
      }
    } catch (error) {
      setStatus(error.message || 'Unable to claim streak reward.');
    }
  };

  return (
    <div className="rewards-page">
      <section className="rewards-hero">
        <div className="hero-text">
          <span className="hero-tag">Streak challenge</span>
          <h1>Complete a 7-day streak to earn extra cash</h1>
          <p>
            Keep the momentum for a full week by opening Learnda daily, exploring a lesson, and checking
            in with practice drills. Finish the streak and we reward you with GH₵ 1 to spend on premium tools.
          </p>
        </div>
        <div className="hero-card streak-card">
          <p className="hero-card-label">Current streak</p>
          <p className="hero-card-value">{streakDays} / 7 days</p>
          <p className="hero-card-note">Stay consistent - the reward unlocks when you reach day seven.</p>
        </div>
      </section>

      <section className="reward-breakdown">
        <h2>Streak status</h2>
        <div className="stage-grid">
          <div className="stage-card">
            <span className={`stage-status ${streakStage.status || 'locked'}`}>
              {streakStage.status || 'locked'}
            </span>
            <h3>7-day streak reward</h3>
            <p>Reward: GH₵ 1.00</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={claimStreak}
              disabled={streakStage.status !== 'ready'}
            >
              Claim reward
            </button>
          </div>
        </div>
      </section>

      <section className="reward-breakdown">
        <h2>Daily checklist</h2>
        <ol>
          {TRACK_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          Each day you check in, the streak tracker fills. Miss a day and the count resets, so stay focused
          and invite a friend along to earn even more.
        </p>
      </section>

      <section className="rewards-actions">
        <button className="btn btn-primary" type="button">
          Start today&apos;s streak
        </button>
        <button className="btn btn-secondary" type="button">
          View streak tips
        </button>
      </section>
      {status && <p className="status-message">{status}</p>}
    </div>
  );
}
