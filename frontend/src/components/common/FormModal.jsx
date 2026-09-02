import { useEffect, useRef } from 'react';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { playUiSound } from '../../utils/uiSounds';
import './FormModal.css';

export default function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  modalClassName,
  modalStyle,
}) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      playUiSound('modalOpen');
    } else if (!isOpen && wasOpenRef.current) {
      playUiSound('modalClose');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const release = lockBodyScroll();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => { release(); window.removeEventListener('keydown', onKey); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div
        className={`fm-modal${size === 'lg' ? ' fm-modal--lg' : ''}${modalClassName ? ` ${modalClassName}` : ''}`}
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fm-header">
          <div className="fm-header-text">
            <h2 className="fm-title">{title}</h2>
            {subtitle && <p className="fm-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="fm-body">{children}</div>
      </div>
    </div>
  );
}
