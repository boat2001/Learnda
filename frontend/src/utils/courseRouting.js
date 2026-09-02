import { getDisplayCourseCode } from './courseCode';

const toText = (value) => String(value ?? '').trim();

const normalizeSlugText = (value) =>
  toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');

const getCourseTitle = (course = {}) =>
  toText(course.title || course.name || course.course_title || course.course_name || '');

const getCourseCode = (course = {}) => getDisplayCourseCode(course, '');

const getCourseCreditsText = (course = {}) => {
  const raw = course.credits ?? course.credit ?? course.credit_hours ?? course.creditsText;
  const text = toText(raw);
  if (!text) return '';
  return /credit/i.test(text) ? text : `${text} Credits`;
};

const resolveScopeBasePath = (scope, fallbackPath) => {
  if (scope === 'pls-study') return '/pls/study';
  if (scope === 'pls-practice') return '/pls/practice';
  return fallbackPath;
};

export const getCourseSlug = (course = {}) => {
  const title = getCourseTitle(course);
  const code = getCourseCode(course);
  const base = normalizeSlugText(title || code || 'course');
  return base || 'course';
};

export const buildCoursePath = (course = {}, options = {}) => {
  const slug = getCourseSlug(course);
  const id = course?.id || course?.course_id || course?.content_id || course?.uuid || course?.slug || '';
  const hasId = Boolean(id && !course?.isPreview);
  const basePath = resolveScopeBasePath(options.scope, '/learn');
  return hasId ? `${basePath}/${slug}?id=${encodeURIComponent(id)}` : `${basePath}/${slug}`;
};

export const buildPracticePath = (course = {}, options = {}) => {
  const slug = getCourseSlug(course);
  const id = course?.id || course?.course_id || course?.content_id || course?.uuid || course?.slug || '';
  const hasId = Boolean(id && !course?.isPreview);
  const basePath = resolveScopeBasePath(options.scope, '/practice');
  return hasId ? `${basePath}/${slug}?id=${encodeURIComponent(id)}` : `${basePath}/${slug}`;
};

export const buildCourseRouteState = (course = {}, options = {}) => {
  const title = getCourseTitle(course) || 'Course';
  const code = getCourseCode(course);
  const creditsText = getCourseCreditsText(course);
  const isPreview = Boolean(course?.isPreview);
  const sourcePath = toText(options.sourcePath);
  const activeTab = toText(options.activeTab);
  const sourceContext = toText(options.sourceContext || options.scope);

  return {
    course: {
      id: isPreview ? null : course?.id || course?.course_id || course?.content_id || course?.uuid || course?.slug || null,
      title,
      code,
      credits: course?.credits ?? course?.credit ?? course?.credit_hours ?? null,
      creditsText,
      programs: course?.programs || course?.program || [],
      description: course?.description || course?.summary || '',
      is_premium: Boolean(course?.is_premium || course?.premium),
      image:
        course?.image ||
        course?.featured_image ||
        course?.image_url ||
        course?.thumbnail_url ||
        course?.thumbnail ||
        null,
      isPreview,
    },
    ...(sourcePath ? { coursePath: sourcePath, fromCoursePath: sourcePath } : {}),
    ...(activeTab ? { activeTab } : {}),
    ...(sourceContext ? { sourceContext } : {}),
  };
};
