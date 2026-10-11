import { useEffect, useState } from 'react';
import { FiEdit3, FiSend, FiStar } from 'react-icons/fi';
import { MdSentimentVeryDissatisfied, MdSentimentDissatisfied, MdSentimentNeutral, MdSentimentSatisfied, MdSentimentVerySatisfied } from 'react-icons/md';
import api from '../../services/api';

const OPTIONS = [
  { label: 'Needs work', Icon: MdSentimentVeryDissatisfied, tone: 'orange' },
  { label: 'Could be better', Icon: MdSentimentDissatisfied, tone: 'orange' },
  { label: 'Okay', Icon: MdSentimentNeutral, tone: 'amber' },
  { label: 'Good', Icon: MdSentimentSatisfied, tone: 'green' },
  { label: 'Love it!', Icon: MdSentimentVerySatisfied, tone: 'blue' },
];
const STORAGE_KEY = 'learnda-platform-rating';

export default function PlatformRating() {
  const [saved, setSaved] = useState(() => {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
    } catch { return 0; }
  });
  const [rating, setRating] = useState(saved);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [burst, setBurst] = useState({ key: 0, rating: 0 });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    api.request('/analytics/rating-summary').then(result => {
      if (active && result?.success) setSummary(result);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!burst.rating) return;
    const timer = window.setTimeout(() => setBurst(previous => ({ ...previous, rating: 0 })), 1100);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const sparkle = (value) => setBurst(previous => ({ key: previous.key + 1, rating: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!rating || sending || rating === saved) return;
    setSending(true);
    setError('');
    try {
      const result = await api.request('/analytics/event', {
        method: 'POST',
        body: JSON.stringify({ eventName: 'platform_rating', properties: { rating, label: OPTIONS[rating - 1].label, source: 'footer' } }),
      });
      if (!result?.success) throw new Error('Unable to save');
      setSaved(rating);
      api.request('/analytics/rating-summary').then(result => {
        if (result?.success) setSummary(result);
      }).catch(() => {});
      try { localStorage.setItem(STORAGE_KEY, String(rating)); } catch { /* Keep the submitted rating in memory. */ }
    } catch {
      setError('Could not send just yet. Please try again.');
    } finally { setSending(false); }
  };

  return (
    <form className="platform-rating" onSubmit={submit}>
      <div className="platform-rating__summary">
        <FiStar aria-hidden="true" />
        {summary?.count > 0 ? <><span><strong>{Number(summary.average).toFixed(1)}</strong> / 5</span><span>{summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</span></> : <span>{summary ? 'Be the first to rate Learnda' : 'Your voice helps us grow'}</span>}
      </div>
      <fieldset disabled={sending}>
        <legend><FiEdit3 aria-hidden="true" /><span className="platform-rating__label-full"> Rate and tell us what you think.</span><span className="platform-rating__label-compact"> How is Learnda?</span></legend>
        <div className="platform-rating__faces">
          {OPTIONS.map(({ label, Icon, tone }, index) => (
            <label key={label} className="platform-rating__choice" style={{ '--face-ink': index === 0 ? '#a52d50' : `var(--ink-${tone})`, '--face-tint': index === 0 ? '#ffe8ef' : `var(--tint-${tone})`, '--face-color': index === 0 ? '#e87897' : `var(--brand-${tone})` }}>
              <input type="radio" name="platform-rating" value={index + 1} checked={rating === index + 1} onClick={() => sparkle(index + 1)} onChange={() => { setRating(index + 1); setError(''); sparkle(index + 1); }} aria-label={`${index + 1} out of 5: ${label}`} />
              <span className="platform-rating__face" title={label}><Icon aria-hidden="true" /></span>
            </label>
          ))}
          {burst.rating > 0 && <span className="platform-rating__burst" key={burst.key} aria-hidden="true" style={{ left: `${(burst.rating - .5) * 20}%` }}>
            {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ '--spark-x': `${(index - 3) * 12}px`, '--spark-y': `${-35 - (index % 3) * 12}px`, '--spark-delay': `${index * 35}ms`, '--spark-color': `var(--brand-${['amber', 'orange', 'blue', 'green'][index % 4]})` }}>{index % 2 ? '✦' : '★'}</i>)}
          </span>}
        </div>
      </fieldset>
      <p className="platform-rating__status" role="status">{error || (saved && saved === rating ? 'Thanks for helping Learnda grow!' : rating ? OPTIONS[rating - 1].label : 'Pick a face to tell us.')}</p>
      {rating !== saved && rating > 0 && <button className="platform-rating__submit" type="submit" disabled={sending}><FiSend aria-hidden="true" /> {sending ? 'Sending...' : 'Send rating'}</button>}
    </form>
  );
}
