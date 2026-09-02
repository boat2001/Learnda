// Asks a learner which class they are in, once.
//
// This replaces Sharether's college / affiliate university / programme / level
// / semester / index-number gate. A Learnda learner needs exactly one fact
// before any content can be shown: their class (§5). SHS learners also pick a
// learning area, because §4.4 forbids showing every SHS subject to everyone.
//
// The class is set once and then owned by the academic year (§1.4, §6.4), so
// this deliberately reads as a one-time setup step, not an editable setting.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdSchool, MdInfoOutline, MdCheck } from 'react-icons/md';
import api from '../../services/api';
import {
  CLASS_LEVELS_BY_GROUP,
  LEVEL_GROUPS,
  LEVEL_GROUP_LABELS,
  getLevelGroup,
} from '../../constants/education';
import './ClassPlacementPrompt.css';

const GROUP_ORDER = [
  LEVEL_GROUPS.KINDERGARTEN,
  LEVEL_GROUPS.PRIMARY,
  LEVEL_GROUPS.JHS,
  LEVEL_GROUPS.SHS,
];

export default function ClassPlacementPrompt({ mode = 'class', classLevel = null, onPlaced }) {
  const [selected, setSelected] = useState(classLevel);
  const [pathwayId, setPathwayId] = useState(null);
  const [isStemSchool, setIsStemSchool] = useState(false);
  const [pathways, setPathways] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedGroup = useMemo(() => getLevelGroup(selected), [selected]);
  const needsPathway = selectedGroup === LEVEL_GROUPS.SHS;

  // Reload pathways when the STEM-school answer changes: §4.4.9 keeps the STEM
  // pathway out of the list entirely unless the learner's school offers it.
  useEffect(() => {
    if (!needsPathway) return;
    let cancelled = false;
    api.subjects.getPathways({ isStemSchool })
      .then((res) => { if (!cancelled) setPathways(res?.data || []); })
      .catch(() => { if (!cancelled) setPathways([]); });
    return () => { cancelled = true; };
  }, [needsPathway, isStemSchool]);

  // If the learner deselects STEM eligibility while holding a STEM pathway,
  // drop the now-invalid choice rather than submitting something the API rejects.
  useEffect(() => {
    if (!pathwayId) return;
    const stillOffered = pathways.some((p) => p.id === pathwayId);
    if (pathways.length && !stillOffered) setPathwayId(null);
  }, [pathways, pathwayId]);

  const canSubmit = Boolean(selected) && (!needsPathway || Boolean(pathwayId)) && !saving;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await api.request('/me/class-placement', {
        method: 'PUT',
        body: JSON.stringify({
          class_level: selected,
          pathway_id: needsPathway ? pathwayId : null,
          is_stem_school: needsPathway ? isStemSchool : false,
        }),
      });
      onPlaced?.();
    } catch (err) {
      setError(err?.message || 'We could not save your class. Please try again.');
      setSaving(false);
    }
  }, [canSubmit, selected, needsPathway, pathwayId, isStemSchool, onPlaced]);

  return (
    <div className="placement">
      <header className="placement__header">
        <span className="placement__icon" aria-hidden="true"><MdSchool /></span>
        <h1 className="placement__title">
          {mode === 'pathway' ? 'Which learning area are you offering?' : 'Which class are you in?'}
        </h1>
        <p className="placement__sub">
          {mode === 'pathway'
            ? 'Your learning area decides which elective subjects you study.'
            : 'Your lessons and practice come from your class, so we only need this once.'}
        </p>
      </header>

      {mode !== 'pathway' && (
        <div className="placement__groups">
          {GROUP_ORDER.map((group) => (
            <section key={group} className="placement__group">
              <h2 className="placement__group-title">{LEVEL_GROUP_LABELS[group]}</h2>
              <div className="placement__options">
                {CLASS_LEVELS_BY_GROUP[group].map((level) => (
                  <button
                    key={level.code}
                    type="button"
                    className={`placement__option${selected === level.code ? ' is-selected' : ''}`}
                    onClick={() => { setSelected(level.code); setPathwayId(null); }}
                    aria-pressed={selected === level.code}
                  >
                    {level.label}
                    {selected === level.code && <MdCheck aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {needsPathway && (
        <section className="placement__pathways">
          <h2 className="placement__group-title">Learning area</h2>

          <label className="placement__checkbox">
            <input
              type="checkbox"
              checked={isStemSchool}
              onChange={(e) => setIsStemSchool(e.target.checked)}
            />
            <span>My school is a designated STEM school</span>
          </label>

          <div className="placement__options placement__options--stack">
            {pathways.map((pathway) => (
              <button
                key={pathway.id}
                type="button"
                className={`placement__option placement__option--wide${pathwayId === pathway.id ? ' is-selected' : ''}`}
                onClick={() => setPathwayId(pathway.id)}
                aria-pressed={pathwayId === pathway.id}
              >
                <span>
                  <strong>{pathway.name}</strong>
                  {pathway.description && <em>{pathway.description}</em>}
                </span>
                {pathwayId === pathway.id && <MdCheck aria-hidden="true" />}
              </button>
            ))}
            {pathways.length === 0 && (
              <p className="placement__note">No learning areas are available yet.</p>
            )}
          </div>
        </section>
      )}

      <p className="placement__notice">
        <MdInfoOutline aria-hidden="true" />
        You move up a class automatically at the start of each school year. If this is
        ever wrong, a parent or your school can correct it.
      </p>

      {error && <p className="placement__error" role="alert">{error}</p>}

      <button
        type="button"
        className="btn btn-primary placement__submit"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {saving ? 'Saving…' : 'Start learning'}
      </button>
    </div>
  );
}
