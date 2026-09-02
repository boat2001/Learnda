import { Link } from 'react-router-dom';
import './ContributionAppeal.css';

export default function ContributionAppeal({ className = '', showPlansCta = false, heading = 'Contribute to Learnda' }) {
  return (
    <div className={`contribution-appeal ${className}`.trim()}>
      <svg className="contribution-appeal__frame" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sketch-contribution-appeal" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="12" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <path d="M 8 8 L 392 8 L 392 192 L 8 192 Z" filter="url(#sketch-contribution-appeal)" />
      </svg>
      <div className="contribution-appeal__content">
        {heading ? <h2 className="contribution-appeal__heading">{heading}</h2> : null}
        <p>Learnda costs money to keep online — domain, hosting, SSL, storage, development, and content delivery, they all require fees to be paid.</p>
        <p>To share that cost, we&apos;ve come up with contribution plans with benefits to allow everyone to support the payment of such expenses and be rewarded.</p>
        <p>Your monthly contribution keeps Learnda online and working. Select a contribution plan to support the platform every month.</p>
        <p className="contribution-appeal__cta">Without your money, Learnda might go down. Do your best to support when you can. Thank you.</p>
      </div>
      {showPlansCta && (
        <Link to="/features" className="contribution-appeal__button">View Plans</Link>
      )}
    </div>
  );
}
