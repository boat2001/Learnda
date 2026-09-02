/**
 * Short UI feedback tones (Web Audio API). No external assets.
 * Respects prefers-reduced-motion and optional user mute (localStorage + saved preferences).
 */

const STORAGE_KEY = 'learnda_ui_sounds_enabled';

let audioContext = null;

export function getUiSoundsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    /* ignore */
  }
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  return true;
}

export function setUiSoundsEnabledLocal(on) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
}

/** Call when preferences load or save so guests and logged-in users stay in sync. */
export function syncUiSoundsFromPreference(uiSounds) {
  if (typeof uiSounds !== 'boolean') return;
  setUiSoundsEnabledLocal(uiSounds);
}

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioContext) audioContext = new AC();
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/** Prime AudioContext after a user gesture (pointerdown). */
export function resumeUiAudioContext() {
  const ac = getCtx();
  if (ac && ac.state === 'suspended') void ac.resume();
}

// Bell-style chime: gentle attack → sustain → slow ring-out. Used for welcome/arrival tones.
function scheduleSoftChime(ac, dest, freq, t0, duration, vol) {
  const osc = ac.createOscillator(); const g = ac.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.026);
  g.gain.setValueAtTime(vol * 0.5, t0 + 0.085);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g); g.connect(dest);
  osc.start(t0); osc.stop(t0 + duration + 0.1);
}

function scheduleTone(ac, dest, freq, t0, duration, peakGain, type = 'sine', freqEnd = null) {
  const osc = ac.createOscillator();
  const gn = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null && Number.isFinite(freqEnd) && Math.abs(freqEnd - freq) > 0.5) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + duration);
  }
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), t0 + 0.018);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gn);
  gn.connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const VOLUME_SCALE = 5.5;

