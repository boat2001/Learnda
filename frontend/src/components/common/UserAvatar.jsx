import { useEffect, useState } from 'react';
import { resolveUploadUrl } from '../../services/api';

const getInitials = (name = '') => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

export default function UserAvatar({
  src,
  name,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  alt = '',
}) {
  const resolvedSrc = src ? resolveUploadUrl(src) : '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (resolvedSrc && !failed) {
    return (
      <img
        className={imageClassName}
        src={resolvedSrc}
        alt={alt || name || ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={[className, fallbackClassName].filter(Boolean).join(' ')}>
      {getInitials(name)}
    </span>
  );
}
