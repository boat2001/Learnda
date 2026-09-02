import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function AdminModal({ title, onClose, children, width = 580, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="adm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-modal" style={{ maxWidth: width }}>
        <div className="adm-modal-header">
          <h3 className="adm-modal-title">{title}</h3>
          <button type="button" className="adm-btn adm-btn-ghost" style={{ padding: '0 6px' }} onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="adm-modal-body">{children}</div>
        {footer && <div className="adm-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
