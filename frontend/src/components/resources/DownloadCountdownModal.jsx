import { useEffect, useRef, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { playUiSound } from '../../utils/uiSounds';
import './DownloadCountdownModal.css';

const DEFAULT_SECONDS = 5;

export default function DownloadCountdownModal({
  open,
  fileName = 'this file',
  seconds = DEFAULT_SECONDS,
  isProcessing = false,
  onCancel,
  onConfirm,
}) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    firedRef.current = false;
    setRemaining(seconds);
    if (!wasOpenRef.current) {
      playUiSound('modalOpen');
    }
    wasOpenRef.current = true;
  }, [open, seconds]);

  useEffect(() => {
    if (!open || isProcessing) return undefined;
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onConfirm?.();
      }
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [open, isProcessing, onConfirm, remaining]);

  useEffect(() => {
    if (!open) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isProcessing) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      releaseBodyScroll();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isProcessing, onCancel, open]);

  if (!open) return null;

  return (
    <div className="download-countdown-backdrop" role="presentation" onClick={!isProcessing ? onCancel : undefined}>
      <div
        className="download-countdown-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-countdown-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="download-countdown-header">
          <h2 id="download-countdown-title">Download starts in {remaining}s</h2>
          <button
            type="button"
            className="download-countdown-close"
            onClick={onCancel}
            aria-label="Close download prompt"
            disabled={isProcessing}
          >
            <FiX />
          </button>
        </header>

        <p className="download-countdown-copy" title={fileName}>
          <strong>{fileName}</strong>
        </p>

        <div className="download-countdown-actions">
          <button type="button" className="download-countdown-btn secondary" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </button>
          <button
            type="button"
            className="download-countdown-btn primary"
            onClick={onConfirm}
            disabled={isProcessing || remaining > 0}
          >
            <FiDownload />
            <span>{isProcessing ? 'Downloading...' : 'Download now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
