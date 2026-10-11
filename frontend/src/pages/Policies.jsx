import CompactInfoList from '../components/common/CompactInfoList';
import PageHeader from '../components/common/PageHeader';
import RelatedPageLink from '../components/common/RelatedPageLink';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
import './SharedPages.css';

const PRIVACY_SECTIONS = [
  {
    title: 'Information we collect',
    body: 'Account details, learning activity, and device data help us improve Learnda.',
  },
  {
    title: 'How we use data',
    body: 'To personalize lessons, recommend content, and keep Learnda secure.',
  },
  {
    title: 'Data sharing',
    body: 'Only with trusted hosting, payment, and analytics providers.',
  },
  {
    title: 'Your controls',
    body: 'Update preferences, request exports, or delete your account in Settings.',
  },
];

const COOKIE_SECTIONS = [
  {
    title: 'Essential cookies',
    body: 'Required for login, security, and core site functionality.',
  },
  {
    title: 'Preference cookies',
    body: 'Remember your theme, language, and learning settings.',
  },
  {
    title: 'Analytics cookies',
    body: 'Measure usage and improve performance. No third-party ad tracking.',
  },
];

export default function Policies() {
  return (
    <div className="page-shell footer-page compact-info-page">
      <PageHeader icon="privacy" title="Privacy & cookies" description="How Learnda handles your data. Only what helps learning, never for ads." />

      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="privacy" /><span className="section-heading__title">Privacy policy</span></h2>
        </div>
        <CompactInfoList items={PRIVACY_SECTIONS} />
      </section>

      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="security" /><span className="section-heading__title">Cookie policy</span></h2>
        </div>
        <CompactInfoList items={COOKIE_SECTIONS} />
      </section>

      <RelatedPageLink to="/contact?topic=Privacy%20and%20data" icon="contact" title="Questions about your data?" description="Write to the team." />
      <RelatedPageLink to="/child-safety" icon="kids" title="Child safety" description="Simple steps for learning safely together." />
    </div>
  );
}
