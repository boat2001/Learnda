import CompactInfoList from '../components/common/CompactInfoList';
import PageHeader from '../components/common/PageHeader';
import RelatedPageLink from '../components/common/RelatedPageLink';
import './SharedPages.css';

const TERMS = [
  {
    title: 'Account responsibilities',
    body: 'Keep your login secure and your profile accurate.',
  },
  {
    title: 'Content guidelines',
    body: 'Respect copyright, avoid plagiarism, and be kind in discussions.',
  },
  {
    title: 'Payments and contributions',
    body: 'Contribution plans renew automatically unless canceled. Refunds follow plan terms.',
  },
  {
    title: 'Termination',
    body: 'Accounts that break these rules or threaten safety may be suspended.',
  },
];

export default function Terms() {
  return (
    <div className="page-shell footer-page compact-info-page">
      <PageHeader icon="terms" title="Terms of use" description="The ground rules for using Learnda well and safely." />

      <section className="page-section">
        <CompactInfoList items={TERMS} />
      </section>

      <RelatedPageLink to="/policies" icon="privacy" title="Privacy & child safety" description="How we look after your data." />
    </div>
  );
}
