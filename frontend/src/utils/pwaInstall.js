/**
 * Single place for PWA install (beforeinstallprompt) so Layout, Download, etc. stay in sync.
 */

let deferredPrompt = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // no-op
    }
  });
};

export const isPwaStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    window.navigator?.standalone === true);

/**
 * @returns {{ platform: 'ios' | 'android' | 'desktop', isInAppBrowser: boolean }}
 */
export const getPwaInstallContext = () => {
  if (typeof navigator === 'undefined') {
    return { platform: 'desktop', isInAppBrowser: false };
  }
  const ua = String(navigator.userAgent || '');
  const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat/i.test(ua);
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  let platform = 'desktop';
  if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  return { platform, isInAppBrowser };
};

/**
 * Human-readable steps when the browser does not expose install prompt() (e.g. all iOS browsers).
 * @returns {{ title: string, steps: string[] }}
 */
export const getManualInstallInstructions = () => {
  const { platform, isInAppBrowser } = getPwaInstallContext();

  if (isInAppBrowser) {
    return {
      title: 'Open in Safari or Chrome first',
      steps: [
        'Links opened inside Instagram, TikTok, Facebook, and similar apps usually cannot install a web app.',
        'Use the app’s menu and choose Open in Safari or Open in Chrome (or copy the link and paste it into Safari). Then return to this page and tap Install web app again.',
      ],
    };
  }

  if (platform === 'ios') {
    return {
      title: 'Add Learnda to your Home Screen (iPhone / iPad)',
      steps: [
        'Tap the Share button (square with an arrow pointing up) in the toolbar.',
        'Scroll down and tap Add to Home Screen.',
        'Tap Add in the top-right. You’ll get a Learnda icon on your home screen that opens like an app.',
      ],
    };
  }

  if (platform === 'android') {
    return {
      title: 'Install Learnda on Android',
      steps: [
        'Tap the three-dot menu (⋮) in the top-right.',
        'Tap Install app or Add to Home screen, then confirm.',
        'If you don’t see that option yet, browse for a minute and try again—Chrome sometimes shows it after a short visit.',
      ],
    };
  }

  return {
    title: 'Install from your computer',
    steps: [
      'Chrome or Edge: look for an install icon in the address bar, or open the menu (⋮) and choose Install Learnda.',
      'Safari on Mac: use File → Add to Dock when the site supports it.',
      'Firefox: use the address-bar or menu install option when offered.',
    ],
  };
};

export const getPwaDeferredPrompt = () => deferredPrompt;

export const subscribePwaInstall = (fn) => {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
};

/**
 * Call once at app startup. Must preventDefault on beforeinstallprompt or Chrome will not allow prompt().
 */
export const initLearndaPwa = () => {
  if (typeof window === 'undefined' || window.__learndaPwaListeners) return;
  window.__learndaPwaListeners = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
};

/**
 * @returns {Promise<{ outcome: string }|null>}
 */
export const promptPwaInstall = async () => {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice;
};
