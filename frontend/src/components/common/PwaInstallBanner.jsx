import { useEffect, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import {
  getPwaDeferredPrompt,
  isPwaStandalone,
  promptPwaInstall,
  subscribePwaInstall,
} from '../../utils/pwaInstall';
import './PwaInstallBanner.css';

const DISMISS_KEY = 'sharether_pwa_install_banner_dismissed';

export default function PwaInstallBanner() {
  const [, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    return subscribePwaInstall(() => setTick((t) => t + 1));
  }, []);

  const visible =
    !dismissed && !isPwaStandalone() && Boolean(getPwaDeferredPrompt());

  const handleInstall = async () => {
    await promptPwaInstall();
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // no-op
    }
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install web app">
      <div className="pwa-install-banner__inner">
        <span className="pwa-install-banner__icon" aria-hidden>
          <FiDownload />
        </span>
        <div className="pwa-install-banner__text">
          <strong>Install Sharether</strong>
          <span>Add the web app to your home screen for quicker access.</span>
        </div>
        <button type="button" className="pwa-install-banner__install" onClick={handleInstall}>
          Install web app
        </button>
        <button
          type="button"
          className="pwa-install-banner__close"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
        >
          <FiX />
        </button>
      </div>
    </div>
  );
}
