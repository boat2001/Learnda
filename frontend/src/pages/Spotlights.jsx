import { FiAward, FiStar } from 'react-icons/fi';
import './SharedPages.css';

export default function Spotlights() {
  return (
    <div className="page-shell">
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-rankings">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Student &amp; contributor of the month</span>
            <h1 className="hero-title">Spotlights</h1>
            <p className="hero-subtitle">
              A dedicated home for the students and contributors Sharether celebrates each month.
              This page is being built — the spotlight cards are moving here from the home page.
            </p>
          </div>
        </div>
      </section>

      <section className="page-empty-state">
        <FiAward aria-hidden className="page-empty-state__icon" />
        <h2>Coming soon</h2>
        <p>
          <FiStar aria-hidden /> We're moving the Student and Contributor Spotlight here from the
          home page. Check back soon.
        </p>
      </section>
    </div>
  );
}
