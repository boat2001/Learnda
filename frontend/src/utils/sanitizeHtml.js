import DOMPurify from 'dompurify';

/** Rich HTML from CMS / articles / lessons — strips scripts and dangerous markup. */
export function sanitizeLessonHtml(html) {
  if (html == null) return '';
  const str = String(html);
  if (!str) return '';
  return DOMPurify.sanitize(str, {
    USE_PROFILES: { html: true },
  });
}
