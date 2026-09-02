const normalizeContributorStatus = (value) => {
  const next = String(value || '').trim().toLowerCase();
  if (['pending', 'approved', 'rejected'].includes(next)) return next;
  return 'none';
};

const hasContributorAccess = (user) => {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  if (user.is_contributor === true) return true;
  // legacy: role='contributor' rows in DB still work until migrated
  if (String(user.role || '').toLowerCase() === 'contributor') return true;
  return normalizeContributorStatus(user.contributor_application_status) === 'approved';
};

module.exports = {
  normalizeContributorStatus,
  hasContributorAccess
};
