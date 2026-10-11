import { useEffect, useState } from 'react';
import { FaApple } from 'react-icons/fa6';
import { MdAndroid, MdAppShortcut } from 'react-icons/md';
import FormModal from '../components/common/FormModal';
import PageHeader from '../components/common/PageHeader';
import {
  getManualInstallInstructions,
  getPwaDeferredPrompt,
  isPwaStandalone,
  promptPwaInstall,
  subscribePwaInstall,
} from '../utils/pwaInstall';
import './SharedPages.css';

const APP_LINKS = {
  android: import.meta.env.VITE_ANDROID_APP_URL || '',
  ios: import.meta.env.VITE_IOS_APP_URL || '',
};

const PWA_BENEFITS = [
  'Installs in seconds, no app store needed.',
  'Opens from your home screen in one tap.',
  'Same account and plan as the website.',
];

const ANDROID_BENEFITS = [
  'Install and update through Google Play.',
  'Richer notifications as we add them.',
  'Easy to reinstall on a new phone.',
];

const IOS_BENEFITS = [
  'Install from the App Store.',
  'Tuned for iPhone and iPad screens.',
  'Works with Family Sharing.',
];

export default function Download() {
  const [pwaStatus, setPwaStatus] = useState(() => (isPwaStandalone() ? 'installed' : 'idle'));
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installHelpContent, setInstallHelpContent] = useState(() => getManualInstallInstructions());
  const hasAndroid = Boolean(APP_LINKS.android);
  const hasIos = Boolean(APP_LINKS.ios);

  useEffect(() => {
    return subscribePwaInstall(() => {
      if (isPwaStandalone()) {
        setPwaStatus('installed');
        return;
      }
      if (getPwaDeferredPrompt()) {
        setPwaStatus('ready');
        return;
      }
      setPwaStatus((prev) => (prev === 'installed' ? 'installed' : 'idle'));
    });
  }, []);

  const openInstallHelp = () => {
    setInstallHelpContent(getManualInstallInstructions());
    setInstallHelpOpen(true);
  };

  const installPwa = async () => {
    if (isPwaStandalone()) return;

    const deferred = getPwaDeferredPrompt();
    if (deferred) {
      try {
        const choice = await promptPwaInstall();
        if (choice?.outcome === 'accepted') {
          setPwaStatus('installed');
          setInstallHelpOpen(false);
          return;
        }
      } catch {
        // Some WebViews reject prompt(); fall through to manual help.
      }
      setPwaStatus('manual');
      openInstallHelp();
      return;
    }

    setPwaStatus('manual');
    openInstallHelp();
  };

  return (
    <div className="page-shell footer-page download-page">
      <PageHeader icon="download" title="Get the app" description="The web app is ready today. Play Store and App Store are coming." />
      <section className="page-section download-page__content">

        <div className="download-install-grid">
          <article className="download-option download-option--pwa">
            <div className="download-option__header">
              <span className="download-option__icon download-option__icon--pwa" aria-hidden>
                <MdAppShortcut />
              </span>
              <div className="download-option__headlines">
                <h2 className="download-option__title">Web app (PWA)</h2>
                <p className="download-option__tagline">Best for fastest setup on phone or desktop</p>
              </div>
            </div>
            <button className="btn btn-primary download-option__cta" type="button" onClick={installPwa} disabled={pwaStatus === 'installed'}>
              {pwaStatus === 'installed' ? 'Web app installed' : 'Install web app'}
            </button>
            <ul className="download-option__benefits">
              {PWA_BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>

          <article className={`download-option download-option--android ${hasAndroid ? '' : 'download-option--soon'}`}>
            <div className="download-option__header">
              <span className="download-option__icon download-option__icon--android" aria-hidden>
                <MdAndroid />
              </span>
              <div className="download-option__headlines">
                <h2 className="download-option__title">Android app</h2>
                <p className="download-option__tagline">Google Play install when available</p>
              </div>
            </div>
            {hasAndroid ? (
              <a className="btn btn-secondary download-option__cta" href={APP_LINKS.android} target="_blank" rel="noreferrer">
                Download on Google Play
              </a>
            ) : (
              <button className="btn btn-secondary download-option__cta" type="button" disabled>
                Coming soon to Play Store
              </button>
            )}
            <ul className="download-option__benefits">
              {ANDROID_BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>

          <article className={`download-option download-option--ios ${hasIos ? '' : 'download-option--soon'}`}>
            <div className="download-option__header">
              <span className="download-option__icon download-option__icon--ios" aria-hidden>
                <FaApple />
              </span>
              <div className="download-option__headlines">
                <h2 className="download-option__title">iOS app</h2>
                <p className="download-option__tagline">App Store install when available</p>
              </div>
            </div>
            {hasIos ? (
              <a className="btn btn-secondary download-option__cta" href={APP_LINKS.ios} target="_blank" rel="noreferrer">
                Download on the App Store
              </a>
            ) : (
              <button className="btn btn-secondary download-option__cta" type="button" disabled>
                Coming soon to App Store
              </button>
            )}
            <ul className="download-option__benefits">
              {IOS_BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        </div>

        <div className="download-page__tips">
          {pwaStatus === 'manual' && !installHelpOpen ? (
            <p className="hero-subtitle">
              If the install sheet closed, tap <strong>Install web app</strong> again for step-by-step help—or use your
              browser menu: <strong>Install app</strong> / <strong>Add to Home Screen</strong>.
            </p>
          ) : null}
          {pwaStatus === 'idle' ? (
            <p className="hero-subtitle download-page__tip-muted">
              On phones, <strong>Install web app</strong> opens instructions—iOS uses Add to Home Screen; Android often
              uses the ⋮ menu. On desktop, Chrome may show an install icon after you use the site briefly.
            </p>
          ) : null}
        </div>
      </section>

      <FormModal
        isOpen={installHelpOpen}
        onClose={() => setInstallHelpOpen(false)}
        title={installHelpContent.title}
        subtitle="Follow these steps when the browser does not show its own install popup."
        size="lg"
        modalClassName="download-pwa-install-modal"
      >
        <ol className="pwa-manual-install__steps">
          {installHelpContent.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="pwa-manual-install__footer">
          You can keep using Learnda in the browser—installing is optional and only adds a shortcut.
        </p>
      </FormModal>
    </div>
  );
}
