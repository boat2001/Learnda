const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PLACEHOLDER_OVERRIDE = import.meta.env.VITE_PLACEHOLDER_MODE;

export const PLACEHOLDER_MODE =
  PLACEHOLDER_OVERRIDE === "true" ||
  (!API_BASE_URL && PLACEHOLDER_OVERRIDE !== "false");

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

const normalize = (value = "") => String(value).trim().toLowerCase();
const includes = (value, query) => normalize(value).includes(normalize(query));
const getLessonType = (item = {}) => {
  const type = normalize(item.type || item.content_type || item.lesson_type || item.format);
  if (type === "video" || type === "video_lesson" || type.includes("video")) return "video";
  if (type === "text_lesson" || type === "lesson" || type.includes("text")) return "text_lesson";
  return "";
};
const getDurationMinutes = (value) => {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toTimestamp = (value) => {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const PLACEHOLDER_CONTENT = [
  {
    id: "pl-blog-1",
    type: "blog",
    title: "How To Build A Weekly Study Rhythm",
    description: "A professional placeholder article showing card, detail, and metadata layout.",
    content:
      "<p>This is placeholder copy for blog layout testing. Replace with real editorial content later.</p>",
    tags: ["study", "planning"],
    category: "Productivity",
    course: "General Studies",
    level: "100",
    read_time: "6",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Editorial",
    author_name: "Learnda Editorial",
    author_title: "Placeholder Writer",
    created_at: daysAgo(2),
    view_count: 1187,
    comment_count: 12,
    stats: { total_views: 1187, like_count: 84, rating_avg: 4.8, total_completions: 356 },
    user_interactions: { liked: false, saved: false, progress: 0 },
  },
  {
    id: "pl-blog-2",
    type: "blog",
    title: "Exam Prep Workflow: Notes To Mastery",
    description: "Second placeholder blog for featured rows and related-post sections.",
    content: "<p>Placeholder content body for visual testing in detail screens.</p>",
    tags: ["exam", "revision"],
    category: "Exam Readiness",
    course: "General Studies",
    level: "200",
    read_time: "5",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Editorial",
    author_name: "Learnda Editorial",
    author_title: "Placeholder Writer",
    created_at: daysAgo(5),
    view_count: 942,
    comment_count: 8,
    stats: { total_views: 942, like_count: 61, rating_avg: 4.6, total_completions: 244 },
    user_interactions: { liked: false, saved: false, progress: 0 },
  },
  {
    id: "pl-lesson-1",
    type: "text_lesson",
    title: "Cell Biology Fundamentals",
    description: "Placeholder lesson description for the learning feed and card actions.",
    content: "<p>Placeholder lesson body. Replace this with actual lesson markdown/HTML later.</p>",
    tags: ["biology", "cadl"],
    category: "Biology",
    course: "Cell Biology",
    level: "100",
    duration: "14 min",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Team",
    created_at: daysAgo(1),
    view_count: 1640,
    comment_count: 15,
    stats: { total_views: 1640, like_count: 103, rating_avg: 4.7, total_completions: 510 },
    user_interactions: { liked: false, saved: false, progress: 42 },
  },
  {
    id: "pl-video-1",
    type: "video",
    title: "Organic Chemistry Crash Review",
    description: "Placeholder video lesson for media-oriented cards and detail views.",
    course: "Organic Chemistry",
    level: "200",
    duration: "18 min",
    depth_level: "enhanced",
    visual_type: "animated",
    is_premium: true,
    creator_name: "Learnda Faculty",
    created_at: daysAgo(3),
    view_count: 2205,
    comment_count: 20,
    stats: { total_views: 2205, like_count: 139, rating_avg: 4.9, total_completions: 690 },
    user_interactions: { liked: false, saved: false, progress: 18 },
  },
  {
    id: "pl-lesson-2",
    type: "text_lesson",
    title: "Organic Chemistry Bonding Basics",
    description: "Placeholder text lesson for the Organic Chemistry course detail experience.",
    content:
      "<p>This placeholder lesson covers covalent bonding, structure, and simple naming patterns in organic compounds.</p>",
    tags: ["chemistry", "bonding"],
    category: "Chemistry",
    course: "Organic Chemistry",
    level: "200",
    duration: "12 min",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Faculty",
    created_at: daysAgo(2),
    view_count: 1438,
    comment_count: 9,
    stats: { total_views: 1438, like_count: 94, rating_avg: 4.6, total_completions: 401 },
    user_interactions: { liked: false, saved: false, progress: 24 },
  },
  {
    id: "pl-lesson-3",
    type: "text_lesson",
    title: "Algebraic Expressions And Simplification",
    description: "Placeholder text lesson for the Algebra course detail experience.",
    content:
      "<p>This placeholder lesson introduces terms, coefficients, and basic simplification using worked examples.</p>",
    tags: ["algebra", "expressions"],
    category: "Mathematics",
    course: "Algebra",
    level: "100",
    duration: "10 min",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Team",
    created_at: daysAgo(1),
    view_count: 1264,
    comment_count: 5,
    stats: { total_views: 1264, like_count: 83, rating_avg: 4.5, total_completions: 377 },
    user_interactions: { liked: false, saved: false, progress: 9 },
  },
  {
    id: "pl-quiz-1",
    type: "quiz",
    title: "Timed Practice: Algebra Basics",
    description: "Placeholder quiz item used by home, learn, and search experiences.",
    course: "Algebra",
    level: "100",
    duration: "8 min",
    depth_level: "basic",
    visual_type: "interactive",
    is_premium: false,
    creator_name: "Learnda Team",
    created_at: daysAgo(4),
    view_count: 1311,
    comment_count: 4,
    stats: { total_views: 1311, like_count: 88, rating_avg: 4.5, total_completions: 422 },
    user_interactions: { liked: false, saved: false, progress: 0 },
  },
  {
    id: "pl-pq-1",
    type: "past_question",
    title: "WAEC Physics Past Question Set",
    description: "Placeholder past-question content for file and practice flows.",
    course: "Physics",
    level: "300",
    duration: "12 min",
    depth_level: "enhanced",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Team",
    created_at: daysAgo(8),
    view_count: 1568,
    comment_count: 6,
    stats: { total_views: 1568, like_count: 72, rating_avg: 4.4, total_completions: 318 },
    user_interactions: { liked: false, saved: false, progress: 0 },
  },
  {
    id: "pl-quote-1",
    type: "quote",
    title: "Quote Of The Day",
    description: "Consistency beats intensity when it is repeated daily.",
    content: "Consistency beats intensity when it is repeated daily.",
    category: "Motivation",
    tags: ["quote", "daily"],
    course: "General Studies",
    level: "100",
    read_time: "1",
    depth_level: "basic",
    visual_type: "static",
    is_premium: false,
    creator_name: "Learnda Daily",
    created_at: daysAgo(0),
    view_count: 782,
    comment_count: 2,
    stats: { total_views: 782, like_count: 55, rating_avg: 4.7, total_completions: 230 },
    user_interactions: { liked: false, saved: false, progress: 0 },
  },
];

export const PLACEHOLDER_FILES = [
  {
    id: "pl-file-1",
    title: "BIO 101 Course Outline",
    file_name: "bio101-outline.pdf",
    file_type: "application/pdf",
    description: "Placeholder course outline document.",
    category: "course_outline",
    course: "Cell Biology",
    level: "100",
    semester: "1",
    year: "2024",
    is_premium: false,
    downloads: 122,
    views: 340,
    file_size: 248000,
    created_at: daysAgo(12),
    uploaded_at: daysAgo(12),
  },
  {
    id: "pl-file-2",
    title: "Organic Chemistry Quiz Pack",
    file_name: "orgchem-quiz-pack.pdf",
    file_type: "application/pdf",
    description: "Placeholder quiz collection for testing cards and actions.",
    category: "quiz_internal",
    course: "Organic Chemistry",
    level: "200",
    semester: "1",
    year: "2024",
    is_premium: false,
    downloads: 85,
    views: 208,
    file_size: 315000,
    created_at: daysAgo(10),
    uploaded_at: daysAgo(10),
  },
  {
    id: "pl-file-3",
    title: "Physics Exam Archive",
    file_name: "physics-exams.zip",
    file_type: "application/zip",
    description: "Placeholder past exam archive.",
    category: "exam",
    course: "Physics",
    level: "300",
    semester: "2",
    year: "2023",
    is_premium: true,
    downloads: 64,
    views: 140,
    file_size: 1602000,
    created_at: daysAgo(20),
    uploaded_at: daysAgo(20),
  },
  {
    id: "pl-file-4",
    title: "Worked Solutions: Algebra",
    file_name: "algebra-solutions.docx",
    file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Placeholder worked solutions document.",
    category: "sample_questions",
    course: "Algebra",
    level: "100",
    semester: "2",
    year: "2024",
    is_premium: false,
    downloads: 93,
    views: 188,
    file_size: 198000,
    created_at: daysAgo(6),
    uploaded_at: daysAgo(6),
  },
];

const PLACEHOLDER_PROGRAMS = [
  { id: "prog-sci", key: "science", name: "Science", category: "Faculty", courses_count: 2, offerings_count: 3 },
  { id: "prog-eng", key: "engineering", name: "Engineering", category: "Faculty", courses_count: 1, offerings_count: 1 },
];

const PLACEHOLDER_COURSES = [
  {
    id: "course-bio-101",
    key: "bio-101",
    title: "Cell Biology",
    code: "BIO 101",
    affiliate_university_code: "UCC",
    credits: 3,
    department: "Science",
    subject: "Biology",
    description: "Placeholder course summary for UI design.",
    totalLessons: 6,
    completedLessons: 2,
    progress: 35,
    image: "C",
    instructor: "Learnda Instructor",
    rating: 4.7,
    enrolled: true,
    programs: ["Science"],
    levels: ["100"],
    semesters: ["1"],
    offerings_count: 1,
  },
  {
    id: "course-chm-201",
    key: "chm-201",
    title: "Organic Chemistry",
    code: "CHM 201",
    affiliate_university_code: "UCC",
    credits: 3,
    department: "Science",
    subject: "Chemistry",
    description: "Placeholder course summary for UI design.",
    totalLessons: 8,
    completedLessons: 1,
    progress: 12,
    image: "C",
    instructor: "Learnda Instructor",
    rating: 4.8,
    enrolled: true,
    programs: ["Science"],
    levels: ["200"],
    semesters: ["1"],
    offerings_count: 1,
  },
  {
    id: "course-mth-101",
    key: "mth-101",
    title: "Algebra",
    code: "MTH 101",
    affiliate_university_code: "UCC",
    credits: 2,
    department: "Engineering",
    subject: "Mathematics",
    description: "Placeholder course summary for UI design.",
    totalLessons: 5,
    completedLessons: 0,
    progress: 0,
    image: "C",
    instructor: "Learnda Instructor",
    rating: 4.5,
    enrolled: true,
    programs: ["Engineering"],
    levels: ["100"],
    semesters: ["2"],
    offerings_count: 1,
  },
];

const PLACEHOLDER_OFFERINGS = [
  {
    id: "off-1",
    program_id: "prog-sci",
    level: "100",
    semester: "1",
    program: { id: "prog-sci", key: "science", name: "Science", category: "Faculty" },
    course: { id: "course-bio-101", key: "bio-101", title: "Cell Biology", code: "BIO 101", affiliate_university_code: "UCC", credits: 3, department: "Science" },
  },
  {
    id: "off-2",
    program_id: "prog-sci",
    level: "200",
    semester: "1",
    program: { id: "prog-sci", key: "science", name: "Science", category: "Faculty" },
    course: { id: "course-chm-201", key: "chm-201", title: "Organic Chemistry", code: "CHM 201", affiliate_university_code: "UCC", credits: 3, department: "Science" },
  },
  {
    id: "off-3",
    program_id: "prog-eng",
    level: "100",
    semester: "2",
    program: { id: "prog-eng", key: "engineering", name: "Engineering", category: "Faculty" },
    course: { id: "course-mth-101", key: "mth-101", title: "Algebra", code: "MTH 101", affiliate_university_code: "UCC", credits: 2, department: "Engineering" },
  },
];

const filterContent = (params = {}) => {
  let items = [...PLACEHOLDER_CONTENT];

  if (params.type) {
    items = items.filter((item) => normalize(item.type) === normalize(params.type));
  }
  if (params.course) {
    items = items.filter((item) => normalize(item.course) === normalize(params.course));
  }
  if (params.level) {
    items = items.filter((item) => String(item.level) === String(params.level));
  }
  if (typeof params.is_premium !== "undefined") {
    const premium = String(params.is_premium) === "true";
    items = items.filter((item) => Boolean(item.is_premium) === premium);
  }
  if (params.tags) {
    const tags = splitList(params.tags).map(normalize);
    items = items.filter((item) => tags.some((tag) => (item.tags || []).map(normalize).includes(tag)));
  }

  const q = params.q || params.search;
  if (q) {
    items = items.filter(
      (item) =>
        includes(item.title, q) ||
        includes(item.description, q) ||
        includes(item.content, q) ||
        includes(item.course, q) ||
        (item.tags || []).some((tag) => includes(tag, q))
    );
  }

  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const filterFiles = (filters = {}) => {
  let files = [...PLACEHOLDER_FILES];
  const q = filters.q || filters.search;

  if (q) {
    files = files.filter(
      (file) =>
        includes(file.title, q) ||
        includes(file.file_name, q) ||
        includes(file.description, q) ||
        includes(file.course, q)
    );
  }
  if (filters.type && filters.type !== "all") {
    files = files.filter(
      (file) => includes(file.file_type, filters.type) || includes(file.category, filters.type)
    );
  }
  if (filters.category && filters.category !== "all") {
    files = files.filter((file) => normalize(file.category) === normalize(filters.category));
  }
  if (filters.course && filters.course !== "all") {
    files = files.filter((file) => normalize(file.course) === normalize(filters.course));
  }
  if (filters.level && filters.level !== "all") {
    files = files.filter((file) => String(file.level) === String(filters.level));
  }
  if (filters.semester && filters.semester !== "all") {
    files = files.filter((file) => String(file.semester) === String(filters.semester));
  }
  if (filters.year && filters.year !== "all") {
    files = files.filter((file) => String(file.year) === String(filters.year));
  }

  const sortBy = String(filters.sort_by || "recent").trim().toLowerCase();
  const sortOrder = String(filters.sort_order || "").trim().toLowerCase() === "asc" ? 1 : -1;
  const sortedFiles = [...files].sort((left, right) => {
    const leftCreatedAt = left.created_at || left.uploaded_at;
    const rightCreatedAt = right.created_at || right.uploaded_at;
    if (sortBy === "title") {
      return String(left.title || "").localeCompare(String(right.title || "")) * sortOrder;
    }

    const leftMetric =
      sortBy === "most_accessed"
        ? toSafeNumber(left.views) * 1.1 + toSafeNumber(left.downloads) * 0.55
        : sortBy === "top"
          ? toSafeNumber(left.downloads) * 1.15 + toSafeNumber(left.views) * 0.7
          : sortBy === "trending"
            ? toSafeNumber(left.views) * 0.65 + toSafeNumber(left.downloads) * 1.2 + Math.max(0, 180 - Math.floor((Date.now() - toTimestamp(leftCreatedAt)) / DAY_MS)) * 4
            : toTimestamp(leftCreatedAt);
    const rightMetric =
      sortBy === "most_accessed"
        ? toSafeNumber(right.views) * 1.1 + toSafeNumber(right.downloads) * 0.55
        : sortBy === "top"
          ? toSafeNumber(right.downloads) * 1.15 + toSafeNumber(right.views) * 0.7
          : sortBy === "trending"
            ? toSafeNumber(right.views) * 0.65 + toSafeNumber(right.downloads) * 1.2 + Math.max(0, 180 - Math.floor((Date.now() - toTimestamp(rightCreatedAt)) / DAY_MS)) * 4
            : toTimestamp(rightCreatedAt);

    return (rightMetric - leftMetric) * sortOrder;
  });

  const normalizedLimit = Math.max(0, Number.parseInt(filters.limit, 10) || 0);
  return normalizedLimit > 0 ? sortedFiles.slice(0, normalizedLimit) : sortedFiles;
};

const filterCourses = (filters = {}) => {
  let courses = [...PLACEHOLDER_COURSES];
  const q = filters.q || filters.search;
  if (q) {
    courses = courses.filter(
      (course) => includes(course.title, q) || includes(course.code, q) || includes(course.department, q)
    );
  }
  if (filters.level) {
    courses = courses.filter((course) => (course.levels || []).includes(String(filters.level)));
  }
  if (filters.semester) {
    courses = courses.filter((course) => (course.semesters || []).includes(String(filters.semester)));
  }
  if (filters.programId) {
    const offeringCourseIds = PLACEHOLDER_OFFERINGS.filter(
      (offering) => String(offering.program_id) === String(filters.programId)
    ).map((offering) => offering.course?.id);
    courses = courses.filter((course) => offeringCourseIds.includes(course.id));
  }

  const sortBy = String(filters.sort_by || "title").trim().toLowerCase();
  const sortOrder = String(filters.sort_order || "").trim().toLowerCase() === "desc" ? -1 : 1;
  const sortedCourses = [...courses].sort((left, right) => {
    if (sortBy === "title") {
      return String(left.title || "").localeCompare(String(right.title || "")) * sortOrder;
    }

    const leftCreatedAt = left.created_at || daysAgo(30);
    const rightCreatedAt = right.created_at || daysAgo(30);
    const leftMetric =
      sortBy === "most_studied"
        ? toSafeNumber(left.totalLessons) * 12 + toSafeNumber(left.offerings_count) * 6 + toSafeNumber(left.rating) * 40
        : sortBy === "top"
          ? toSafeNumber(left.rating) * 100 + toSafeNumber(left.offerings_count) * 18 + toSafeNumber(left.totalLessons) * 8
          : sortBy === "most_practiced"
            ? toSafeNumber(left.totalLessons) * 10 + toSafeNumber(left.offerings_count) * 8 + toSafeNumber(left.rating) * 36
            : sortBy === "top_test"
              ? toSafeNumber(left.rating) * 92 + toSafeNumber(left.totalLessons) * 9 + toSafeNumber(left.offerings_count) * 8
              : sortBy === "trending"
                ? toSafeNumber(left.rating) * 60 + toSafeNumber(left.totalLessons) * 7 + toSafeNumber(left.offerings_count) * 10
                : toTimestamp(leftCreatedAt);
    const rightMetric =
      sortBy === "most_studied"
        ? toSafeNumber(right.totalLessons) * 12 + toSafeNumber(right.offerings_count) * 6 + toSafeNumber(right.rating) * 40
        : sortBy === "top"
          ? toSafeNumber(right.rating) * 100 + toSafeNumber(right.offerings_count) * 18 + toSafeNumber(right.totalLessons) * 8
          : sortBy === "most_practiced"
            ? toSafeNumber(right.totalLessons) * 10 + toSafeNumber(right.offerings_count) * 8 + toSafeNumber(right.rating) * 36
            : sortBy === "top_test"
              ? toSafeNumber(right.rating) * 92 + toSafeNumber(right.totalLessons) * 9 + toSafeNumber(right.offerings_count) * 8
              : sortBy === "trending"
                ? toSafeNumber(right.rating) * 60 + toSafeNumber(right.totalLessons) * 7 + toSafeNumber(right.offerings_count) * 10
                : toTimestamp(rightCreatedAt);

    return sortOrder === 1 ? leftMetric - rightMetric : rightMetric - leftMetric;
  });

  const normalizedLimit = Math.max(0, Number.parseInt(filters.limit, 10) || 0);
  return normalizedLimit > 0 ? sortedCourses.slice(0, normalizedLimit) : sortedCourses;
};

const buildLessonRows = (courseId) => {
  const course = PLACEHOLDER_COURSES.find((item) => String(item.id) === String(courseId));
  if (!course) return [];

  return PLACEHOLDER_CONTENT.filter(
    (item) => normalize(item.course) === normalize(course.title) && Boolean(getLessonType(item))
  ).map((item) => {
    const lessonType = getLessonType(item);
    return {
      ...item,
      type: lessonType,
      duration_minutes: item.duration_minutes || getDurationMinutes(item.duration),
      reading_time: item.reading_time || item.read_time || getDurationMinutes(item.duration),
      completed: Number(item.user_interactions?.progress || 0) >= 100,
      metadata: {
        ...(item.metadata || {}),
        course: item.course || course.title,
      },
    };
  });
};

export const placeholderContentApi = {
  getAll: (params = {}) => {
    const content = filterContent(params);
    return Promise.resolve({ success: true, content, total: content.length, page: 1 });
  },
  getById: (id) => {
    const match = PLACEHOLDER_CONTENT.find((item) => String(item.id) === String(id)) || PLACEHOLDER_CONTENT[0];
    return Promise.resolve({ success: true, content: match });
  },
  getFeatured: () => Promise.resolve({ success: true, content: filterContent({}).slice(0, 4) }),
  getTrending: () =>
    Promise.resolve({
      success: true,
      content: [...PLACEHOLDER_CONTENT]
        .sort((a, b) => (b.stats?.total_views || b.view_count || 0) - (a.stats?.total_views || a.view_count || 0))
        .slice(0, 6),
    }),
  getFavorites: () =>
    Promise.resolve({
      success: true,
      content: filterContent({}).slice(0, 3).map((item) => ({
        ...item,
        user_interactions: { ...(item.user_interactions || {}), saved: true },
      })),
    }),
  getPersonalized: () =>
    Promise.resolve({
      success: true,
      content: filterContent({}).map((item, index) => ({
        ...item,
        user_interactions: { ...(item.user_interactions || {}), progress: index === 0 ? 42 : item.user_interactions?.progress || 0 },
      })),
    }),
  search: (query, filters = {}) => placeholderContentApi.getAll({ ...filters, q: query }),
  like: () => Promise.resolve({ success: true, liked: true }),
  save: () => Promise.resolve({ success: true, saved: true }),
  complete: () => Promise.resolve({ success: true }),
  getInteractions: () => Promise.resolve({ success: true, liked: false, saved: false, progress: 0 }),
  trackView: () => Promise.resolve({ success: true }),
  getComments: () =>
    Promise.resolve({
      success: true,
      comments: [
        {
          id: "placeholder-comment-1",
          author_name: "Placeholder User",
          content: "This is a placeholder comment used for UI validation.",
          likes: 3,
          created_at: daysAgo(1),
        },
      ],
    }),
  addComment: (_contentId, content) =>
    Promise.resolve({
      success: true,
      comment: {
        id: `placeholder-comment-${Date.now()}`,
        author_name: "You",
        content,
        likes: 0,
        created_at: new Date().toISOString(),
      },
    }),
  deleteComment: () => Promise.resolve({ success: true }),
  upvoteComment: () => Promise.resolve({ success: true }),
};

export const placeholderResourcesApi = {
  getFiles: (filters = {}) => Promise.resolve({ success: true, files: filterFiles(filters) }),
  trackView: () => Promise.resolve({ success: true }),
  downloadFile: (fileId) => {
    const file = PLACEHOLDER_FILES.find((item) => String(item.id) === String(fileId));
    const title = file?.title || "placeholder-file";
    const blob = new Blob([`Placeholder file content for: ${title}`], { type: "text/plain" });
    return Promise.resolve(blob);
  },
  uploadFile: () =>
    Promise.resolve({
      success: true,
      message: "Placeholder mode active. Uploads are not persisted.",
      file: { id: `placeholder-upload-${Date.now()}` },
    }),
  deleteFile: () => Promise.resolve({ success: true }),
};

export const placeholderCoursesApi = {
  getAll: (filters = {}) =>
    Promise.resolve({ success: true, data: { courses: filterCourses(filters) } }),
  getPrograms: (filters = {}) => {
    let programs = [...PLACEHOLDER_PROGRAMS];
    if (filters.category) {
      programs = programs.filter((program) => normalize(program.category) === normalize(filters.category));
    }
    return Promise.resolve({ success: true, data: { programs } });
  },
  getProgram: (programId, filters = {}) => {
    const program = PLACEHOLDER_PROGRAMS.find((item) => String(item.id) === String(programId));
    const offerings = PLACEHOLDER_OFFERINGS.filter(
      (item) =>
        String(item.program_id) === String(programId) &&
        (!filters.level || String(item.level) === String(filters.level)) &&
        (!filters.semester || String(item.semester) === String(filters.semester))
    );
    return Promise.resolve({ success: true, data: { program, offerings } });
  },
  getOfferings: (filters = {}) => {
    const offerings = PLACEHOLDER_OFFERINGS.filter(
      (item) =>
        (!filters.programId || String(item.program_id) === String(filters.programId)) &&
        (!filters.level || String(item.level) === String(filters.level)) &&
        (!filters.semester || String(item.semester) === String(filters.semester))
    );
    return Promise.resolve({ success: true, data: { offerings } });
  },
  getById: (courseId) => {
    const course = PLACEHOLDER_COURSES.find((item) => String(item.id) === String(courseId)) || PLACEHOLDER_COURSES[0];
    return Promise.resolve({ success: true, data: course });
  },
  getLessons: (courseId) => Promise.resolve({ success: true, data: { lessons: buildLessonRows(courseId) } }),
};
