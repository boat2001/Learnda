const VOICE_MIME_CANDIDATES = [
  { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  { mime: 'audio/ogg', ext: 'ogg' },
  { mime: 'video/mp4', ext: 'm4a' },
  { mime: 'video/webm;codecs=opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

export const isLocalhostOrigin = () => {
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
};

export const canRequestMicrophone = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (window.isSecureContext || isLocalhostOrigin());

export const getVoiceRecorderConfig = () => {
  if (typeof MediaRecorder === 'undefined') return null;

  const canPlay = typeof document !== 'undefined'
    ? document.createElement('audio')
    : null;

  const playableCandidates = VOICE_MIME_CANDIDATES.filter(({ mime }) => {
    const audioType = mime.replace(/^video\//, 'audio/');
    return !canPlay || canPlay.canPlayType(audioType) || canPlay.canPlayType(mime);
  });
  const candidates = playableCandidates.length ? playableCandidates : VOICE_MIME_CANDIDATES;

  const match = candidates.find(({ mime }) => MediaRecorder.isTypeSupported?.(mime));
  return match || null;
};

export const getMicrophoneErrorMessage = (error) => {
  if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhostOrigin()) {
    return 'Voice notes need HTTPS. Use the live site or localhost, not a plain network IP address.';
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Microphone access was blocked. Allow the microphone and try again.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device.';
  }
  return 'Microphone permission is needed for voice notes.';
};
