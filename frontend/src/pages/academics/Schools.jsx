import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowRight, FiMapPin } from 'react-icons/fi';
import PageHeader from '../../components/common/PageHeader';
import CompactInfoList from '../../components/common/CompactInfoList';
import RelatedPageLink from '../../components/common/RelatedPageLink';
import NotFound from '../../components/common/NotFound';
import usePageTitle from '../../hooks/usePageTitle';
import { SCHOOL_CATEGORIES, SCHOOL_PROFILES, SCHOOL_PROFILE_REVIEW_DATE } from './schoolProfiles';
import '../SharedPages.css';
import './Academics.css';

export default function Schools() {
  usePageTitle('Schools added');
  const [categories, setCategories] = useState([]);
  const toggleCategory = (key) => setCategories(selected => selected.includes(key)
    ? selected.filter(item => item !== key)
    : [...selected, key]);
  const filtered = SCHOOL_PROFILES.filter(school => !categories.length || categories.some(key => school.categories.includes(key)));
  return (
    <div className="page-shell footer-page compact-info-page academic-page">
      <PageHeader icon="partnerships" title="Schools" />
      <p className="academic-note">Public school profiles; inclusion does not imply a Learnda partnership.</p>
      <div className="school-filters" role="group" aria-label="School stage">
        {SCHOOL_CATEGORIES.map(item => <button key={item.key} type="button" aria-pressed={categories.includes(item.key)} onClick={() => toggleCategory(item.key)}>{item.label}</button>)}
      </div>
      <p role="status">{filtered.length} {filtered.length === 1 ? 'school' : 'schools'} found</p>
      <div className="academic-grid">
        {filtered.map(school => <article className="academic-card" key={school.slug}>
          <div className="school-card__heading"><span className="school-card__mark" aria-hidden="true">{school.initials}</span><h2>{school.name}</h2></div>
          <p className="school-card__location"><FiMapPin aria-hidden="true" />{school.location}</p>
          <p className="school-card__levels">{school.levels}</p>
          <Link className="academic-card__link" to={`/schools/${school.slug}`}>View Profile <FiArrowRight aria-hidden="true" /></Link>
        </article>)}
      </div>
      {!filtered.length && <p className="academic-note">No schools match. Deselect the filters to show all schools.</p>}
      <RelatedPageLink to="/partnerships" icon="partnership" title="Add Your School" />
    </div>
  );
}

export function SchoolProfile() {
  const { slug } = useParams();
  const school = SCHOOL_PROFILES.find(item => item.slug === slug);
  usePageTitle(school?.name || 'School not found');
  if (!school) return <NotFound />;
  return (
    <div className="page-shell footer-page compact-info-page academic-page">
      <PageHeader icon="partnerships" title={school.name} description={school.location} />
      <section className="academic-card" aria-label="School profile">
        <span className="academic-card__badge">Public school profile</span>
        <p>{school.description}</p>
        <CompactInfoList items={[{ title: 'Learning stages', body: school.levels }, ...school.highlights]} />
        <div className="academic-sources">{school.sources.map(source => <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</div>
        <p className="school-card__levels">Information checked {SCHOOL_PROFILE_REVIEW_DATE}.</p>
      </section>
      <RelatedPageLink to="/schools" icon="manual" title="All Schools" />
      <RelatedPageLink to={`/contact?topic=${encodeURIComponent(`School profile: ${school.name}`)}`} icon="contact" title="Suggest a Correction" />
    </div>
  );
}
