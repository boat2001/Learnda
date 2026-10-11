import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText, FiList, FiMapPin, FiClipboard,
  FiUsers, FiBookOpen, FiEdit, FiFilter, FiZap, FiRefreshCw,
  FiSmartphone, FiFolder, FiPlay, FiCheckSquare, FiTv, FiLayers,
  FiMessageSquare, FiDollarSign, FiAward, FiFlag,
  FiDownload, FiCpu, FiVideo, FiBriefcase, FiActivity, FiTarget, FiUserPlus,
  FiSliders, FiShield, FiStar,
  FiGlobe, FiNavigation, FiCompass, FiTrendingUp, FiLink,
  FiShare2,
} from 'react-icons/fi';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
import './SharedPages.css';
import './Roadmap.css';

/*
  SVG viewBox: 0 0 1200 500  (preserveAspectRatio="none")
  CSS % → SVG: left% × 12 = svgX,  top% × 5 = svgY
  Phase dots: v1(156,360)  v2(384,285)  v3(612,210)  v4(840,145)  v5(1044,100)
  DONE  portion: start → v3 Platform (current phase)
  FUTURE portion: v3 → end  (dashed)
*/
const DONE_CURVE =
  'M 40 356 C 80 354, 118 357, 156 360 C 220 315, 350 268, 384 285 C 440 255, 560 185, 612 210';

const FUTURE_CURVE =
  'M 612 210 C 650 200, 775 125, 840 145 C 880 140, 990 85, 1044 100 C 1090 105, 1130 90, 1160 86';

const FULL_GLOW_PATH =
  'M 40 356 C 80 354, 118 357, 156 360 C 220 315, 350 268, 384 285 C 440 255, 560 185, 612 210 C 650 200, 775 125, 840 145 C 880 140, 990 85, 1044 100 C 1090 105, 1130 90, 1160 86';

