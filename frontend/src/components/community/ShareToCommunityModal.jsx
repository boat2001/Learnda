import { useCallback, useState } from 'react';
import { FiGlobe, FiSend } from 'react-icons/fi';
import FormModal from '../common/FormModal';
import api from '../../services/api';
import './ShareToCommunityModal.css';

const KIND_LABELS = {
  lesson: 'Lesson',
  practice: 'Practice',
  edutainment: 'Edutainment',
  badge: 'Badge',
  achievement: 'Achievement',
};

export default function ShareToCommunityModal({ open, onClose, sharePayload }) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');

  const resetAndClose = useCallback(() => {
    setNote('');
    setStatus('');
    setPending(false);
    onClose?.();
  }, [onClose]);

  const handleSend = useCallback(async () => {
    if (!sharePayload?.url || !sharePayload?.title) {
      setStatus('Missing link to share.');
      return;
    }
    setStatus('');
    setPending(true);
    try {
      const body = note.trim() || `Shared a ${KIND_LABELS[sharePayload.kind] || 'link'}: ${sharePayload.title}`;
      const res = await api.community.postChatMessage({
        body,
        metadata: {
          link: {
            kind: sharePayload.kind,
            title: sharePayload.title,
            url: sharePayload.url,
            ...(sharePayload.subtitle ? { subtitle: sharePayload.subtitle } : {}),
          },
        },
      });
      if (!res?.success) {
        setStatus(res?.error || 'Could not post to the community.');
        return;
      }
      setStatus('Posted to the community room.');
      setTimeout(() => resetAndClose(), 900);
    } catch (e) {
      setStatus(e?.message || 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }, [note, resetAndClose, sharePayload]);

  if (!open || !sharePayload) return null;

  const kindLabel = KIND_LABELS[sharePayload.kind] || 'Content';

  return (
    <FormModal
      isOpen={open}
      onClose={resetAndClose}
      title="Share with community"
      subtitle={`Post this ${kindLabel.toLowerCase()} to the community room so everyone can discuss it.`}
    >
      <div className="cm-share-preview">
        <span className="cm-share-preview__tag">{kindLabel}</span>
        <p className="cm-share-preview__title">{sharePayload.title}</p>
        {sharePayload.subtitle ? (
          <p className="cm-share-preview__sub">{sharePayload.subtitle}</p>
        ) : null}
      </div>

      <label className="cm-share-label" htmlFor="cm-share-note">
        Add a note (optional)
      </label>
      <textarea
        id="cm-share-note"
        className="cm-share-note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Anyone else confused by this section? Let's talk."
      />

      <button
        type="button"
        className="cm-share-send-btn"
        disabled={pending}
        onClick={handleSend}
      >
        <FiGlobe aria-hidden />
        {pending ? 'Posting...' : 'Post to Community'}
        {!pending && <FiSend aria-hidden className="cm-share-send-btn__arrow" />}
      </button>

      {status ? (
        <p
          className={`cm-share-status ${status.includes('Posted') ? 'is-ok' : ''}`.trim()}
          role="status"
        >
          {status}
        </p>
      ) : null}
    </FormModal>
  );
}
