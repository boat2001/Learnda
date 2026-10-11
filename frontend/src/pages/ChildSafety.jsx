import CompactInfoList from '../components/common/CompactInfoList';
import PageHeader from '../components/common/PageHeader';
import RelatedPageLink from '../components/common/RelatedPageLink';
import usePageTitle from '../hooks/usePageTitle';
import './SharedPages.css';

const SAFETY_SECTIONS = [
  { title: 'Learn at your own level', body: 'Start with your school class. A parent or guardian can help you choose the right class and guide your learning.' },
  { title: 'Young learners learn with a grown-up', body: 'Kindergarten and Primary learning does not include messaging or community features. Ask a trusted grown-up when you need help.' },
  { title: 'Keep personal details private', body: 'Do not share your password, home address, phone number, or school location with other learners.' },
  { title: 'Be kind to each other', body: 'Use friendly words in any community or study group. Bullying, hurtful messages, and unsafe content should be reported.' },
  { title: 'Speak up when something feels wrong', body: 'Stop and tell a trusted adult if something makes you uncomfortable. A parent, guardian, or teacher can help you report it to Learnda.' },
];

export default function ChildSafety() {
  usePageTitle('Child safety');
  return (
    <div className="page-shell footer-page compact-info-page">
      <PageHeader icon="privacy" title="Child safety" description="A little care helps everyone learn safely. For learners, parents, guardians, and teachers." />
      <section className="page-section" aria-label="Learning safely"><CompactInfoList items={SAFETY_SECTIONS} /></section>
      <RelatedPageLink to="/report" icon="security" title="Report a safety concern" description="Ask a trusted grown-up to help you tell us what happened." />
      <RelatedPageLink to="/privacy" icon="privacy" title="Privacy & cookies" description="Read how Learnda handles your data." />
    </div>
  );
}
