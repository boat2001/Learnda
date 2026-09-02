const PLACEHOLDER_EMAIL_PATTERN = /^phone\.(\d+)@auth\.sharether\.(?:local|app)$/i;

const normalizeText = (value) => String(value || '').trim();
const getPlaceholderPhoneDigits = (value) => normalizeText(value).match(PLACEHOLDER_EMAIL_PATTERN)?.[1] || '';

export const isPhonePlaceholderEmail = (value) => PLACEHOLDER_EMAIL_PATTERN.test(normalizeText(value));

export const getUserDisplayContact = (user) => {
  const email = normalizeText(user?.email);
  const phoneNumber = normalizeText(user?.phone_number);
  const placeholderPhoneDigits = getPlaceholderPhoneDigits(email);

  if (placeholderPhoneDigits) {
    return phoneNumber || `+${placeholderPhoneDigits}`;
  }

  if (email) {
    return email;
  }

  if (phoneNumber) {
    return phoneNumber;
  }

  return '';
};
