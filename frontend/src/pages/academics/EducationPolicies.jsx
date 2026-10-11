import PageHeader from '../../components/common/PageHeader';
import RelatedPageLink from '../../components/common/RelatedPageLink';
import usePageTitle from '../../hooks/usePageTitle';
import '../SharedPages.css';
import './Academics.css';

const CONTENT = {
  ges: {
    title: 'GES guidelines & policies',
    sections: [
      {
        title: 'Learning alongside school',
        policy: 'GES oversees pre-tertiary education and implements national education policy.',
        approach: 'Learnda groups learning by class and term to support classroom lessons.',
        source: 'GES resources & circulars', href: 'https://ges.gov.gh/resources.php?category=circular',
      },
      {
        title: 'Online Safety',
        policy: 'The 2023 secondary-school safety guideline includes online interactions, prevention, and reporting.',
        approach: 'Learnda provides Child Safety guidance and a Report an Issue route.',
        source: 'MoE/GES secondary-school safety guideline (2023)', href: 'https://curriculumresources.edu.gh/wp-content/uploads/2026/05/GES-Guideline-on-Tackling-Sexual-Harassment-in-SEIs-Version-1.pdf',
      },
      {
        title: 'Quality learning resources',
        policy: 'NaCCA reviews learning resources, including digital materials. Curriculum alignment does not itself mean approval.',
        approach: 'We plan to seek the relevant resource reviews and approvals.',
        source: 'NaCCA instructional resource guidance', href: 'https://nacca.gov.gh/irs/',
      },
    ],
  },
  moe: {
    title: 'MoE guidelines & policies',
    sections: [
      {
        title: 'Digital Learning',
        policy: 'CENDLOS leads open, distance, and electronic learning under the Ministry of Education.',
        approach: 'Learnda aims to widen access through mobile-friendly lessons and practice.',
        source: 'CENDLOS mission & mandate', href: 'https://cendlos.gov.gh/',
      },
      {
        title: 'Inclusive education',
        policy: 'The 2015 Inclusive Education Policy addresses diverse learning needs, including special educational needs.',
        approach: 'We aim for clear language, readable layouts, and better accessibility.',
        source: 'MoE Inclusive Education Policy, published by UNICEF', href: 'https://www.unicef.org/ghana/reports/inclusive-education-policy',
      },
      {
        title: 'Curriculum and resource quality',
        policy: 'NaCCA develops Ghana’s pre-tertiary curriculum and evaluates learning resources.',
        approach: 'Learnda follows Ghana’s class structure; Cambridge, IB, and British pathways are planned.',
        source: 'NaCCA instructional resources', href: 'https://nacca.gov.gh/instructional-resources/',
      },
    ],
  },
};

export default function EducationPolicies() {
  usePageTitle('GES & MoE guidelines and policies');
  return (
    <div className="page-shell footer-page compact-info-page academic-page">
      <PageHeader icon="privacy" title="GES & MoE" />
      <p className="academic-note">These policies inform our approach. Learnda has no formal GES or MoE approval or partnership yet.</p>
      {Object.entries(CONTENT).map(([key, content]) => <section className="academic-section" key={key} aria-labelledby={`${key}-heading`}>
        <h2 id={`${key}-heading`}>{content.title}</h2>
        <div className="academic-grid">{content.sections.map(section => <section className="academic-card" key={section.title}>
          <h3>{section.title}</h3>
          <p>{section.policy}</p>
          <p>{section.approach}</p>
          <div className="academic-sources"><a href={section.href} target="_blank" rel="noopener noreferrer">Source: {section.source}</a></div>
        </section>)}</div>
      </section>)}
      <RelatedPageLink to="/partnerships" icon="partnership" title="Partner With Learnda" />
    </div>
  );
}
