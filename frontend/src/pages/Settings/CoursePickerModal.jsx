import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiCheck, FiSearch, FiX, FiBookOpen, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';

const LEVELS = ['100', '200', '300', '400', '500'];
const SEMESTERS = [{ value: '1', label: 'Semester 1' }, { value: '2', label: 'Semester 2' }];

export default function CoursePickerModal({ enrolledIds = [], excludedIds = [], onAdd, onRemove, onClose }) {
  const [allCourses, setAllCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [coursesRes, programsRes] = await Promise.allSettled([
          api.courses.getAll({ limit: 500, sort_by: 'title', sort_order: 'asc' }),
          api.courses.getPrograms(),
        ]);

        if (!cancelled) {
          if (coursesRes.status === 'fulfilled') {
            setAllCourses(coursesRes.value?.data?.courses || []);
          } else {
            setError('Failed to load courses. Please try again.');
          }
          if (programsRes.status === 'fulfilled') {
            setPrograms(programsRes.value?.data?.programs || []);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load courses. Please try again.');
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return allCourses.filter((course) => {
      const matchesQuery = !q ||
        course.title?.toLowerCase().includes(q) ||
        course.code?.toLowerCase().includes(q) ||
        course.department?.toLowerCase().includes(q);

      const courseLevels = Array.isArray(course.levels) ? course.levels : (course.level ? [String(course.level)] : []);
      const matchesLevel = !levelFilter || courseLevels.includes(levelFilter);

      const courseSemesters = Array.isArray(course.semesters) ? course.semesters : (course.semester ? [String(course.semester)] : []);
      const matchesSemester = !semesterFilter || courseSemesters.includes(semesterFilter);

      const coursePrograms = Array.isArray(course.programs) ? course.programs : [];
      const matchesProgram = !programFilter ||
        coursePrograms.some((p) => String(p).toLowerCase().includes(programFilter.toLowerCase()));

      return matchesQuery && matchesLevel && matchesSemester && matchesProgram;
    });
  }, [allCourses, query, levelFilter, semesterFilter, programFilter]);

  const handleToggle = async (course) => {
    const isEnrolled = enrolledIds.includes(course.id);
    const isExcluded = excludedIds.includes(course.id);
    setPendingIds((prev) => new Set([...prev, course.id]));
    try {
      if (isEnrolled) {
        await onRemove(course.id);
      } else {
        await onAdd(course.id);
      }
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(course.id);
        return next;
      });
    }
  };

  const hasFilters = levelFilter || semesterFilter || programFilter || query;

  return (
    <div
      className="course-picker-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="course-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add courses"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="course-picker-header">
          <h3>Manage Courses</h3>
          <button type="button" className="course-picker-close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="course-picker-filters">
          <div className="course-picker-search">
            <FiSearch className="course-picker-search-icon" />
            <input
              type="text"
              placeholder="Search by title, code or department..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <select
            className="course-picker-select"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
          >
            <option value="">All Programmes</option>
            {programs.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>

          <select
            className="course-picker-select"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="">All Levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>Level {l}</option>
            ))}
          </select>

          <select
            className="course-picker-select"
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
          >
            <option value="">All Semesters</option>
            {SEMESTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <div className="course-picker-filter-bar">
            <span className="course-picker-result-count">{filtered.length} course{filtered.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              className="course-picker-clear-filters"
              onClick={() => { setQuery(''); setLevelFilter(''); setSemesterFilter(''); setProgramFilter(''); }}
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="course-picker-body">
          {loading ? (
            <div className="course-picker-state">Loading courses...</div>
          ) : error ? (
            <div className="course-picker-state course-picker-error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="course-picker-state">No courses found.</div>
          ) : (
            <div className="course-picker-grid">
              {filtered.map((course) => {
                const enrolled = enrolledIds.includes(course.id);
                const excluded = excludedIds.includes(course.id);
                const pending = pendingIds.has(course.id);
                const levels = Array.isArray(course.levels) ? course.levels : (course.level ? [String(course.level)] : []);
                const semesters = Array.isArray(course.semesters) ? course.semesters : (course.semester ? [String(course.semester)] : []);

                return (
                  <div key={course.id} className={`course-picker-card${enrolled ? ' is-enrolled' : excluded ? ' is-excluded' : ''}`}>
                    <div className="course-picker-card-img">
                      {course.image_url ? (
                        <img src={course.image_url} alt={course.title} loading="lazy" />
                      ) : (
                        <div className="course-picker-card-placeholder">
                          <FiBookOpen />
                        </div>
                      )}
                    </div>
                    <div className="course-picker-card-body">
                      <p className="course-picker-card-title" title={course.title}>{course.title}</p>
                      <div className="course-picker-card-meta">
                        {course.code && <span className="course-picker-card-code">{course.code}</span>}
                        {(course.code && (levels.length > 0 || semesters.length > 0)) && (
                          <span className="course-picker-card-dot" aria-hidden="true">·</span>
                        )}
                        {levels.map((l) => (
                          <span key={l} className="course-picker-chip">L{l}</span>
                        ))}
                        {semesters.map((s) => (
                          <span key={s} className="course-picker-chip">Sem {s}</span>
                        ))}
                        {excluded && <span className="course-picker-chip course-picker-chip--removed">Removed</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`course-picker-toggle${enrolled ? ' is-enrolled' : excluded ? ' is-excluded' : ''}`}
                      onClick={() => handleToggle(course)}
                      disabled={pending}
                      aria-label={enrolled ? `Remove ${course.title}` : excluded ? `Restore ${course.title}` : `Add ${course.title}`}
                      title={enrolled ? 'Remove' : excluded ? 'Restore' : 'Add'}
                    >
                      {enrolled ? <FiCheck /> : excluded ? <FiRefreshCw size={13} /> : <FiPlus />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