// Learnda's roadmap. The previous phases traced the forked platform's history
// through a single college of education, UCC-affiliated colleges and COEs,
// with "Lecturers onboard" and "Institutions onboard" milestones -- none of
// which apply to a K-12 product (dev guide §1.2, §10).
const PHASES = [
  {
    id: 'v1',
    label: 'Foundation',
    version: 'v1.0',
    years: '2026',
    color: '#3e7fdd',
    cx: 13,
    cy: 72,
    canvasItems: [
      { icon: FiList,      text: 'KG to SHS class structure' },
      { icon: FiClipboard, text: 'NaCCA-aligned subjects' },
      { icon: FiFileText,  text: 'Class-scoped lessons' },
      { icon: FiCompass,   text: 'Academic year progression' },
    ],
    mobileItems: [
      { icon: FiList,      text: 'KG to SHS class structure' },
      { icon: FiClipboard, text: 'NaCCA-aligned subjects' },
      { icon: FiFileText,  text: 'Class-scoped lessons' },
      { icon: FiCompass,   text: 'Academic year progression' },
    ],
  },
  {
    id: 'v2',
    label: 'Learning',
    version: 'v2.0',
    years: '2026 – 2027',
    color: '#73a24b',
    cx: 32,
    cy: 55,
    canvasItems: [
      { icon: FiFileText,  text: 'Audio-first KG lessons' },
      { icon: FiCpu,       text: 'Animated explainers' },
      { icon: FiClipboard, text: 'Practice sets per class' },
      { icon: FiList,      text: 'BECE preparation' },
      { icon: FiGlobe,     text: 'Offline access' },
    ],
    mobileItems: [
      { icon: FiFileText,  text: 'Audio-first KG lessons' },
      { icon: FiCpu,       text: 'Animated explainers' },
      { icon: FiClipboard, text: 'Practice sets per class' },
      { icon: FiList,      text: 'BECE preparation' },
      { icon: FiGlobe,     text: 'Offline access' },
    ],
  },
  {
    id: 'v3',
    label: 'Platform',
    version: 'v3.0',
    years: '2027 – 2028',
    color: '#fab82c',
    cx: 51,
    cy: 40,
    canvasItems: [
      { icon: FiCompass,   text: 'SHS pathways and electives' },
      { icon: FiClipboard, text: 'WASSCE preparation' },
      { icon: FiList,      text: 'My Space' },
      { icon: FiUserPlus,  text: 'Parent accounts' },
      { icon: FiTrendingUp, text: 'Progress reports' },
    ],
    mobileItems: [
      { icon: FiCompass,   text: 'SHS pathways and electives' },
      { icon: FiClipboard, text: 'WASSCE preparation' },
      { icon: FiList,      text: 'My Space' },
      { icon: FiUserPlus,  text: 'Parent accounts' },
      { icon: FiTrendingUp, text: 'Progress reports' },
    ],
  },
  {
    id: 'v4',
    label: 'Ecosystem',
    version: 'v4.0',
    years: '2028 – 2029',
    color: '#fb6334',
    cx: 70,
    cy: 30,
    future: true,
    canvasItems: [
      { icon: FiBriefcase, text: 'Schools onboard' },
      { icon: FiUserPlus,  text: 'Teacher content tools' },
      { icon: FiGlobe,     text: 'Ghanaian language lessons' },
      { icon: FiUsers,     text: 'Live sessions' },
      { icon: FiCpu,       text: 'AI study help' },
    ],
    mobileItems: [
      { icon: FiBriefcase, text: 'Schools onboard' },
      { icon: FiUserPlus,  text: 'Teacher content tools' },
      { icon: FiGlobe,     text: 'Ghanaian language lessons' },
      { icon: FiUsers,     text: 'Live sessions' },
      { icon: FiCpu,       text: 'AI study help' },
    ],
  },
  {
    id: 'v5',
    label: 'Expansion',
    version: 'v5.0',
    years: '2029 – 2032',
    color: '#1f3049',
    cx: 87,
    cy: 20,
    future: true,
    canvasItems: [
      { icon: FiGlobe,      text: 'Beyond Ghana' },
      { icon: FiNavigation, text: 'Anglophone Africa' },
      { icon: FiCompass,    text: 'Francophone Africa' },
      { icon: FiLink,       text: 'Curriculum partnerships' },
      { icon: FiTrendingUp, text: 'Continent-wide platform' },
    ],
    mobileItems: [
      { icon: FiGlobe,      text: 'Beyond Ghana' },
      { icon: FiNavigation, text: 'Anglophone Africa' },
      { icon: FiCompass,    text: 'Francophone Africa' },
      { icon: FiLink,       text: 'Curriculum partnerships' },
      { icon: FiTrendingUp, text: 'Continent-wide platform' },
    ],
  },
];

const PHASE_ICONS = {
  v1:        [FiFileText, FiList, FiClipboard, FiMapPin],
  v2:        [FiUsers, FiBookOpen, FiEdit, FiFilter, FiZap, FiRefreshCw, FiDollarSign],
  platform:  [FiSmartphone, FiFolder, FiPlay, FiCheckSquare, FiUsers, FiTv, FiLayers, FiMessageSquare, FiDollarSign, FiAward, FiUsers],
  ecosystem: [FiDownload, FiCpu, FiVideo, FiBriefcase, FiActivity, FiTarget, FiSliders, FiUserPlus, FiShield, FiStar, FiFlag],
  expansion: [FiGlobe, FiNavigation, FiCompass, FiLink, FiLink, FiBriefcase, FiCpu, FiTrendingUp],
};

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://learnda.app';
const ROADMAP_SVG = '/learnda-roadmap.svg';
const FILENAME    = 'learnda-platform-roadmap.png';

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function svgToPngBlob(svgUrl, scale = 2) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = svgUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

