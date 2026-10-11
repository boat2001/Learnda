// One subject (or KG learning area) as a tappable tile.
//
// Three looks, chosen by the learner's presentation mode (§8) rather than by
// class code:
//   playful    - KG: a big picture and the name, with a speaker button
//   visual     - Primary: picture, name and a progress bar
//   structured - JHS/SHS: a compact row with progress and a chevron
import { Link } from 'react-router-dom';
import { MdChevronRight, MdVolumeUp } from 'react-icons/md';
import { getSubjectVisual, subjectColorVars } from '../../constants/subjectVisuals';
import { speak } from '../../utils/speech';
import './SubjectTile.css';

const clampPercent = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

export default function SubjectTile({ subject, mode = 'visual', showProgress = true, badge = null, to }) {
  const { icon: Icon } = getSubjectVisual(subject.slug);
  const progress = showProgress ? clampPercent(subject.progress ?? subject.progress_percent) : null;
  const href = to || `/learn/${subject.slug}`;

  return (
    <article className={`subject-tile subject-tile--${mode}`} style={subjectColorVars(subject.slug)}>
      <Link to={href} className="subject-tile__link">
        <span className="subject-tile__art" aria-hidden="true">
          <Icon />
        </span>
        <span className="subject-tile__body">
          <span className="subject-tile__name">{subject.name}</span>
          {badge && <span className="subject-tile__badge">{badge}</span>}
          {progress !== null && mode !== 'playful' && (
            <span className="subject-tile__progress">
              <span className="subject-tile__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${subject.name} progress`}>
                <span style={{ width: `${progress}%` }} />
              </span>
              <span className="subject-tile__pct">{progress}%</span>
            </span>
          )}
        </span>
        {mode === 'structured' && <MdChevronRight className="subject-tile__chevron" aria-hidden="true" />}
      </Link>

      {mode !== 'structured' && (
        <button
          type="button"
          className="subject-tile__listen"
          onClick={() => speak(subject.name)}
          aria-label={`Hear "${subject.name}"`}
        >
          <MdVolumeUp aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
