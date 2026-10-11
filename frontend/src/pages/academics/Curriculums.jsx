import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import PageHeader from '../../components/common/PageHeader';
import CompactInfoList from '../../components/common/CompactInfoList';
import RelatedPageLink from '../../components/common/RelatedPageLink';
import usePageTitle from '../../hooks/usePageTitle';
import '../SharedPages.css';
import './Academics.css';

const PLANNED = [
  { title: 'Cambridge International', body: 'Primary and secondary pathways, including Cambridge qualifications.', href: 'https://www.cambridgeinternational.org/programmes-and-qualifications/' },
  { title: 'International Baccalaureate (IB)', body: 'Primary Years, Middle Years, and Diploma programmes.', href: 'https://ibo.org/programmes' },
  { title: 'British Curriculum', body: 'The National Curriculum for England, by key stage.', href: 'https://www.gov.uk/government/collections/national-curriculum' },
];

export default function Curriculums() {
  usePageTitle('Curriculums covered');
  return (
    <div className="page-shell footer-page compact-info-page academic-page">
      <PageHeader icon="manual" title="Curricula" />
      <section className="academic-card" aria-labelledby="nacca-heading">
        <span className="academic-card__badge">Current</span>
        <h2 id="nacca-heading">Ghana's NaCCA curriculum</h2>
        <CompactInfoList items={[
          { title: 'Kindergarten & Primary', body: 'KG 1–KG 2 and Basic 1–Basic 6, following the standards-based curriculum.' },
          { title: 'Junior High', body: 'JHS 1–JHS 3, following the Common Core Programme, with practice towards BECE.' },
          { title: 'Senior High', body: 'SHS 1–SHS 3, with core subjects and elective pathways, and revision towards WASSCE.' },
        ]} />
        <Link className="academic-card__link" to="/learn">Explore your class <FiArrowRight aria-hidden="true" /></Link>
        <div className="academic-sources"><a href="https://nacca.gov.gh/" target="_blank" rel="noopener noreferrer">Official curriculum reference: NaCCA</a></div>
      </section>
      <section className="academic-section" aria-labelledby="planned-curriculums">
        <h2 id="planned-curriculums">Planned Curricula</h2>
        <div className="academic-grid">
          {PLANNED.map(item => <article className="academic-card" key={item.title}>
            <span className="academic-card__badge academic-card__badge--planned">Planned</span>
            <h3>{item.title}</h3><p>{item.body}</p>
            <div className="academic-sources"><a href={item.href} target="_blank" rel="noopener noreferrer">About this curriculum</a></div>
          </article>)}
        </div>
      </section>
      <RelatedPageLink to="/contact?topic=Curriculum%20request" icon="contact" title="Request a Curriculum" />
    </div>
  );
}
