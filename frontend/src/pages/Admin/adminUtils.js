const PHONE_EMAIL_RE = /^phone\.(\d+)@auth\.learnda\.(app|local)$/;

export function isPhoneEmail(email) {
  return PHONE_EMAIL_RE.test(String(email || ''));
}

// Returns the clean phone number for phone-registered users, real email otherwise.
export function displayContact(user) {
  if (!user) return '';
  const email = String(user.email || '');
  const match = PHONE_EMAIL_RE.exec(email);
  if (match) return user.phone_number || match[1];
  return email;
}
