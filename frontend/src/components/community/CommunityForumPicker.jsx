import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiGlobe, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import './CommunityForumPicker.css';

/**
 * Known Ghana institution short names.
 * Keys are lowercase for case-insensitive matching.
 * User-confirmed: FOSCO, OLACOE, ABETICOE.
 */
const GH_INSTITUTION_NAMES = {
  // ── Universities ──
  'university of ghana': 'UG',
  'university of ghana, legon': 'UG',
  'kwame nkrumah university of science and technology': 'KNUST',
  'university of cape coast': 'UCC',
  'university of education, winneba': 'UEW',
  'university of education winneba': 'UEW',
  'university for development studies': 'UDS',
  'university of professional studies': 'UPSA',
  'university of professional studies, accra': 'UPSA',
  'university of mines and technology': 'UMaT',
  'university of health and allied sciences': 'UHAS',
  'university of energy and natural resources': 'UENR',
  'university of environment and sustainable development': 'UESD',
  'ghana institute of management and public administration': 'GIMPA',
  'ghana communication technology university': 'GCTU',
  'ck tedam university of technology and applied sciences': 'CKT-UTAS',
  'c.k. tedam university': 'CKT-UTAS',
  'simon diedong dombo university': 'SDD-UBIDS',
  'akenten appiah-menka university': 'AAMUSTED',
  'akenten appiah menka university': 'AAMUSTED',
  'regional maritime university': 'RMU',
  'valley view university': 'VVU',
  // Technical Universities
  'accra technical university': 'ATU',
  'kumasi technical university': 'KsTU',
  'koforidua technical university': 'KTU',
  'cape coast technical university': 'CCTU',
  'takoradi technical university': 'TTU',
  'tamale technical university': 'TaTU',
  'ho technical university': 'HTU',
  'sunyani technical university': 'STU',
  'bolgatanga technical university': 'BTU',
  'wa technical university': 'WTU',

  // ── Colleges of Education ──
  'foso college of education': 'FOSCO',
  'our lady of apostles college of education': 'OLACOE',
  'ola college of education': 'OLACOE',
  'abetifi presbyterian college of education': 'ABETICOE',
  'abetifi college of education': 'ABETICOE',
  'accra college of education': 'ATRACO',
  'ada college of education': 'ADACO',
  'agona sda college of education': 'ASDACE',
  'akatsi college of education': 'AKATSICO',
  'bagabaga college of education': 'BACE',
  'berekum college of education': 'BETCO',
  'bia lamplighter college of education': 'BLCE',
  'dambai college of education': 'DACE',
  'enchi college of education': 'ENCHICO',
  'evangelical presbyterian college of education, amedzofe': 'AMECO',
  'evangelical presbyterian college of education, bimbilla': 'BIMBICO',
  'gambaga college of education': 'GACOE',
  'holy child college of education': 'HOLICO',
  'jasikan college of education': 'JASICO',
  'kibi presbyterian college of education': 'KITCO',
  'komenda college of education': 'KOMENCO',
  'methodist college of education': 'MECO',
  'mount mary college of education': 'MOMACO',
  'nusrat jahan ahmadiyya college of education': 'NJA',
  'offinso college of education': 'OFFICOE',
  'peki college of education': 'GOVCO',
  'presbyterian college of education, akropong': 'AKROPONG PRES',
  'st. ambrose college of education': 'SACE',
  'saint ambrose college of education': 'SACE',
  'st. francis college of education': 'FRANCO',
  'saint francis college of education': 'FRANCO',
  "st. john bosco's college of education": 'BOSCO',
  "saint john bosco's college of education": 'BOSCO',
  "john bosco's college of education": 'BOSCO',
  "st john bosco's college of education": 'BOSCO',
  "st. joseph's college of education": 'JOSCO',
  "saint joseph's college of education": 'JOSCO',
  "st. louis college of education": 'STLOCO',
  "saint louis college of education": 'STLOCO',
  "st. monica's college of education": 'MONICA',
  "st. teresa's college of education": 'TERESCO',
  "saint teresa's college of education": 'TERESCO',
  "st. vincent college of education": 'SVCE',
  "saint vincent college of education": 'SVCE',
  'tamale college of education': 'TACE',
  'tumu college of education': 'TUTCO',
  'wesley college of education': 'WESCO',
  'wiawso college of education': 'WATICO',
  'presbyterian women\'s college of education': 'PWESCE',
  'agogo presbyterian women\'s college of education': 'AGOGOPWCE',
};

/**
 * Return the campus short name for a user's institution, or null if unknown.
 * Returns null (not a guess) so callers can show "College Community" gracefully.
 */
const resolveCollegeShortName = (user) => {
  const raw = String(user?.institution || user?.affiliate_university || '').trim();
  if (!raw) return null;

  const key = raw.toLowerCase();

  // 1. Exact match
  if (GH_INSTITUTION_NAMES[key]) return GH_INSTITUTION_NAMES[key];

  // 2. Starts-with match (handles "Foso College of Education, Kumasi" etc.)
  for (const [pattern, short] of Object.entries(GH_INSTITUTION_NAMES)) {
    if (key.startsWith(pattern) || pattern.startsWith(key)) return short;
  }

  // 3. Contains match for short lookups (e.g. stored as "KNUST")
  for (const [pattern, short] of Object.entries(GH_INSTITUTION_NAMES)) {
    if (key.includes(pattern)) return short;
  }

  // 4. If the stored value is already short (≤ 10 chars), use it as-is
  if (raw.length <= 10) return raw;

  return null;
};

export default function CommunityForumPicker({ onClose, variant = 'default' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const shortName = resolveCollegeShortName(user);
  const collegePath = `/forum?type=college${user?.institution_id ? `&college=${user.institution_id}` : ''}`;

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

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
        Community Forum
        {isMenu && <span className="cfp-chevron" aria-hidden>{open ? '▴' : '▾'}</span>}
      </button>

      {open && (
        <div className={['cfp-popup', isFooter && 'cfp-popup--above'].filter(Boolean).join(' ')} role="menu">
          <button
            className="cfp-option"
            onClick={() => handleSelect(collegePath)}
            type="button"
            role="menuitem"
          >
            <span className="cfp-option-icon cfp-option-icon--college"><FiUsers /></span>
            <span className="cfp-option-body">
              <strong>{shortName ? `${shortName} Community` : 'College Community'}</strong>
              <span>Announcements &amp; chats for your college</span>
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
              <strong>Global Community</strong>
              <span>All Sharether users</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
