import { startTransition, useEffect } from 'react';
import useHeaderSheen from '../../hooks/useHeaderSheen';
import { useAnalyticsWithContext } from '../../hooks/useAnalytics';
import { playUiSound } from '../../utils/uiSounds';
import { useUser } from './UserContext';
import AboutTab from './AboutTab';
import CGPATrackerTab from './CGPATrackerTab';
import NotesTab from './NotesTab';
import SurvivalGuideTab from './SurvivalGuideTab';
import VideosTab from './VideosTab';
import '../learn/Learn.css';
import './Eduvhibe.css';

const EDUVHIBE_TABS = [
  { key: 'notes', label: 'Notes', title: 'Course notes, past questions, and PDFs for every level.' },
  { key: 'videos', label: 'Videos', title: 'Short explanations and guided walkthroughs that save time.' },
  { key: 'guides', label: 'Guides', title: 'Useful reads for studying, staying organized, and handling campus life.' },
  { key: 'cgpa', label: 'CGPA', title: 'Track semester performance without leaving your Sharether routine.' },
  { key: 'about', label: 'About', title: 'See the story, community voice, and thinking behind the page.' }
];

export default function EduvhibeShell() {
  const { activeTab, setActiveTab } = useUser();
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();
  const { trackEvent } = useAnalyticsWithContext();

  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArriveEduvhibe'), 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    trackEvent('eduvhibe_page_viewed', { initial_tab: activeTab });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigation = (tabName) => {
    if (tabName === activeTab) return;
    trackEvent('eduvhibe_tab_viewed', { tab: tabName });

    startTransition(() => {
      setActiveTab(tabName);
    });

    if (typeof window !== 'undefined' && window.scrollY > 120) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const activeTabMeta = EDUVHIBE_TABS.find((tab) => tab.key === activeTab) || EDUVHIBE_TABS[0];

  return (
    <div className={`learn-redesign eduvhibe-page ${headerSheenReady ? 'page-header-sheen-ready' : ''}`}>
      <section className="learn-shell-header">
        <div className="learn-shell-header-copy">
          <h1 className="header-sheen-copy" key={`eduvhibe-header-title-${headerSheenCycle}`}>Eduvhibe</h1>
          <p className="header-sheen-copy" key={`eduvhibe-header-tagline-${headerSheenCycle}`}>
            A focused corner for notes, guides, videos, and CGPA
          </p>
        </div>
      </section>

      <section className="learn-search-panel eduvhibe-tab-switch-panel" aria-label="Choose Eduvhibe workspace">
        <div className="learn-mode-switch eduvhibe-mode-switch" role="tablist" aria-label="Choose Eduvhibe workspace">
          {EDUVHIBE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`learn-mode-switch-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleNavigation(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="eduvhibe-active-tab-summary">{activeTabMeta.title}</p>
      </section>

      <div className="learn-row-divider" aria-hidden="true" />

      <main className="eduvhibe-main" aria-label={activeTabMeta.title}>
        {activeTab === 'notes' ? (
          <section className="eduvhibe-tab-panel is-visible">
            <NotesTab />
          </section>
        ) : null}
        {activeTab === 'videos' ? (
          <section className="eduvhibe-tab-panel is-visible">
            <VideosTab />
          </section>
        ) : null}
        {activeTab === 'guides' ? (
          <section className="eduvhibe-tab-panel is-visible">
            <SurvivalGuideTab />
          </section>
        ) : null}
        {activeTab === 'cgpa' ? (
          <section className="eduvhibe-tab-panel is-visible">
            <CGPATrackerTab />
          </section>
        ) : null}
        {activeTab === 'about' ? (
          <section className="eduvhibe-tab-panel is-visible">
            <AboutTab />
          </section>
        ) : null}
      </main>
    </div>
  );
}
