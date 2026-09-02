const PHONE_FORMATTING_REGEX = /[\s()-]/g;

const normalizeEmailAddress = (value) => String(value || '').trim().toLowerCase();

const normalizePhoneNumber = (value) => {
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

const isEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

module.exports = {
  isEmailAddress,
  normalizeEmailAddress,
  normalizePhoneNumber,
};
