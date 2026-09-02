import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiSend } from 'react-icons/fi';
import FormModal from '../common/FormModal';
import usePLS from '../../hooks/usePLS';
import api from '../../services/api';
import './ShareToStudyGroupModal.css';

const KIND_LABELS = {
  lesson: 'Lesson',
  practice: 'Practice',
  edutainment: 'Edutainment',
  badge: 'Badge',
  achievement: 'Achievement',
};

export default function ShareToStudyGroupModal({ open, onClose, sharePayload }) {
  const { currentStudyGroups, refreshPLS } = usePLS();
  const [note, setNote] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [status, setStatus] = useState('');

  const joinedGroups = useMemo(
    () => (Array.isArray(currentStudyGroups) ? currentStudyGroups.filter((g) => g.is_joined) : []),
    [currentStudyGroups]
  );

  const resetAndClose = useCallback(() => {
    setNote('');
    setStatus('');
    setPendingId(null);
    onClose?.();
  }, [onClose]);

  const handleSend = useCallback(
    async (group) => {
      if (!sharePayload?.url || !sharePayload?.title) {
        setStatus('Missing link to share.');
        return;
      }
      setStatus('');
      setPendingId(group.id);
      try {
        const body = note.trim() || `Shared a ${KIND_LABELS[sharePayload.kind] || 'link'}: ${sharePayload.title}`;
        const res = await api.studyGroups.postMessage(group.id, {
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
          setStatus(res?.error || 'Could not post to the group.');
          return;
        }
        setStatus('Posted to your study group.');
        refreshPLS?.().catch(() => {});
        setTimeout(() => resetAndClose(), 900);
      } catch (e) {
        setStatus(e?.message || 'Something went wrong.');
      } finally {
        setPendingId(null);
      }
    },
    [note, refreshPLS, resetAndClose, sharePayload]
  );

  if (!open || !sharePayload) return null;

  const kindLabel = KIND_LABELS[sharePayload.kind] || 'Content';

  return (
    <FormModal
      isOpen={open}
      onClose={resetAndClose}
      title="Share with study group"
      subtitle={`Send this ${kindLabel.toLowerCase()} to classmates so you can discuss it together.`}
    >
      <div className="sg-share-preview">
        <span className="sg-share-preview__tag">{kindLabel}</span>
        <p className="sg-share-preview__title">{sharePayload.title}</p>
        {sharePayload.subtitle ? (
          <p className="sg-share-preview__sub">{sharePayload.subtitle}</p>
        ) : null}
      </div>

      <label className="sg-share-label" htmlFor="sg-share-note">
        Add a note (optional)
      </label>
      <textarea
        id="sg-share-note"
        className="sg-share-note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Stuck on question 4 — anyone free to hop on voice?"
      />

      {joinedGroups.length === 0 ? (
        <div className="sg-share-empty">
          <FiUsers aria-hidden />
          <p>You have not joined a course study group yet.</p>
          <Link to="/groups" className="sg-share-empty__cta" onClick={resetAndClose}>
            Browse study groups
          </Link>
        </div>
      ) : (
        <ul className="sg-share-groups" aria-label="Your study groups">
          {joinedGroups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="sg-share-group-btn"
                disabled={pendingId === g.id}
                onClick={() => handleSend(g)}
              >
                <span className="sg-share-group-btn__title">{g.title}</span>
                <span className="sg-share-group-btn__meta">{g.course_name || 'Course group'}</span>
                <span className="sg-share-group-btn__icon" aria-hidden>
                  {pendingId === g.id ? <span className="sg-share-spinner" /> : <FiSend />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status ? <p className={`sg-share-status ${status.includes('Posted') ? 'is-ok' : ''}`.trim()} role="status">{status}</p> : null}
    </FormModal>
  );
}