function playThroughMaster(ac, volume, fn) {
  const master = ac.createGain();
  master.gain.value = volume * VOLUME_SCALE;
  master.connect(ac.destination);
  const now = ac.currentTime + 0.008;
  try {
    fn(ac, master, now);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} kind
 * @see SOUND_IDS exported for tooling / tests
 */
export function playUiSound(kind) {
  if (!getUiSoundsEnabled()) return;
  const ac = getCtx();
  if (!ac) return;

  try {
    switch (kind) {
      case 'lessonSwipeForward':
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleTone(a, m, 520, t0, 0.1, 0.11, 'sine', 880);
          scheduleTone(a, m, 660, t0 + 0.04, 0.07, 0.06, 'triangle');
        });
        break;
      case 'lessonSwipeBack':
        playThroughMaster(ac, 0.2, (a, m, t0) => {
          scheduleTone(a, m, 720, t0, 0.1, 0.1, 'triangle', 360);
        });
        break;
      case 'lessonComplete':
        playThroughMaster(ac, 0.24, (a, m, t0) => {
          scheduleTone(a, m, 392, t0, 0.14, 0.1, 'triangle');
          scheduleTone(a, m, 523.25, t0 + 0.1, 0.16, 0.12, 'triangle');
          scheduleTone(a, m, 659.25, t0 + 0.2, 0.18, 0.13, 'sine');
          scheduleTone(a, m, 783.99, t0 + 0.32, 0.22, 0.12, 'sine');
          scheduleTone(a, m, 987.77, t0 + 0.44, 0.26, 0.1, 'sine');
        });
        break;
      case 'courseComplete':
        playThroughMaster(ac, 0.28, (a, m, t0) => {
          scheduleTone(a, m, 130.81, t0, 0.35, 0.12, 'sine');
          scheduleTone(a, m, 164.81, t0 + 0.06, 0.32, 0.1, 'sine');
          scheduleTone(a, m, 196, t0 + 0.12, 0.34, 0.11, 'sine');
          scheduleTone(a, m, 392, t0 + 0.38, 0.2, 0.11, 'triangle');
          scheduleTone(a, m, 523.25, t0 + 0.48, 0.2, 0.12, 'triangle');
          scheduleTone(a, m, 659.25, t0 + 0.58, 0.24, 0.13, 'sine');
          scheduleTone(a, m, 783.99, t0 + 0.7, 0.28, 0.12, 'sine');
          scheduleTone(a, m, 1046.5, t0 + 0.82, 0.32, 0.1, 'sine');
        });
        break;
      case 'badgeUnlock':
        playThroughMaster(ac, 0.26, (a, m, t0) => {
          scheduleTone(a, m, 880, t0, 0.06, 0.09, 'sine');
          scheduleTone(a, m, 1174.66, t0 + 0.05, 0.06, 0.08, 'sine');
          scheduleTone(a, m, 1318.51, t0 + 0.1, 0.07, 0.08, 'triangle');
          scheduleTone(a, m, 1567.98, t0 + 0.15, 0.08, 0.07, 'sine');
          scheduleTone(a, m, 1975.53, t0 + 0.2, 0.1, 0.06, 'sine');
        });
        break;
      case 'levelUp':
        playThroughMaster(ac, 0.26, (a, m, t0) => {
          scheduleTone(a, m, 440, t0, 0.12, 0.1, 'triangle');
          scheduleTone(a, m, 554.37, t0 + 0.1, 0.14, 0.11, 'triangle');
          scheduleTone(a, m, 659.25, t0 + 0.2, 0.18, 0.12, 'sine');
          scheduleTone(a, m, 880, t0 + 0.32, 0.22, 0.1, 'sine');
        });
        break;
      case 'sectionOpen':
        playThroughMaster(ac, 0.16, (a, m, t0) => {
          scheduleTone(a, m, 400, t0, 0.07, 0.09, 'sine');
        });
        break;
      case 'sectionClose':
        playThroughMaster(ac, 0.14, (a, m, t0) => {
          scheduleTone(a, m, 300, t0, 0.08, 0.08, 'triangle');
        });
        break;
      case 'modalOpen':
        playThroughMaster(ac, 0.14, (a, m, t0) => {
          scheduleTone(a, m, 330, t0, 0.08, 0.07, 'sine', 520);
          scheduleTone(a, m, 587.33, t0 + 0.05, 0.1, 0.06, 'sine');
        });
        break;
      case 'modalClose':
        playThroughMaster(ac, 0.12, (a, m, t0) => {
          scheduleTone(a, m, 523.25, t0, 0.08, 0.06, 'sine', 349.23);
        });
        break;
      case 'fileDownload':
        playThroughMaster(ac, 0.2, (a, m, t0) => {
          scheduleTone(a, m, 659.25, t0, 0.08, 0.08, 'triangle');
          scheduleTone(a, m, 880, t0 + 0.09, 0.08, 0.08, 'triangle');
          scheduleTone(a, m, 1046.5, t0 + 0.18, 0.1, 0.07, 'sine');
        });
        break;
      case 'groupMessage':
        playThroughMaster(ac, 0.14, (a, m, t0) => {
          scheduleTone(a, m, 523.25, t0, 0.1, 0.08, 'sine');
          scheduleTone(a, m, 659.25, t0 + 0.08, 0.12, 0.07, 'sine');
        });
        break;
      case 'communityMessage':
        playThroughMaster(ac, 0.13, (a, m, t0) => {
          scheduleTone(a, m, 392, t0, 0.11, 0.08, 'sine');
          scheduleTone(a, m, 493.88, t0 + 0.07, 0.13, 0.07, 'sine');
        });
        break;
      case 'messageSent':
        playThroughMaster(ac, 0.15, (a, m, t0) => {
          scheduleTone(a, m, 440, t0, 0.06, 0.09, 'sine', 660);
          scheduleTone(a, m, 880, t0 + 0.05, 0.08, 0.06, 'sine');
        });
        break;
      case 'quizOptionSelect':
        playThroughMaster(ac, 0.18, (a, m, t0) => {
          scheduleTone(a, m, 620, t0, 0.045, 0.1, 'triangle');
          scheduleTone(a, m, 880, t0 + 0.028, 0.04, 0.07, 'sine');
        });
        break;

      // ── UI feedback ─────────────────────────────────────────────────────────
      case 'click':
        playThroughMaster(ac, 0.13, (a, m, t0) => {
          scheduleTone(a, m, 640, t0, 0.034, 0.09);
        });
        break;
      case 'nav':
        playThroughMaster(ac, 0.11, (a, m, t0) => {
          scheduleTone(a, m, 480, t0, 0.052, 0.07, 'sine', 600);
        });
        break;
      case 'toggleOn':
        playThroughMaster(ac, 0.18, (a, m, t0) => {
          scheduleTone(a, m, 329.63, t0, 0.048, 0.09);
          scheduleTone(a, m, 440,    t0 + 0.065, 0.058, 0.1);
        });
        break;
      case 'toggleOff':
        playThroughMaster(ac, 0.16, (a, m, t0) => {
          scheduleTone(a, m, 440,    t0, 0.048, 0.09);
          scheduleTone(a, m, 329.63, t0 + 0.065, 0.058, 0.08);
        });
        break;
      case 'tab':
        playThroughMaster(ac, 0.13, (a, m, t0) => {
          scheduleTone(a, m, 520, t0, 0.042, 0.08);
        });
        break;
      case 'formSubmit':
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleTone(a, m, 392,    t0,       0.10, 0.08, 'triangle');
          scheduleTone(a, m, 493.88, t0 + 0.09, 0.10, 0.09, 'triangle');
          scheduleTone(a, m, 587.33, t0 + 0.18, 0.14, 0.10, 'sine');
        });
        break;
      case 'success':
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleTone(a, m, 523.25, t0,       0.09, 0.09, 'triangle');
          scheduleTone(a, m, 659.25, t0 + 0.09, 0.10, 0.10, 'triangle');
          scheduleTone(a, m, 783.99, t0 + 0.19, 0.14, 0.11, 'sine');
        });
        break;
      case 'error':
        playThroughMaster(ac, 0.18, (a, m, t0) => {
          scheduleTone(a, m, 320, t0,       0.10, 0.09, 'triangle');
          scheduleTone(a, m, 240, t0 + 0.10, 0.12, 0.08, 'triangle');
        });
        break;

      // ── Welcome & page arrival tones ────────────────────────────────────────
      case 'welcomeGuest':
        // Ascending C-major: open, discovering — C5 → E5 → G5
        playThroughMaster(ac, 0.28, (a, m, t0) => {
          scheduleSoftChime(a, m, 523.25, t0,        0.90, 0.048);
          scheduleSoftChime(a, m, 659.25, t0 + 0.22, 0.95, 0.055);
          scheduleSoftChime(a, m, 783.99, t0 + 0.46, 1.10, 0.044);
        });
        break;
      case 'welcomeAuth':
        // G4 → D5 greeting + soft G-major chord settle — warm, "you're home"
        playThroughMaster(ac, 0.24, (a, m, t0) => {
          scheduleSoftChime(a, m, 392.00, t0,        1.00, 0.042);
          scheduleSoftChime(a, m, 587.33, t0 + 0.28, 1.05, 0.048);
          scheduleSoftChime(a, m, 392.00, t0 + 0.66, 1.60, 0.026);
          scheduleSoftChime(a, m, 493.88, t0 + 0.66, 1.60, 0.028);
          scheduleSoftChime(a, m, 587.33, t0 + 0.66, 1.60, 0.024);
        });
        break;
      case 'pageArriveLearn':
        // Focused, studious: G4 → C5 (perfect 4th — grounded, clear)
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleSoftChime(a, m, 392.00, t0,        0.70, 0.040);
          scheduleSoftChime(a, m, 523.25, t0 + 0.22, 0.85, 0.048);
        });
        break;
      case 'pageArrivePractice':
        // Determined: E4 → G4 → B4 (E-minor arpeggio — focused energy)
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleSoftChime(a, m, 329.63, t0,        0.50, 0.038);
          scheduleSoftChime(a, m, 392.00, t0 + 0.16, 0.55, 0.044);
          scheduleSoftChime(a, m, 493.88, t0 + 0.32, 0.70, 0.050);
        });
        break;
      case 'pageArrivePLS':
        // Warm, personal: D4 → A4 (open 5th — personal and spacious)
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleSoftChime(a, m, 293.66, t0,        0.85, 0.038);
          scheduleSoftChime(a, m, 440.00, t0 + 0.26, 0.95, 0.046);
        });
        break;
      case 'pageArriveResources':
        // Informative: F4 → C5 (5th — clear and reliable)
        playThroughMaster(ac, 0.20, (a, m, t0) => {
          scheduleSoftChime(a, m, 349.23, t0,        0.75, 0.036);
          scheduleSoftChime(a, m, 523.25, t0 + 0.24, 0.88, 0.044);
        });
        break;
      case 'pageArriveBlog':
        // Contemplative: C5 → G4 descending (4th down — thoughtful, reading mood)
        playThroughMaster(ac, 0.20, (a, m, t0) => {
          scheduleSoftChime(a, m, 523.25, t0,        0.80, 0.040);
          scheduleSoftChime(a, m, 392.00, t0 + 0.28, 0.95, 0.042);
        });
        break;
      case 'pageArriveSettings':
        // Clean, neutral: single soft C5 chime
        playThroughMaster(ac, 0.18, (a, m, t0) => {
          scheduleSoftChime(a, m, 523.25, t0, 0.85, 0.038);
        });
        break;
      case 'pageArriveEduvhibe':
        // Creative, curious: F4 → A4 → C5 (F-major — warm and creative)
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleSoftChime(a, m, 349.23, t0,        0.55, 0.038);
          scheduleSoftChime(a, m, 440.00, t0 + 0.18, 0.60, 0.044);
          scheduleSoftChime(a, m, 523.25, t0 + 0.36, 0.80, 0.050);
        });
        break;
      case 'pageArriveEdutainment':
        // Playful, bright: C5 → E5 → G5 → C6 (C-major arpeggio — fun and upbeat)
        playThroughMaster(ac, 0.22, (a, m, t0) => {
          scheduleSoftChime(a, m, 523.25,  t0,        0.45, 0.040);
          scheduleSoftChime(a, m, 659.25,  t0 + 0.14, 0.48, 0.046);
          scheduleSoftChime(a, m, 783.99,  t0 + 0.28, 0.52, 0.050);
          scheduleSoftChime(a, m, 1046.50, t0 + 0.42, 0.70, 0.038);
        });
        break;
      default:
        break;
    }
  } catch {
    /* ignore */
  }
}

export const SOUND_IDS = [
  'lessonSwipeForward', 'lessonSwipeBack', 'lessonComplete', 'courseComplete',
  'badgeUnlock', 'levelUp', 'sectionOpen', 'sectionClose',
  'modalOpen', 'modalClose', 'fileDownload', 'groupMessage', 'communityMessage', 'messageSent',
  'quizOptionSelect',
  'click', 'nav', 'toggleOn', 'toggleOff', 'tab', 'formSubmit', 'success', 'error',
  'welcomeGuest', 'welcomeAuth',
  'pageArriveLearn', 'pageArrivePractice', 'pageArrivePLS', 'pageArriveResources',
  'pageArriveBlog', 'pageArriveSettings', 'pageArriveEduvhibe', 'pageArriveEdutainment',
];
