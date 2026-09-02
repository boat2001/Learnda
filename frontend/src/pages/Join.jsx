import { Link } from 'react-router-dom';
import './SharedPages.css';

const WAYS_TO_JOIN = [
  {
    title: 'Join as a learner',
    body: 'Track progress, practice daily, and build stronger study habits with structured tools.',
    action: '/register',
    actionLabel: 'Create Student Account',
  },
  {
    title: 'Create content',
    body: 'Publish lessons, quizzes, files, and edutainment while growing your audience.',
    action: '/contribute',
    actionLabel: 'Start Contributing',
  },
  {
    title: 'Join as a developer',
    body: 'Help build Sharether features, improve platform reliability, and shape student-first tools.',
    action: '/contact?topic=Partnerships&message=I%20want%20to%20apply%20as%20a%20developer%20for%20Sharether.',
    actionLabel: 'Apply as Developer',
  },
];

export default function Join() {
  return (
    <div className="page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-mission">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Movement, not marketing</span>
            <h1 className="hero-title">Choose your role in the student-first learning movement.</h1>
            <p className="hero-subtitle">
              Sharether grows when learners, creators, and builders push the same mission from different angles.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/register">
                Join Sharether
              </Link>
              <Link className="btn btn-secondary" to="/about">
                Learn Our Mission
              </Link>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">{WAYS_TO_JOIN.length} roles</span>
                <span className="stat-label">Multiple ways to contribute depending on your skills and goals.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Student-led</span>
                <span className="stat-label">The strongest contributions stay close to real academic pressure points.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Mission-linked</span>
                <span className="stat-label">Every path here should make learning clearer, faster, or more sustainable.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">Why this movement matters</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Learning clarity</strong>
                  <p>Students get focused pathways instead of scattered resources.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Shared growth</strong>
                  <p>Peers and creators improve outcomes together.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Sustainable impact</strong>
                  <p>Community-led contribution keeps the platform relevant, adaptive, and useful.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Ways to join</h2>
          <p>Choose the role that matches your goals and strengths.</p>
        </div>
        <div className="card-grid">
          {WAYS_TO_JOIN.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className="form-actions">
                <Link className="btn btn-primary" to={item.action}>
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
