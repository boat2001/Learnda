const PHONE_FORMATTING_REGEX = /[\s()-]/g;

export const sanitizeEmailAddress = (value) => String(value || '').trim().toLowerCase();

export const sanitizePhoneNumber = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(PHONE_FORMATTING_REGEX, '');
  const normalizedPrefix = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const digits = normalizedPrefix.replace(/\D/g, '');

  if (!digits) return '';

  if (normalizedPrefix.startsWith('+')) {
    if (digits.startsWith('2330') && digits.length === 13) {
      return `+233${digits.slice(4)}`;
    }
    return `+${digits}`;
  }

  if (digits.startsWith('2330') && digits.length === 13) {
    return `+233${digits.slice(4)}`;
  }

  if (digits.startsWith('233')) {
    return `+${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    return `+233${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `+233${digits}`;
  }

  return normalizedPrefix;
};

export const inferContactModeFromValue = (value) => (
  String(value || '').includes('@') ? 'email' : 'phone'
);

export const sanitizeAuthContact = (value, mode = null) => {
  const resolvedMode = mode || inferContactModeFromValue(value);
  return resolvedMode === 'phone'
    ? sanitizePhoneNumber(value)
    : sanitizeEmailAddress(value);
};
