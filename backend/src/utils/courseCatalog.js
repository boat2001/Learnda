const UCC_AFFILIATE_CODE = 'UCC';
const UCC_AFFILIATE_NAME = 'University of Cape Coast';

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const getInstitutionMetadata = (institution) => {
  if (!institution) return {};
  if (typeof institution.get === 'function') {
    return institution.get('metadata') || {};
  }
  return institution.metadata || {};
};

const normalizeAffiliateUniversityCode = (value) => {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return null;
  if (normalized === UCC_AFFILIATE_CODE) return UCC_AFFILIATE_CODE;
  if (normalized.includes('UNIVERSITY OF CAPE COAST')) return UCC_AFFILIATE_CODE;
  return normalized.replace(/[^A-Z0-9]+/g, '_');
};

const resolveCandidateAffiliateCode = (value, { allowGeneric = false } = {}) => {
  const normalized = normalizeAffiliateUniversityCode(value);
  if (!normalized) return null;
  if (normalized === UCC_AFFILIATE_CODE) return normalized;
  return allowGeneric ? normalized : null;
};

const resolveAffiliateUniversityCode = ({
  course = null,
  offerings = [],
  fallbackAffiliateUniversity = null,
  fallbackAffiliateUniversityCode = null,
} = {}) => {
  const explicitCandidates = [
    course?.affiliate_university_code,
    course?.metadata?.affiliate_university_code,
    course?.metadata?.affiliateUniversityCode,
    course?.affiliate_university,
    course?.metadata?.affiliate_university,
    course?.metadata?.affiliateUniversity,
    fallbackAffiliateUniversityCode,
    fallbackAffiliateUniversity,
  ];

  offerings.forEach((offering) => {
    const program = offering?.program || {};
    const institution = program?.institution || null;
    const institutionMetadata = getInstitutionMetadata(institution);

    explicitCandidates.push(
      program?.affiliate_university_code,
      program?.metadata?.affiliate_university_code,
      program?.metadata?.affiliateUniversityCode,
      program?.affiliate_university,
      program?.metadata?.affiliate_university,
      program?.metadata?.affiliateUniversity,
      institutionMetadata.affiliate_university_code,
      institutionMetadata.affiliateUniversityCode,
      institutionMetadata.affiliate_university,
      institutionMetadata.affiliateUniversity
    );
  });

  for (const candidate of explicitCandidates) {
    const normalized = resolveCandidateAffiliateCode(candidate, { allowGeneric: true });
    if (normalized) return normalized;
  }

  for (const offering of offerings) {
    const institutionName = offering?.program?.institution?.name;
    const normalized = resolveCandidateAffiliateCode(institutionName, { allowGeneric: false });
    if (normalized) return normalized;
  }

  return null;
};

const getAffiliateUniversityName = (affiliateUniversityCode) => {
  if (affiliateUniversityCode === UCC_AFFILIATE_CODE) {
    return UCC_AFFILIATE_NAME;
  }
  return null;
};

const formatAffiliateCourseCode = (code, affiliateUniversityCode) => {
  const normalizedCode = normalizeText(code).toUpperCase();
  if (!normalizedCode) return '';
  if (affiliateUniversityCode !== UCC_AFFILIATE_CODE) return normalizedCode;

  const existingMatch = normalizedCode.match(/^EBS\s*(.+)$/i);
  if (existingMatch) {
    return `EBS ${normalizeText(existingMatch[1]).toUpperCase()}`.trim();
  }

  return `EBS ${normalizedCode}`.trim();
};

module.exports = {
  UCC_AFFILIATE_CODE,
  UCC_AFFILIATE_NAME,
  resolveAffiliateUniversityCode,
  getAffiliateUniversityName,
  formatAffiliateCourseCode,
};