export default function Roadmap() {
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState(false);
  const [apiPhases, setApiPhases] = useState(null);

  useEffect(() => {
    api.admin.getRoadmapPublic()
      .then((data) => { if (data?.phases) setApiPhases(data.phases); })
      .catch(() => {});
  }, []);

  const phases = useMemo(() => {
    if (!apiPhases) return PHASES;
    return PHASES.map((phase) => {
      const apiPhase = apiPhases.find((p) => p.id === phase.id);
      if (!apiPhase) return phase;
      const icons = PHASE_ICONS[phase.id] || [FiZap];
      const items = (apiPhase.items?.length ? apiPhase.items : phase.canvasItems.map((i) => i.text))
        .map((text, i) => ({ icon: icons[i % icons.length], text }));
      return {
        ...phase,
        label: apiPhase.label ?? phase.label,
        version: apiPhase.version ?? phase.version,
        years: apiPhase.years ?? phase.years,
        canvasItems: items,
        mobileItems: items,
      };
    });
  }, [apiPhases]);

  const handleShare = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const blob = await svgToPngBlob(ROADMAP_SVG);
      const file = new File([blob], FILENAME, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Learnda Platform Roadmap',
          text: "The 10-year roadmap for Learnda — building the learning infrastructure Africa's students deserve.",
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Learnda Platform Roadmap',
          text: "The 10-year roadmap for Learnda — building the learning infrastructure Africa's students deserve.",
          url: `${SITE_URL}/roadmap`,
        });
      } else {
        triggerDownload(URL.createObjectURL(blob), FILENAME);
      }
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader icon="roadmap" title="Roadmap" description="Where Learnda is headed, from KG–SHS in Ghana to the rest of Africa.">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => navigate('/feature-requests')}
        >
          Suggest a feature
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => navigate('/blog')}
        >
          Read blog
        </button>
      </PageHeader>

      <section className="page-section">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="journey" /><span className="section-heading__title">The Learnda journey</span></h2>
          <p>
            Five versions, five phases, each with its own milestone, team, and set of students it was built to serve.
          </p>
        </div>

        {/* Outer container — position:relative so the action buttons anchor to it */}
        <div className="rm-viz-container">

        {/* Snapshot wrapper — only this div is captured */}
        <div className="rm-snapshot">

        {/* Desktop canvas — aria-hidden; mobile timeline provides accessible content */}
        <div className="rm-canvas" aria-hidden="true">
          {/* Brand watermark — top-left */}
          <div className="rm-brand-mark">
            <img src="/learnda-logo.webp" alt="" className="rm-brand-mark__logo" />
            <div className="rm-brand-mark__text">
              <span className="rm-brand-mark__name">Learnda</span>
              <span className="rm-brand-mark__tagline">Learn Like Never Before</span>
            </div>
          </div>
          {/* 10 Year Vision label — bottom-center */}
          <div className="rm-vision-label">10 Year Vision</div>
          <svg
            className="rm-canvas__svg"
            viewBox="0 0 1200 500"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="rm-curve-grad"
                x1="60" y1="380"
                x2="612" y2="210"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%"   stopColor="#26c9d0" stopOpacity="0.9" />
                <stop offset="50%"  stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {/* Glow over full path */}
            <path
              className="rm-glow-path"
              d={FULL_GLOW_PATH}
              fill="none"
              strokeWidth="28"
              strokeLinecap="round"
            />
            {/* Done portion — solid gradient */}
            <path
              d={DONE_CURVE}
              fill="none"
              stroke="url(#rm-curve-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Future portion — dashed */}
            <path
              className="rm-future-path"
              d={FUTURE_CURVE}
              fill="none"
              stroke="rgba(100, 116, 139, 0.55)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="7 5"
            />
          </svg>

          {/* Labels above each dot */}
          {phases.map((phase) => (
            <div
              key={`above-${phase.id}`}
              className={`rm-above-group${phase.future ? ' rm-above-group--future' : ''}`}
              style={{ left: `${phase.cx}%`, top: `${phase.cy}%`, '--rm-color': phase.color }}
            >
              <div className="rm-phase-label">
                <span className="rm-phase-label__version">{phase.version}</span>
                <span className="rm-phase-label__name">{phase.label}</span>
                {phase.current && <span className="rm-phase-label__now">Now</span>}
                <span className="rm-phase-label__years">{phase.years}</span>
              </div>
            </div>
          ))}

          {/* Phase dots on the curve */}
          {phases.map((phase) => (
            <div
              key={`dot-${phase.id}`}
              className={`rm-phase-dot${phase.current ? ' rm-phase-dot--current' : ''}${phase.future ? ' rm-phase-dot--future' : ''}`}
              style={{ left: `${phase.cx}%`, top: `${phase.cy}%`, '--rm-color': phase.color }}
            />
          ))}

          {/* Item columns below each dot */}
          {phases.map((phase) => (
            <div
              key={`below-${phase.id}`}
              className={`rm-below-group${phase.future ? ' rm-below-group--future' : ''}`}
              style={{ left: `${phase.cx}%`, top: `${phase.cy}%`, '--rm-color': phase.color }}
            >
              {phase.canvasItems.map((item) => (
                <div key={item.text} className="rm-item-row">
                  <item.icon className="rm-item-icon" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile fallback — shown below 900 px */}
        <div className="rm-mobile-timeline">
          {/* Mobile header card */}
          <div className="rm-mobile-header">
            <div className="rm-mobile-header__brand">
              <img src="/learnda-logo.webp" alt="" className="rm-mobile-header__logo" />
              <div>
                <span className="rm-mobile-header__name">Learnda</span>
                <span className="rm-mobile-header__tagline">Learn Like Never Before</span>
              </div>
            </div>
            <span className="rm-mobile-header__badge">10 Year Vision</span>
          </div>
          {phases.map((phase) => (
            <div
              key={phase.id}
              className={`rm-phase-block${phase.future ? ' rm-phase-block--future' : ''}`}
              style={{ '--rm-color': phase.color }}
            >
              <div className="rm-phase-block__header">
                <span className="rm-phase-block__version">{phase.version}</span>
                <div className="rm-phase-block__name-row">
                  <span className="rm-phase-block__name">{phase.label}</span>
                  {phase.current && <span className="rm-phase-block__now">Now</span>}
                  <span className="rm-phase-block__years">{phase.years}</span>
                </div>
              </div>
              <div className="rm-phase-block__items">
                {phase.mobileItems.map((item) => (
                  <span key={item.text} className="rm-phase-block__item">
                    <item.icon />
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        </div>{/* end rm-snapshot */}

        {/* Action button — outside snapshot so it doesn't appear in the captured image */}
        {!capturing && (
          <div className="rm-actions">
            <button
              className="rm-action-btn rm-action-btn--share"
              type="button"
              onClick={handleShare}
            >
              <FiShare2 />
              Share roadmap
            </button>
          </div>
        )}

        </div>{/* end rm-viz-container */}

        <p>
          Hey, that's our secret. Don't tell anyone. 😊
        </p>
      </section>

      <section className="page-section rm-cards">
        <div className="info-card">
          <h3>Contribute funds to support the vision</h3>
          <p>
            Every contribution helps us build the learning infrastructure Africa's students deserve.
            No amount is too small — your support keeps this mission alive.
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/contribute')}
          >
            Contribute funds
          </button>
        </div>
        <div className="info-card">
          <h3>Join the revolution</h3>
          <p>
            Contribute your skills, spread the word, or become part of the team building this
            platform. The movement needs people like you.
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/contribute')}
          >
            Get involved
          </button>
        </div>
        <div className="info-card">
          <h3>Shape what comes next</h3>
          <p>
            Have an idea that would reduce friction in your study routine? Suggest it directly to
            the team.
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/feature-requests')}
          >
            Suggest a feature
          </button>
        </div>
      </section>
    </div>
  );
}
