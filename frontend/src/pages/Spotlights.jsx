import { FiAward, FiStar } from 'react-icons/fi';
import PageHeader from '../components/common/PageHeader';
import './SharedPages.css';

export default function Spotlights() {
  return (
    <div className="page-shell">
      <PageHeader icon="spotlights" title="Spotlights" description="Celebrating learners and contributors each month." />

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
