/** Strips legacy " Test Items" suffix from practice course titles (display only). */
export function stripPracticeCourseTitleSuffix(value = '') {
  const raw = String(value ?? '').trim();
  const stripped = raw.replace(/\s+test items\s*$/i, '').trim();
  return stripped || raw;
}
