const toText = (value) => String(value ?? "").trim();

export const UCC_AFFILIATE_CODE = "UCC";

export const resolveAffiliateCode = (course = {}) => {
  const candidates = [
    course.affiliate_university_code,
    course.affiliateUniversityCode,
    course.affiliate_university,
    course.affiliateUniversity,
    course.metadata?.affiliate_university_code,
    course.metadata?.affiliateUniversityCode,
    course.metadata?.affiliate_university,
    course.metadata?.affiliateUniversity,
  ];

  for (const candidate of candidates) {
    const normalized = toText(candidate).toUpperCase();
    if (!normalized) continue;
    if (normalized === UCC_AFFILIATE_CODE) return UCC_AFFILIATE_CODE;
    if (normalized.includes("UNIVERSITY OF CAPE COAST")) return UCC_AFFILIATE_CODE;
    return normalized.replace(/[^A-Z0-9]+/g, "_");
  }

  return null;
};

export const formatAffiliateCourseCode = (code, affiliateCode) => {
  const normalizedCode = toText(code).toUpperCase().replace(/[-_\s]+$/, '');
  if (!normalizedCode) return "";
  if (affiliateCode !== UCC_AFFILIATE_CODE) return normalizedCode;

  const existingMatch = normalizedCode.match(/^EBS\s*(.+)$/i);
  if (existingMatch) {
    return `EBS ${toText(existingMatch[1]).toUpperCase()}`.trim();
  }

  return `EBS ${normalizedCode}`.trim();
};

export const getDisplayCourseCode = (course = {}, fallback = "N/A") =>
  formatAffiliateCourseCode(
    course.code || course.course_code || course.short_code || fallback,
    resolveAffiliateCode(course)
  );
