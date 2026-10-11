import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
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
    body: 'Help build Learnda features, improve platform reliability, and shape student-first tools.',
    action: '/contact?topic=Partnerships&message=I%20want%20to%20apply%20as%20a%20developer%20for%20Learnda.',
    actionLabel: 'Apply as Developer',
  },
];

export default function Join() {
  return (
    <div className="page-shell">
      <PageHeader icon="join" title="Join Learnda" description="Learn, create or build with us.">
        <Link className="btn btn-primary" to="/register">
          Join Learnda
        </Link>
        <Link className="btn btn-secondary" to="/about">
          Learn Our Mission
        </Link>
      </PageHeader>

      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="community" /><span className="section-heading__title">Ways to join</span></h2>
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
