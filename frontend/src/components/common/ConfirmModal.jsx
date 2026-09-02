import { useEffect } from 'react';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import './ConfirmModal.css';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isProcessing = false,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const releaseBodyScroll = lockBodyScroll();

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isProcessing) {
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      releaseBodyScroll();
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isProcessing, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={() => {
        if (!isProcessing) onCancel?.();
      }}
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Confirmation'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-header">
          <h3>{title || 'Please confirm'}</h3>
        </div>
        <p className="confirm-modal-message">{message || 'Are you sure you want to continue?'}</p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-modal-btn confirm"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
