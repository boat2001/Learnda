import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiGlobe, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { getClassLabel, getLevelGroup, LEVEL_GROUP_LABELS, getFeatureAccess } from '../../constants/education';
import './CommunityForumPicker.css';

/**
 * Chooses which community a learner opens.
 *
 * Sharether grouped communities by college, keyed off an 88-entry lookup table
 * of Ghanaian institution short names. Learnda groups by class instead: the
 * people worth talking to about JHS 2 Science are other JHS 2 learners.
 *
 * §7 gates this entirely — community is OFF for Kindergarten and Primary, and
 * LIMITED for JHS and SHS. A learner below JHS never sees the picker at all.
 */
export default function CommunityForumPicker({ onClose, variant = 'default' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const classLevel = user?.class_level || null;
  const levelGroup = user?.level_group || getLevelGroup(classLevel);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // §7: hide rather than disable. A Basic 3 learner should not see a community
  // entry point at all, so there is nothing to ask about or try to open.
  if (getFeatureAccess('community', levelGroup) === 'off') return null;

  const classLabel = classLevel ? getClassLabel(classLevel) : null;
  const classPath = `/forum?type=class${classLevel ? `&class_level=${classLevel}` : ''}`;

  const handleSelect = (path) => {
    setOpen(false);
    onClose?.();
    navigate(path);
  };

  const isMenu = variant === 'menu-item';
  const isFooter = variant === 'footer-link';

  return (
    <div
      className={['cfp', isMenu && 'cfp--menu', isFooter && 'cfp--footer', open && 'cfp--open'].filter(Boolean).join(' ')}
      ref={containerRef}
    >
      <button
        className={isMenu ? 'menu-dropdown-item cfp-trigger' : 'cfp-trigger'}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {isMenu && <span className="menu-icon"><FiMessageCircle /></span>}
        {!isMenu && <FiMessageCircle className="cfp-trigger-icon" aria-hidden />}
        Community
        {isMenu && <span className="cfp-chevron" aria-hidden>{open ? '▴' : '▾'}</span>}
      </button>

      {open && (
        <div className={['cfp-popup', isFooter && 'cfp-popup--above'].filter(Boolean).join(' ')} role="menu">
          <button
            className="cfp-option"
            onClick={() => handleSelect(classPath)}
            type="button"
            role="menuitem"
          >
            <span className="cfp-option-icon cfp-option-icon--college"><FiUsers /></span>
            <span className="cfp-option-body">
              <strong>{classLabel ? `${classLabel} Community` : 'My Class'}</strong>
              <span>Questions and answers with learners in your class</span>
            </span>
          </button>

          <button
            className="cfp-option"
            onClick={() => handleSelect('/forum')}
            type="button"
            role="menuitem"
          >
            <span className="cfp-option-icon cfp-option-icon--global"><FiGlobe /></span>
            <span className="cfp-option-body">
              <strong>{levelGroup ? `All ${LEVEL_GROUP_LABELS[levelGroup]}` : 'Everyone'}</strong>
              <span>Learners across your level</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
