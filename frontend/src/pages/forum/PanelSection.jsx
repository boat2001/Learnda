import { FiChevronDown } from 'react-icons/fi';
import { playUiSound } from '../../utils/uiSounds';
import { PANEL_PREVIEW_LIMIT } from './helpers';

export default function PanelSection({ id, title, count, children, expanded, onToggle }) {
  const hasOverflow = Number(count) > PANEL_PREVIEW_LIMIT;
  return (
    <section className={`sgr-panel-section ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="sgr-panel-section__head"
        onClick={
          hasOverflow
            ? () => {
                playUiSound(expanded ? 'sectionClose' : 'sectionOpen');
                onToggle(id);
              }
            : undefined
        }
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span className="sgr-panel-section__meta">
          {count ? <strong>{count}</strong> : null}
          {hasOverflow ? <FiChevronDown aria-hidden /> : null}
        </span>
      </button>
      <div className="sgr-panel-section__body">{children}</div>
    </section>
  );
}
