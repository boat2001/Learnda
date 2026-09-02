import { getUiSoundsEnabled } from '../../../utils/uiSounds';

let sharedAudioContext = null;

const TOGGLE_TONE_MAP = {
  toggle: [392, 523.25],
  open: [440, 587.33],
  close: [349.23, 440],
  select: [493.88, 659.25],
};

const scheduleTone = (audioContext, destination, frequency, startAt, duration, volume) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
};

export const playListPageToggleSound = (variant = 'toggle') => {
  if (typeof window === 'undefined') return;
  if (!getUiSoundsEnabled()) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioCtx();
    }

    const audioContext = sharedAudioContext;
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(audioContext.destination);

    const startAt = audioContext.currentTime + 0.008;
    const tones = TOGGLE_TONE_MAP[variant] || TOGGLE_TONE_MAP.toggle;

    tones.forEach((frequency, index) => {
      scheduleTone(audioContext, masterGain, frequency, startAt + index * 0.045, 0.12, index === 0 ? 0.18 : 0.12);
    });
  } catch {
    // Ignore audio failures to keep the UI interaction uninterrupted.
  }
};
