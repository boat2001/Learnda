// A short note about plans, written to the parent or guardian.
//
// Learnda's learners are children, so this never asks the child for money or
// suggests the app will disappear without them. It tells the adult what a
// plan adds and leaves the decision with them.
import { Link } from 'react-router-dom';
import { MdFamilyRestroom } from 'react-icons/md';
import './ContributionAppeal.css';

export default function ContributionAppeal({ className = '', showPlansCta = false, heading = 'For parents and guardians' }) {
  return (
    <aside className={`contribution-appeal ${className}`.trim()}>
      <span className="contribution-appeal__icon" aria-hidden="true"><MdFamilyRestroom /></span>
      <div className="contribution-appeal__content">
        {heading ? <h2 className="contribution-appeal__heading">{heading}</h2> : null}
        <p>
          Learnda is free to start. A plan adds more practice and past questions, and
          helps us write new lessons for every class.
        </p>
      </div>
      {showPlansCta && (
        <Link to="/features" className="contribution-appeal__button">See plans</Link>
      )}
    </aside>
  );
}
