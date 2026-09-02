import './SharedPages.css';

const TERMS = [
  {
    title: 'Account responsibilities',
    body: 'Keep your login details secure and update your profile information accurately.',
  },
  {
    title: 'Content guidelines',
    body: 'Respect copyright, avoid plagiarism, and keep discussions respectful.',
  },
  {
    title: 'Payments and contributions',
    body: 'Contribution plans renew automatically unless canceled. Refunds follow plan terms.',
  },
  {
    title: 'Termination',
    body: 'We may suspend accounts that violate guidelines or threaten platform safety.',
  },
];

export default function Terms() {
  return (
    <div className="page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-legal">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Ground rules</span>
            <h1 className="hero-title">The practical rules for using Learnda well and safely.</h1>
            <p className="hero-subtitle">
              These terms outline the responsibilities, boundaries, and protections that keep the platform usable for everyone.
            </p>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">Accounts</span>
                <span className="stat-label">Your login, identity details, and usage behavior all come with clear responsibilities.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Content</span>
                <span className="stat-label">Shared material has to respect ownership, quality, and community standards.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Safety</span>
                <span className="stat-label">The rules exist to protect the platform, contributors, and learners from abuse.</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What to pay attention to first</p>
            <div className="panel-list">
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Respect the community</strong>
                  <p>Keep discussions supportive and professional.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Protect content</strong>
                  <p>Only share materials you own or can license.</p>
                </div>
              </div>
              <div className="panel-list-item">
                <span className="panel-dot"></span>
                <div>
                  <strong>Stay secure</strong>
                  <p>Report suspicious activity quickly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2>Terms overview</h2>
          <p>Here are the most important sections to review.</p>
        </div>
        <div className="card-grid">
          {TERMS.map((item) => (
            <div key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
