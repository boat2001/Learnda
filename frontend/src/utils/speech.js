// Reads short text aloud. §8: Kindergarten is audio-first and tap-to-listen,
// and Primary learners who are still learning to read use it too.

const PREFERRED_LANGS = ['en-GH', 'en-NG', 'en-GB'];

export const canSpeak = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export const speak = (text) => {
  if (!canSpeak() || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.85; // slower, for early readers
  const voices = window.speechSynthesis.getVoices();
  const voice = PREFERRED_LANGS.reduce(
    (found, lang) => found || voices.find((v) => v.lang === lang),
    null
  );
  if (voice) utter.voice = voice;
  else utter.lang = 'en-GB';
  window.speechSynthesis.speak(utter);
};
