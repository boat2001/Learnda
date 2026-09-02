// My Space — a learner's own corner of Learnda (§9).
//
// Renamed from Sharether's "Personal Learning Space". Holds the things a
// learner has chosen to keep: saved lessons and files, their folders, and a
// glance at where they are in the school year.
//
// Everything here is already class-scoped by the API (§5); this page never
// asks for content by class itself.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MdFolder, MdBookmark, MdSchool, MdLocalFireDepartment, MdChevronRight,
} from 'react-icons/md';
import { usePLS } from '../../hooks/usePLS';
import { useAuth } from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { getClassLabel, getUnitNoun, getLevelGroup } from '../../constants/education';
import './MySpace.css';

export default function MySpace() {
  usePageTitle('My Space');

  const { user } = useAuth();
  const { courses: savedItems, files, folders, loading, currentCourses, currentCoursesMeta } = usePLS();

  const classLevel = currentCoursesMeta?.academicProfile?.class_level || user?.class_level || null;
  const levelGroup = getLevelGroup(classLevel);
  const unitNoun = useMemo(() => getUnitNoun(levelGroup), [levelGroup]);

  const savedCount = (savedItems?.length || 0) + (files?.length || 0);

  return (
    <div className="my-space">
      <header className="my-space__header">
        <h1 className="my-space__title">My Space</h1>
        <p className="my-space__sub">Everything you have saved, in one place.</p>
      </header>

      {classLevel && (
        <section className="my-space__status">
          <div className="my-space__status-item">
            <span className="my-space__status-icon" aria-hidden="true"><MdSchool /></span>
            <div>
              <span className="my-space__status-label">Your class</span>
              <strong className="my-space__status-value">{getClassLabel(classLevel)}</strong>
            </div>
          </div>
          <div className="my-space__status-item">
            <span className="my-space__status-icon" aria-hidden="true"><MdBookmark /></span>
            <div>
              <span className="my-space__status-label">Saved</span>
              <strong className="my-space__status-value">{savedCount}</strong>
            </div>
          </div>
          <div className="my-space__status-item">
            <span className="my-space__status-icon" aria-hidden="true"><MdLocalFireDepartment /></span>
            <div>
              <span className="my-space__status-label">{unitNoun.plural}</span>
              <strong className="my-space__status-value">{currentCourses?.length || 0}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="my-space__section">
        <div className="my-space__section-head">
          <h2 className="my-space__section-title">
            <MdFolder aria-hidden="true" /> Folders
          </h2>
        </div>
        {loading ? (
          <p className="my-space__note">Loading…</p>
        ) : folders?.length ? (
          <div className="my-space__folders">
            {folders.map((folder) => (
              <div key={folder.id} className="my-space__folder">
                <span className="my-space__folder-icon" aria-hidden="true"><MdFolder /></span>
                <span className="my-space__folder-name">{folder.name}</span>
                <span className="my-space__folder-count">{folder.item_count ?? 0}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="my-space__note">
            No folders yet. Save a lesson to start organising your work.
          </p>
        )}
      </section>

      <section className="my-space__section">
        <div className="my-space__section-head">
          <h2 className="my-space__section-title">
            <MdBookmark aria-hidden="true" /> Saved
          </h2>
        </div>
        {loading ? (
          <p className="my-space__note">Loading…</p>
        ) : savedCount === 0 ? (
          <div className="my-space__empty">
            <p>Nothing saved yet.</p>
            <Link to="/learn" className="btn btn-primary">
              Go to your {unitNoun.plural.toLowerCase()}
            </Link>
          </div>
        ) : (
          <ul className="my-space__items">
            {[...(savedItems || []), ...(files || [])].map((item) => (
              <li key={item.id} className="my-space__item">
                <span className="my-space__item-title">{item.title || item.file_name}</span>
                <MdChevronRight aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
