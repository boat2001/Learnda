import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import api from '../../services/api';
import {
  getProgramCategoryCode,
  buildIndexNumberExample,
  deriveCollegeCode,
  formatIndexNumberInput,
} from '../../utils/studentIdentity';
import '../../pages/Onboarding/Onboarding.css';

/**
 * Progressive-onboarding gate shown when an authenticated user opens
 * programme-specific content (Learn / Courses / PLS) without a full academic
 * profile. Collects the academic details deferred at sign-up, then reveals the
 * gated content. Submits via the same `completeProfile` endpoint used by the
 * original onboarding step, so server-side validation is unchanged.
 */
export default function AcademicProfileGate({ onComplete }) {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();

  const [form, setForm] = useState({
    full_name: user?.full_name || user?.name || '',
    institution_id: user?.institution_id || '',
    institution: user?.institution || '',
    affiliate_university: user?.affiliate_university || '',
    program: user?.programme_category || '',
    academic_program: user?.academic_program || '',
    level: user?.level || '',
    semester: user?.semester || '',
    index_number: user?.index_number || '',
  });

  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const indexInputRef = useRef(null);
  const indexCursorRef = useRef(null);

  // Restore cursor after React re-renders the formatted index number value.
  useLayoutEffect(() => {
    if (indexCursorRef.current !== null && indexInputRef.current) {
      const pos = indexCursorRef.current;
      indexCursorRef.current = null;
      indexInputRef.current.setSelectionRange(pos, pos);
    }
  });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const response = await api.me.getAcademicCatalog();
        if (!isMounted) return;
        setCatalog(response?.data || null);
      } catch {
        if (isMounted) {
          setCatalogError('Unable to load colleges right now. Please refresh and try again.');
        }
      } finally {
        if (isMounted) setCatalogLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const universities = useMemo(
    () => Array.isArray(catalog?.universities) ? catalog.universities : [],
    [catalog]
  );

  const colleges = useMemo(
    () => Array.isArray(catalog?.colleges) ? catalog.colleges : [],
    [catalog]
  );

  const selectedCollege = useMemo(
    () => colleges.find((c) => String(c.id) === String(form.institution_id)) || null,
    [colleges, form.institution_id]
  );

  const universityOptions = useMemo(() => {
    const currentValue = String(form.affiliate_university || '').trim();
    const options = new Map();
    universities.forEach((item) => {
      const value = String(item?.name || '').trim();
      if (!value) return;
      options.set(value, {
        value,
        label: String(item?.code || item?.name || '').trim() || value,
      });
    });
    if (currentValue && !options.has(currentValue)) {
      options.set(currentValue, { value: currentValue, label: currentValue });
    }
    return Array.from(options.values());
  }, [universities, form.affiliate_university]);

  const collegeOptions = useMemo(() => (
    colleges
      .filter((c) => !form.affiliate_university || c.affiliate_university === form.affiliate_university)
      .slice()
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
  ), [colleges, form.affiliate_university]);

  const programCategoryOptions = useMemo(() => {
    if (!selectedCollege) return [];
    return Array.isArray(selectedCollege.programme_categories) ? selectedCollege.programme_categories : [];
  }, [selectedCollege]);

  const academicProgramOptions = useMemo(() => {
    if (!form.program) return [];
    const byCategory = catalog?.programs_by_category || {};
    return Array.isArray(byCategory[form.program]) ? byCategory[form.program] : [];
  }, [catalog, form.program]);

  const expectedProgramCode = useMemo(() => getProgramCategoryCode(form.program), [form.program]);

  const indexExample = useMemo(() => buildIndexNumberExample({
    collegeCode: deriveCollegeCode(selectedCollege),
    programCode: expectedProgramCode,
  }), [expectedProgramCode, selectedCollege]);

  const handleUniversityChange = (e) => {
    const nextUniversity = e.target.value;
    setForm((prev) => {
      const preserveCollege = selectedCollege?.affiliate_university === nextUniversity;
      return {
        ...prev,
        affiliate_university: nextUniversity,
        institution_id: preserveCollege ? prev.institution_id : '',
        institution: preserveCollege ? prev.institution : '',
        program: preserveCollege ? prev.program : '',
        academic_program: preserveCollege ? prev.academic_program : '',
      };
    });
    setError('');
  };

  const handleCollegeChange = (e) => {
    const selectedId = e.target.value;
    const nextCollege = colleges.find((c) => String(c.id) === String(selectedId));
    setForm((prev) => ({
      ...prev,
      institution_id: selectedId,
      institution: nextCollege?.name || '',
      affiliate_university: String(nextCollege?.affiliate_university || '').trim(),
      program: '',
      academic_program: '',
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.completeProfile({
        role: user?.role || 'student',
        full_name: form.full_name.trim(),
        institution_id: form.institution_id || null,
        institution: form.institution.trim(),
        affiliate_university: form.affiliate_university.trim(),
        program: form.program.trim(),
        academic_program: form.academic_program.trim(),
        level: form.level.trim(),
        semester: form.semester.trim(),
        index_number: formatIndexNumberInput(form.index_number, { showTrailingSeparator: false }),
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save your details');
      }

      await checkAuth(true);
      if (onComplete) onComplete();
    } catch (err) {
      setError(err.message || 'Failed to save your details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-shell">
      <section className="onboarding-card">
        <span className="onboarding-kicker">Almost there</span>
        <h1 className="onboarding-title">Tell us your programme</h1>
        <p className="onboarding-subtitle">
          We use this to show you the right courses for your college and year. It only takes a minute.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="onboarding-grid">

            <div className="onboarding-field onboarding-span-two">
              <label htmlFor="gate_full_name">Full Name</label>
              <input
                id="gate_full_name"
                type="text"
                value={form.full_name}
                onChange={(e) => { setForm((prev) => ({ ...prev, full_name: e.target.value })); setError(''); }}
                placeholder="Enter your full name"
                autoComplete="name"
                required
                disabled={loading}
              />
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_affiliate_university">Affiliated University</label>
              <select
                id="gate_affiliate_university"
                value={form.affiliate_university}
                onChange={handleUniversityChange}
                required
                disabled={loading || catalogLoading}
              >
                <option value="">
                  {catalogLoading ? 'Loading...' : 'Select affiliated university'}
                </option>
                {universityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {catalogError ? <span className="field-error">{catalogError}</span> : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_institution_id">College</label>
              <select
                id="gate_institution_id"
                value={form.institution_id}
                onChange={handleCollegeChange}
                required
                disabled={loading || catalogLoading}
              >
                <option value="">
                  {catalogLoading ? 'Loading colleges...' : 'Select college'}
                </option>
                {collegeOptions.map((college) => (
                  <option key={college.id} value={college.id}>{college.name}</option>
                ))}
              </select>
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_program">Programme Category</label>
              <select
                id="gate_program"
                value={form.program}
                onChange={(e) => { setForm((prev) => ({ ...prev, program: e.target.value, academic_program: '' })); setError(''); }}
                required
                disabled={loading || !selectedCollege}
              >
                <option value="">Select programme category</option>
                {programCategoryOptions.map((category) => (
                  <option key={category.code || category.name} value={category.name}>{category.name}</option>
                ))}
              </select>
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_academic_program">Program</label>
              <select
                id="gate_academic_program"
                value={form.academic_program}
                onChange={(e) => { setForm((prev) => ({ ...prev, academic_program: e.target.value })); setError(''); }}
                required
                disabled={loading || !form.program}
              >
                <option value="">Select program</option>
                {academicProgramOptions.map((p) => (
                  <option key={p.id || p.name} value={p.name}>
                    {p.name}{p.is_placeholder ? ' (general track)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_level">Level</label>
              <select
                id="gate_level"
                value={form.level}
                onChange={(e) => { setForm((prev) => ({ ...prev, level: e.target.value })); setError(''); }}
                required
                disabled={loading}
              >
                <option value="">Select level</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
                <option value="400">400</option>
                <option value="graduate">Graduate</option>
              </select>
            </div>

            <div className="onboarding-field">
              <label htmlFor="gate_semester">Semester</label>
              <select
                id="gate_semester"
                value={form.semester}
                onChange={(e) => { setForm((prev) => ({ ...prev, semester: e.target.value })); setError(''); }}
                required
                disabled={loading}
              >
                <option value="">Select semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>

            <div className="onboarding-field onboarding-span-two">
              <label htmlFor="gate_index_number">Index No. or Applc. No.</label>
              <input
                id="gate_index_number"
                ref={indexInputRef}
                value={form.index_number}
                onChange={(e) => {
                  const selStart = e.target.selectionStart;
                  // Count raw (alphanumeric) chars before the cursor so we can
                  // map it back to the right position in the formatted string.
                  const rawBefore = e.target.value.slice(0, selStart).replace(/[^A-Z0-9]/gi, '').length;
                  const formatted = formatIndexNumberInput(e.target.value);
                  let rawCount = 0;
                  let newCursor = formatted.length;
                  for (let i = 0; i <= formatted.length; i++) {
                    if (rawCount >= rawBefore) { newCursor = i; break; }
                    if (i < formatted.length && /[A-Z0-9]/i.test(formatted[i])) rawCount++;
                  }
                  indexCursorRef.current = newCursor;
                  setForm((prev) => ({ ...prev, index_number: formatted }));
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Backspace') return;
                  const input = e.currentTarget;
                  const cursorAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
                  if (!cursorAtEnd || !form.index_number.endsWith('/')) return;
                  e.preventDefault();
                  const nextRawValue = form.index_number.slice(0, -2);
                  setForm((prev) => ({ ...prev, index_number: formatIndexNumberInput(nextRawValue) }));
                }}
                style={{ textTransform: 'uppercase' }}
                placeholder={`e.g. ${indexExample}`}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                maxLength={19}
                required
                disabled={loading}
              />
            </div>

            {selectedCollege?.notes?.length ? (
              <div className="onboarding-field onboarding-span-two">
                <p className="onboarding-hint">{selectedCollege.notes.join(' | ')}</p>
              </div>
            ) : null}
          </div>

          <div className="onboarding-actions">
            <button className="onboarding-btn primary" type="submit" disabled={loading || catalogLoading}>
              {loading ? 'Saving...' : 'Show my courses'}
            </button>
            <button
              className="onboarding-btn secondary"
              type="button"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              Maybe later
            </button>
          </div>
        </form>

        {error ? <p className="onboarding-error">{error}</p> : null}
      </section>
    </div>
  );
}
