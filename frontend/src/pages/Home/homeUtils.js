import { getDisplayCourseCode } from "../../utils/courseCode";

export const LOGO_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
export const DAILY_TAKEN_STORAGE_PREFIX = "learnda-home-daily-taken:v2:";
export const WEEKLY_TAKEN_STORAGE_PREFIX = "learnda-home-weekly-taken:v2:";
export const STUDY_OPENED_STORAGE_PREFIX = "learnda-home-study-opened:v1:";
export const SPOTLIGHT_OPENED_STORAGE_PREFIX = "learnda-home-spotlight-opened:v1:";
export const EDUTAINMENT_DAILY_TYPES = ['quote', 'fact', 'joke', 'article', 'story'];
export const EDUTAINMENT_TYPE_META = {
  quote: { label: 'Quote', plural: 'Quotes', accent: '#1d7d9a', glyph: '“' },
  fact: { label: 'Did You Know', plural: 'Facts', accent: '#0ea5a5', glyph: '?' },
  joke: { label: 'Jocular', plural: 'Joculars', accent: '#fab82c', glyph: '☺' },
  article: { label: 'Article', plural: 'Articles', accent: '#1f6feb', glyph: '✎' },
  story: { label: 'Story', plural: 'Stories', accent: '#a855f7', glyph: '▶' },
};
export const HOME_TRENDING_TAGS = [
  { key: "courses", label: "Trending Courses" },
  { key: "files", label: "Popular Files" },
];
export const COLLEGE_IMAGE_BASE = `${import.meta.env.BASE_URL}college-images/`;
export const GUEST_COLLEGE_IMAGE_MAP = {
  "abetifi-college-education": `${COLLEGE_IMAGE_BASE}abetifi-college-education.jpg`,
  "atebubu-college-education": `${COLLEGE_IMAGE_BASE}atebubu-college-education.jpg`,
  "berekum-college-education": `${COLLEGE_IMAGE_BASE}berekum-college-education.jpg`,
  "christ-the-teacher-college-education": `${COLLEGE_IMAGE_BASE}christ-the-teacher-college-education.jpg`,
  "foso-college-education": `${COLLEGE_IMAGE_BASE}foso-college-education.jpg`,
  "holy-child-college-education": `${COLLEGE_IMAGE_BASE}holy-child-college-education.jpg`,
  "holy-spirit-college-education": `${COLLEGE_IMAGE_BASE}holy-spirit-college-education.jpg`,
  "jasikan-college-education": `${COLLEGE_IMAGE_BASE}jasikan-college-education.jpg`,
  "kibi-college-education": `${COLLEGE_IMAGE_BASE}kibi-college-education.jpg`,
  "nsawkaw-college-education": `${COLLEGE_IMAGE_BASE}nsawkaw-college-education.jpg`,
  "offinso-college-education": `${COLLEGE_IMAGE_BASE}offinso-college-education.jpg`,
  "ola-college-education-cape-coast": `${COLLEGE_IMAGE_BASE}ola-college-education-cape-coast.jpg`,
  "sda-college-education-agona": `${COLLEGE_IMAGE_BASE}sda-college-education-agona.png`,
  "st-ambrose-college-education": `${COLLEGE_IMAGE_BASE}st-ambrose-college-education.jpeg`,
  "st-francis-college-education": `${COLLEGE_IMAGE_BASE}st-francis-college-education.jpg`,
  "st-monicas-college-education": `${COLLEGE_IMAGE_BASE}st-monicas-college-education.jpg`,
  "st-teresas-college-education": `${COLLEGE_IMAGE_BASE}st-teresas-college-education.jpg`,
  "ucc-college-of-education-studies": `${COLLEGE_IMAGE_BASE}ucc-college-of-education-studies.jpg`,
};
export const HOME_TRENDING_COURSE_FALLBACK_IMAGES = [
  `${import.meta.env.BASE_URL}learn.jpg`,
  `${import.meta.env.BASE_URL}learning-1.jpg`,
  `${import.meta.env.BASE_URL}learning-2.jpg`,
  `${import.meta.env.BASE_URL}learning-3.jpg`,
  `${import.meta.env.BASE_URL}test-2.jpg`,
  `${import.meta.env.BASE_URL}group-1.jpg`,
];
export const HOME_TRENDING_FILE_PREVIEW_DOWNLOAD_COUNTS = [3190, 2684, 2214, 1980, 1640, 1380];
export const HOME_TRENDING_FILE_PREVIEW_VIEW_COUNTS = [12040, 10220, 8890, 7684, 6420, 5040];
export const HOME_TRENDING_FILE_PREVIEW_SIZES = ["174 KB", "141 KB", "112 KB", "96 KB", "84 KB", "72 KB"];
export const MODAL_REACTION_BURSTS = {
  likes: [
    { type: "icon", x: 16, y: 54, delay: 0, driftX: -28, driftY: -74, scale: 0.82 },
    { type: "icon", x: 44, y: 32, delay: 45, driftX: -8, driftY: -88, scale: 0.76 },
    { type: "icon", x: 78, y: 54, delay: 110, driftX: 28, driftY: -72, scale: 0.8 },
    { type: "glitter", x: 30, y: 12, delay: 25, driftX: -18, driftY: -54, scale: 0.66 },
    { type: "glitter", x: 58, y: 10, delay: 90, driftX: 16, driftY: -56, scale: 0.7 },
  ],
  comments: [
    { type: "icon", x: 24, y: 50, delay: 0, driftX: -22, driftY: -68, scale: 0.76 },
    { type: "icon", x: 72, y: 50, delay: 90, driftX: 22, driftY: -68, scale: 0.76 },
    { type: "glitter", x: 40, y: 18, delay: 35, driftX: -10, driftY: -56, scale: 0.62 },
    { type: "glitter", x: 54, y: 14, delay: 70, driftX: 4, driftY: -60, scale: 0.66 },
    { type: "glitter", x: 66, y: 18, delay: 120, driftX: 16, driftY: -54, scale: 0.6 },
  ],
  shares: [
    { type: "icon", x: 12, y: 58, delay: 0, driftX: -30, driftY: -76, scale: 0.8 },
    { type: "icon", x: 42, y: 34, delay: 40, driftX: -10, driftY: -92, scale: 0.78 },
    { type: "icon", x: 72, y: 34, delay: 82, driftX: 12, driftY: -92, scale: 0.78 },
    { type: "icon", x: 86, y: 58, delay: 122, driftX: 28, driftY: -78, scale: 0.8 },
    { type: "glitter", x: 28, y: 12, delay: 25, driftX: -20, driftY: -58, scale: 0.68 },
    { type: "glitter", x: 50, y: 6, delay: 64, driftX: 0, driftY: -64, scale: 0.74 },
    { type: "glitter", x: 70, y: 12, delay: 118, driftX: 20, driftY: -58, scale: 0.68 },
  ],
};
export const MODAL_REACTION_TONES = {
  likes: {
    oscillatorType: "triangle",
    frequencies: [330, 392, 523],
    step: 0.055,
    duration: 0.18,
    volume: 0.38,
    accent: { type: "sine", frequency: 262, delay: 0.02, duration: 0.24, volume: 0.16 },
  },
  comments: {
    oscillatorType: "sine",
    frequencies: [294, 370, 440],
    step: 0.06,
    duration: 0.17,
    volume: 0.3,
    accent: { type: "triangle", frequency: 220, delay: 0.015, duration: 0.22, volume: 0.14 },
  },
  shares: {
    oscillatorType: "sine",
    frequencies: [392, 494, 587, 784],
    step: 0.05,
    duration: 0.19,
    volume: 0.42,
    accent: { type: "triangle", frequency: 294, delay: 0.015, duration: 0.26, volume: 0.18 },
  },
};

export const GUEST_COLLEGES = [
  {
    id: "abetifi-presbyterian-college-education",
    name: "Abetifi Presbyterian College of Education",
    established: "Abetifi",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["abetifi-college-education"],
  },
  {
    id: "atebubu-college-education",
    name: "Atebubu College of Education",
    established: "Atebubu",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["atebubu-college-education"],
  },
  {
    id: "berekum-college-education",
    name: "Berekum College of Education",
    established: "Berekum",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["berekum-college-education"],
  },
  {
    id: "christ-the-teacher-college-education",
    name: "Christ the Teacher College of Education",
    established: "Kumasi, Ashanti",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["christ-the-teacher-college-education"],
  },
  {
    id: "foso-college-education",
    name: "Foso College of Education",
    established: "Assin Foso",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["foso-college-education"],
  },
  {
    id: "holy-child-college-education",
    name: "Holy Child College of Education",
    established: "Takoradi",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["holy-child-college-education"],
  },
  {
    id: "holy-spirit-college-education",
    name: "Holy Spirit College of Education",
    established: "Ho, Volta",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["holy-spirit-college-education"],
  },
  {
    id: "jasikan-college-education",
    name: "Jasikan College of Education",
    established: "Jasikan",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["jasikan-college-education"],
  },
  {
    id: "kibi-college-education",
    name: "Kibi College of Education",
    established: "Kibi",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["kibi-college-education"],
  },
  {
    id: "nsawkaw-college-education",
    name: "Nsawkaw College of Education",
    established: "Nsawkaw, Bono",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["nsawkaw-college-education"],
  },
  {
    id: "offinso-college-education",
    name: "Offinso College of Education",
    established: "Offinso",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["offinso-college-education"],
  },
  {
    id: "ola-college-education-cape-coast",
    name: "OLA College of Education",
    established: "Cape Coast",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["ola-college-education-cape-coast"],
  },
  {
    id: "sda-college-education-agona",
    name: "SDA College of Education",
    established: "Agona",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["sda-college-education-agona"],
  },
  {
    id: "st-ambrose-college-education",
    name: "St. Ambrose College of Education",
    established: "Dormaa-Akwamu",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["st-ambrose-college-education"],
  },
  {
    id: "st-francis-college-education",
    name: "St. Francis College of Education",
    established: "Hohoe",
    affiliation: "Affiliated to UCC",
    programs: ["Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["st-francis-college-education"],
  },
  {
    id: "st-monicas-college-education",
    name: "St. Monica's College of Education",
    established: "Mampong",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["st-monicas-college-education"],
  },
  {
    id: "st-teresas-college-education",
    name: "St. Teresa's College of Education",
    established: "Hohoe",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["st-teresas-college-education"],
  },
  {
    id: "ucc-college-of-education-studies",
    name: "UCC College of Education Studies",
    established: "Cape Coast",
    affiliation: "Affiliated to UCC",
    programs: ["Early Childhood Education", "Primary Education", "JHS Education"],
    image: GUEST_COLLEGE_IMAGE_MAP["ucc-college-of-education-studies"],
  },
];

export const GUEST_SUCCESS_STORIES = [];

const TITLE_SMALL = new Set(['a','an','the','and','but','or','nor','for','so','yet','at','by','in','of','on','to','up','as','into','onto','with','from','over','via']);
export const toTitleCase = (value = "") => {
  const words = value.toString().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.map((w, i) => {
    const l = w.toLowerCase();
    return i > 0 && i < words.length - 1 && TITLE_SMALL.has(l) ? l : w[0].toUpperCase() + w.slice(1);
  }).join(" ");
};

export const normalizeType = (value = "") => value.toString().trim().toLowerCase().replace(/-/g, "_");

export const DAILY_GREETINGS = [
  "Greetings",
  "Good day",
  "Good morning",
  "Good afternoon",
  "Good evening",
];

export const DAILY_WELCOME_LINES = [
  "Welcome back 👋",
  "Happy learning 📚",
  "Enjoy learning ✨",
  "Climb up higher 🧗",
  "Keep growing 🌱",
  "All the best 🙌",
  "Stay sharp 🎯",
  "Keep learning 🧠",
  "Study well 📝",
  "Aim higher 🚀",
  "Keep going 💪",
  "Learn more 📖",
  "Rise higher ⬆️",
  "Stay focused 🔎",
  "Keep improving 📈",
  "Make progress ✅",
  "Push forward ➡️",
  "Dream bigger 🌟",
  "Do your best 🏆",
  "Grow stronger 💫",
  "Stay inspired 💡",
];

const getHeaderTextLength = (value = "") =>
  String(value || "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\ufe0f/gu, "")
    .trim().length;

const SHORT_DAILY_WELCOME_LINES = DAILY_WELCOME_LINES.filter((line) => getHeaderTextLength(line) <= 16);
const TIGHT_DAILY_WELCOME_LINES = DAILY_WELCOME_LINES.filter((line) => getHeaderTextLength(line) <= 13);

export const GREETINGS_BY_PERIOD = {
  morning: ["Greetings", "Good day", "Good morning"],
  afternoon: ["Greetings", "Good day", "Good afternoon"],
  evening: ["Greetings", "Good evening"],
  night: ["Greetings", "Good evening"],
};

export const getGreetingPeriod = (value = new Date()) => {
  const hour = value.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
};

export const getLocalDateKey = (value = new Date()) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getLocalWeekKey = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const thursday = new Date(date);
  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const weekNumber = 1 + Math.round((thursday - firstThursday) / 604800000);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
};

export const hashTextSeed = (value = "") => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const pickDailyOption = (options, seed, offset = 0) => {
  if (!Array.isArray(options) || options.length === 0) return "";
  const index = Math.abs(seed + offset) % options.length;
  return options[index];
};

export const getDailyHeaderMessage = ({ userKey = "guest", firstName = "" } = {}) => {
  const now = new Date();
  const dateKey = getLocalDateKey(now);
  const period = getGreetingPeriod(now);
  const normalizedUserKey = String(userKey || "guest").toLowerCase();
  const greetingSeed = hashTextSeed(`${dateKey}:${period}:${normalizedUserKey}`);
  const welcomeSeed = hashTextSeed(`${dateKey}:${normalizedUserKey}`);
  const greetingPool = GREETINGS_BY_PERIOD[period] || DAILY_GREETINGS;
  const greeting = pickDailyOption(greetingPool, greetingSeed, 3);
  const baseLineLength = getHeaderTextLength(`${greeting}, ${firstName}.`);
  const welcomePool =
    baseLineLength >= 24
      ? TIGHT_DAILY_WELCOME_LINES
      : baseLineLength >= 20
        ? SHORT_DAILY_WELCOME_LINES
        : DAILY_WELCOME_LINES;

  return {
    greeting,
    welcome: pickDailyOption(welcomePool, welcomeSeed, 11),
  };
};

export const getFirstSentence = (value = "", fallback = "") => {
  const normalized = String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const sentenceMatch = normalized.match(/.+?[.!?](?=\s|$)/);
  return sentenceMatch ? sentenceMatch[0] : normalized;
};

export const toDisplayNameCase = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[-'\s])([a-z])/g, (_, separator, char) => `${separator}${char.toUpperCase()}`);

export const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
};

export const parseDateValue = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const formatGroupCreatedDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Created ${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
};

export const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));
export const getNumberOrFallback = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export const PROGRESS_COLOR_STOPS = [
  { point: 0, color: [239, 68, 68] },
  { point: 35, color: [245, 158, 11] },
  { point: 70, color: [59, 130, 246] },
  { point: 100, color: [34, 197, 94] },
];

export const mixRgb = (from, to, ratio) =>
  from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio));

export const tintRgb = (rgb, ratio = 0.2) =>
  rgb.map((channel) => Math.round(channel + (255 - channel) * ratio));

export const shadeRgb = (rgb, ratio = 0.12) => rgb.map((channel) => Math.round(channel * (1 - ratio)));

export const rgbToCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

export const getProgressFillGradient = (progress) => {
  const normalized = clampPercent(progress);
  let start = PROGRESS_COLOR_STOPS[0];
  let end = PROGRESS_COLOR_STOPS[PROGRESS_COLOR_STOPS.length - 1];

  for (let index = 0; index < PROGRESS_COLOR_STOPS.length - 1; index += 1) {
    const current = PROGRESS_COLOR_STOPS[index];
    const next = PROGRESS_COLOR_STOPS[index + 1];
    if (normalized <= next.point) {
      start = current;
      end = next;
      break;
    }
  }

  const segmentRange = end.point - start.point || 1;
  const segmentRatio = (normalized - start.point) / segmentRange;
  const mixed = mixRgb(start.color, end.color, segmentRatio);
  const lighter = tintRgb(mixed, 0.22);
  const darker = shadeRgb(mixed, 0.1);

  return `linear-gradient(90deg, ${rgbToCss(lighter)} 0%, ${rgbToCss(mixed)} 56%, ${rgbToCss(darker)} 100%)`;
};

export const getRecentStudyGroups = (account, limit = 2) => {
  const rawGroups = [
    ...toArray(account?.recent_study_groups),
    ...toArray(account?.study_groups),
    ...toArray(account?.joined_groups),
    ...toArray(account?.groups),
    ...toArray(account?.group_memberships),
    ...toArray(account?.memberships),
  ].filter(Boolean);

  if (!rawGroups.length) return [];

  const normalized = rawGroups
    .map((entry, index) => {
      const group = entry?.group && typeof entry.group === "object" ? entry.group : entry;
      const name = String(
        group?.name ||
          group?.group_name ||
          group?.title ||
          entry?.name ||
          entry?.group_name ||
          entry?.title ||
          ""
      ).trim();

      if (!name) return null;

      const id =
        group?.id ||
        entry?.group_id ||
        entry?.id ||
        group?.slug ||
        `${name.toLowerCase().replace(/\s+/g, "-")}-${index}`;

      const activeMembersRaw =
        group?.active_members ??
        group?.members_count ??
        group?.member_count ??
        entry?.active_members ??
        entry?.members_count ??
        entry?.member_count;
      const activeMembers = Number.isFinite(Number(activeMembersRaw)) ? Number(activeMembersRaw) : null;
      const totalMembersRaw =
        group?.total_members ??
        group?.totalMembers ??
        group?.members_count ??
        group?.member_count ??
        group?.members ??
        entry?.total_members ??
        entry?.totalMembers ??
        entry?.members_count ??
        entry?.member_count ??
        entry?.members;
      const totalMembers = Number.isFinite(Number(totalMembersRaw))
        ? Math.max(0, Number(totalMembersRaw))
        : activeMembers;
      const status =
        activeMembers !== null
          ? `${activeMembers} active now`
          : String(group?.status || entry?.status || "Study group activity").trim();

      const privacyValue = String(
        group?.privacy || group?.group_privacy || entry?.privacy || entry?.group_privacy || ""
      ).toLowerCase();
      const isPrivate = Boolean(group?.is_private ?? entry?.is_private) || privacyValue === "private";
      const membershipValue = normalizeType(entry?.membership_status || entry?.join_status || "");
      const access = isPrivate ? "Private" : membershipValue.includes("invite") ? "Invite" : "Open";

      const joinedAt = parseDateValue(
        entry?.joined_at ||
          entry?.joinedAt ||
          entry?.updated_at ||
          entry?.updatedAt ||
          entry?.last_activity_at ||
          entry?.lastActivityAt ||
          group?.joined_at ||
          group?.joinedAt ||
          group?.updated_at ||
          group?.updatedAt ||
          group?.last_activity_at ||
          group?.lastActivityAt
      );
      const createdAtRaw =
        group?.created_at ||
        group?.createdAt ||
        group?.created_on ||
        group?.createdOn ||
        entry?.created_at ||
        entry?.createdAt ||
        entry?.created_on ||
        entry?.createdOn ||
        "";
      const createdAt = parseDateValue(createdAtRaw);

      return {
        id: String(id),
        name,
        status,
        access,
        totalMembers,
        createdAt,
        createdLabel: formatGroupCreatedDate(createdAtRaw),
        image:
          group?.avatar_url ||
          group?.image_url ||
          group?.image ||
          entry?.avatar_url ||
          entry?.image_url ||
          entry?.image ||
          LOGO_SRC,
        joinedAt,
      };
    })
    .filter(Boolean);

  const deduped = new Map();
  normalized.forEach((item) => {
    const key = item.id.toLowerCase() || item.name.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || item.joinedAt >= existing.joinedAt) {
      deduped.set(key, item);
    }
  });

  return [...deduped.values()]
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .slice(0, limit);
};

export const normalizeMatchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const getMatchTokens = (value = "") => normalizeMatchText(value).split(/\s+/).filter(Boolean);

export const hasTokenOverlap = (left = "", right = "") => {
  const leftTokens = getMatchTokens(left);
  const rightSet = new Set(getMatchTokens(right));
  if (!leftTokens.length || !rightSet.size) return false;
  return leftTokens.some((token) => rightSet.has(token));
};

export const getCourseRecommendation = ({ account, programLabel = "", levelValue = "100" } = {}) => {
  const courseSources = [
    ...toArray(account?.recommended_courses),
    ...toArray(account?.next_courses),
    ...toArray(account?.courses),
    ...toArray(account?.enrolled_courses),
  ];

  const matched = courseSources
    .map((entry) => {
      const course = entry?.course && typeof entry.course === "object" ? entry.course : entry;
      const title = String(
        course?.title || course?.course_title || course?.name || course?.course_name || entry?.title || ""
      ).trim();
      if (!title) return null;

      const code = getDisplayCourseCode(
        {
          ...course,
          code:
            course?.code ||
            course?.course_code ||
            entry?.code ||
            entry?.course_code ||
            course?.short_code ||
            "",
        },
        ""
      );
      const creditsRaw =
        course?.credits ||
        course?.credit ||
        course?.credit_hours ||
        entry?.credits ||
        entry?.credit ||
        "2/3";
      const creditsText = String(creditsRaw).trim();

      return {
        title: toTitleCase(title),
        code,
        credits: creditsText.includes("credit") ? creditsText : `${creditsText} credits`,
      };
    })
    .filter(Boolean);

  if (matched.length) {
    const first = matched[0];
    return {
      title: first.title,
      code: first.code || "EBS 105",
      credits: first.credits || "2/3 credits",
      audience: toTitleCase(programLabel || "Students"),
    };
  }

  const levelDigits = String(levelValue || "100").match(/\d+/)?.[0] || "100";
  const baseProgram = String(programLabel || "").split("(")[0].trim() || "Foundational Studies";
  return {
    title: `Introduction to ${toTitleCase(baseProgram)}`,
    code: `SHR ${levelDigits}`,
    credits: "2/3 credits",
    audience: toTitleCase(programLabel || "Students"),
  };
};

export const RECOMMENDED_GROUP_POOL = [
  {
    id: "rec-group-performing-primary-1",
    name: "Primary Arts Practicum Circle",
    status: "16 active now",
    access: "Open",
    totalMembers: 62,
    createdAt: "2025-09-12",
    college: "Foso College of Education",
    program: "Performing Arts (Primary)",
    level: "100",
    location: "Cape Coast",
    image: `${import.meta.env.BASE_URL}group-1.jpg`,
  },
  {
    id: "rec-group-performing-primary-2",
    name: "Creative Teaching Methods Hub",
    status: "11 active now",
    access: "Invite",
    totalMembers: 47,
    createdAt: "2025-10-04",
    college: "Foso College of Education",
    program: "Performing Arts (Primary)",
    level: "200",
    location: "Cape Coast",
    image: `${import.meta.env.BASE_URL}learn.jpg`,
  },
  {
    id: "rec-group-general-1",
    name: "Level 100 Academic Boost",
    status: "21 active now",
    access: "Open",
    totalMembers: 95,
    createdAt: "2025-08-28",
    college: "Education Colleges Network",
    program: "General Education",
    level: "100",
    location: "Central Region",
    image: `${import.meta.env.BASE_URL}test-2.jpg`,
  },
  {
    id: "rec-group-general-2",
    name: "Campus Study Accountability Crew",
    status: "14 active now",
    access: "Invite",
    totalMembers: 51,
    createdAt: "2025-11-16",
    college: "Inter-College Collaborative",
    program: "Learning Skills",
    level: "All Levels",
    location: "Ghana",
    image: LOGO_SRC,
  },
];

export const getRecommendedStudyGroups = (
  { college = "", program = "", level = "", location = "" } = {},
  limit = 2
) => {
  const collegeText = normalizeMatchText(college);
  const programText = normalizeMatchText(program);
  const levelText = normalizeMatchText(level);
  const locationText = normalizeMatchText(location);

  const scored = RECOMMENDED_GROUP_POOL.map((group) => {
    let score = 0;
    const groupCollege = normalizeMatchText(group.college);
    const groupProgram = normalizeMatchText(group.program);
    const groupLevel = normalizeMatchText(group.level);
    const groupLocation = normalizeMatchText(group.location);

    if (collegeText && groupCollege) {
      if (groupCollege === collegeText) score += 70;
      else if (groupCollege.includes(collegeText) || collegeText.includes(groupCollege)) score += 52;
      else if (hasTokenOverlap(groupCollege, collegeText)) score += 30;
    }

    if (programText && groupProgram) {
      if (groupProgram === programText) score += 46;
      else if (groupProgram.includes(programText) || programText.includes(groupProgram)) score += 32;
      else if (hasTokenOverlap(groupProgram, programText)) score += 18;
    }

    if (levelText && groupLevel) {
      if (groupLevel === levelText) score += 24;
      else if (groupLevel.includes(levelText) || levelText.includes(groupLevel)) score += 14;
    }

    if (locationText && groupLocation) {
      if (groupLocation === locationText) score += 20;
      else if (groupLocation.includes(locationText) || locationText.includes(groupLocation)) score += 12;
      else if (hasTokenOverlap(groupLocation, locationText)) score += 7;
    }

    return { ...group, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.totalMembers - a.totalMembers)
    .slice(0, limit)
    .map((group) => ({
      id: group.id,
      name: group.name,
      status: group.status,
      access: group.access,
      totalMembers: group.totalMembers,
      createdAt: parseDateValue(group.createdAt),
      createdLabel: formatGroupCreatedDate(group.createdAt),
      image: group.image || LOGO_SRC,
    }));
};

export const getModalReactionSeed = (key) => {
  const seeds = {
    quote: { likes: 268, comments: 44, shares: 19 },
    fact: { likes: 198, comments: 35, shares: 12 },
    joke: { likes: 236, comments: 29, shares: 27 },
    article: { likes: 142, comments: 22, shares: 14 },
    story: { likes: 159, comments: 18, shares: 20 },
  };

  return seeds[key] || { likes: 120, comments: 16, shares: 10 };
};

export const normalizeCategoryText = (value = "") => normalizeType(value).replace(/\s+/g, "_");

export const getContentImage = (item) =>
  item?.featured_image || item?.thumbnail_url || item?.metadata?.featured_image || item?.metadata?.image || null;

export const getContentBody = (item, fallback = "Content details coming soon.") =>
  item?.full_text ||
  item?.metadata?.body ||
  item?.metadata?.content ||
  item?.content ||
  item?.description ||
  fallback;

export const getContentPreview = (item, fallback = "") =>
  item?.description || item?.metadata?.summary || item?.content || item?.title || fallback;
export const getContentAuthor = (item, fallback = "Unknown author") =>
  item?.metadata?.author ||
  item?.author_name ||
  item?.creator_name ||
  item?.creator?.full_name ||
  fallback;

export const getContentUploader = (item, fallback = "Learnda Daily") =>
  item?.uploader_name ||
  item?.uploaded_by ||
  item?.creator_name ||
  item?.creator?.full_name ||
  item?.author_name ||
  fallback;

export const getHighlightStateKey = (slotKey, item, fallback = "") => {
  const identity =
    item?.id ||
    item?.content_id ||
    item?.slug ||
    item?.uuid ||
    item?.title ||
    item?.name ||
    fallback;
  const normalizedIdentity = normalizeType(String(identity || ""));
  return normalizedIdentity ? `${slotKey}:${normalizedIdentity}` : slotKey;
};

export const getReactionCountsFromItem = (item, key) => {
  const fallback = getModalReactionSeed(key);
  return {
    likes: Number(item?.stats?.like_count ?? fallback.likes),
    comments: Number(item?.comment_count ?? fallback.comments),
    shares: Number(item?.stats?.share_count ?? fallback.shares),
  };
};

export const toHomeTrendingText = (value = "") => String(value ?? "").trim();
export const normalizeHomeTrendingText = (value = "") => toHomeTrendingText(value).toLowerCase();
export const toHomeTrendingNumber = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
export const getHomeTrendingCourseId = (course = {}) =>
  String(course.id || course.course_id || course.uuid || course.slug || "").trim();

export const getHomeTrendingCourseTitle = (course = {}) =>
  toTitleCase(course.title || course.name || course.course_title || course.course_name || "Untitled Course");

export const getHomeTrendingCourseCode = (course = {}) =>
  getDisplayCourseCode(course, "N/A");

export const getHomeTrendingCourseCreditsText = (course = {}) => {
  const raw = course.credits ?? course.credit ?? course.credit_hours;
  const text = toHomeTrendingText(raw);
  if (!text) return "3 Credits";
  return /credit/i.test(text) ? text : `${text} Credits`;
};

export const getHomeTrendingCoursePrograms = (course = {}) => {
  const fromPrograms = toArray(course.programs).map((item) =>
    typeof item === "string" ? item : item?.name || item?.title || item?.program_name || ""
  );
  const fromProgramField = [course.program, course.program_name, course.department].filter(Boolean);
  return [...fromPrograms, ...fromProgramField].map(toTitleCase).filter(Boolean);
};

export const getHomeTrendingCourseLevels = (course = {}) => {
  const fromArray = toArray(course.levels).map((level) => String(level));
  const fromSingle = [course.level, course.study_level].filter(Boolean).map(String);
  const unique = [...new Set([...fromArray, ...fromSingle].map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique : ["General"];
};

export const getHomeTrendingCourseSemesters = (course = {}) => {
  const fromArray = toArray(course.semesters).map((semester) => String(semester));
  const fromSingle = [course.semester, course.current_semester].filter(Boolean).map(String);
  const unique = [...new Set([...fromArray, ...fromSingle].map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique : ["1"];
};

export const getHomeTrendingCourseImage = (course = {}, index = 0) =>
  course.thumbnail_url ||
  course.image_url ||
  course.cover_image ||
  course.image ||
  HOME_TRENDING_COURSE_FALLBACK_IMAGES[index % HOME_TRENDING_COURSE_FALLBACK_IMAGES.length];

export const buildHomeTrendingCourseCardModel = (course = {}, index = 0) => {
  const textLessonsFallback =
    typeof course?.text_lessons_count === 'number'
      ? null
      : toHomeTrendingNumber(course.totalLessons ?? course.lessons_count ?? course.lesson_count, NaN);

  const lessons = Math.max(
    0,
    Math.round(
      toHomeTrendingNumber(
        course.text_lessons_count,
        Number.isFinite(textLessonsFallback) ? Math.max(textLessonsFallback, 0) : 0,
      ),
    ),
  );
  const exercises = Math.max(
    0,
    Math.round(
      toHomeTrendingNumber(
        course.lesson_exercises_count,
        course.totalExercises ??
          course.exercises_count ??
          course.exercise_count ??
          course.quiz_count ??
          course.quizzes_count ??
          0,
      ),
    ),
  );
  const videos = Math.max(
    0,
    Math.round(
      toHomeTrendingNumber(course.video_lessons_count, course.video_count ?? course.videos_count ?? course.totalVideos ?? 0),
    ),
  );

  return {
    id: getHomeTrendingCourseId(course),
    title: getHomeTrendingCourseTitle(course),
    code: getHomeTrendingCourseCode(course),
    creditsText: getHomeTrendingCourseCreditsText(course),
    programs: getHomeTrendingCoursePrograms(course),
    levels: getHomeTrendingCourseLevels(course),
    semesters: getHomeTrendingCourseSemesters(course),
    image: getHomeTrendingCourseImage(course, index),
    imageFallback: HOME_TRENDING_COURSE_FALLBACK_IMAGES[index % HOME_TRENDING_COURSE_FALLBACK_IMAGES.length],
    lessons,
    exercises,
    videos,
    trendingScore:
      toHomeTrendingNumber(course.rating, 0) * 22 +
      toHomeTrendingNumber(course.enrolled_count ?? course.enrollment_count ?? course.popularity, 0) * 0.05 +
      toHomeTrendingNumber(course.offerings_count, 0) * 8 +
      toHomeTrendingNumber(course.completedLessons ?? course.completed_lessons, 0),
  };
};

export const formatHomeTrendingFileSizeLabel = (value) => {
  const bytes = toHomeTrendingNumber(value, 0);
  if (bytes <= 0) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const converted = bytes / 1024 ** index;
  const rounded = converted >= 10 ? Math.round(converted) : Math.round(converted * 10) / 10;
  return `${rounded} ${units[index]}`;
};

export const getHomeTrendingQuestionTypeLabel = ({ title = "", category = "", tags = [] } = {}) => {
  const source = `${title} ${category} ${toArray(tags).join(" ")}`.toLowerCase();
  if (source.includes("outline")) return "Outline";
  if (source.includes("answer") || source.includes("solution") || source.includes("worked")) return "Answer";
  if (source.includes("exam")) return "Exam";
  if (source.includes("quiz") || source.includes("test")) return "Quiz";
  return "Exam";
};

export const getHomeTrendingQuestionTone = (label = "") => {
  const value = String(label).toLowerCase();
  if (value.includes("outline")) return "outline";
  if (value.includes("answer")) return "answer";
  if (value.includes("exam")) return "exam";
  if (value.includes("quiz")) return "quiz";
  return "quiz";
};

export const getHomeTrendingFileSubTypeLabel = ({ title = "", category = "", tags = [] } = {}) => {
  const source = `${title} ${category} ${toArray(tags).join(" ")}`.toLowerCase().replace(/\s+/g, " ");
  if (source.includes("external")) return "External";
  if (source.includes("internal")) return "Internal";
  if (source.includes("sect a") || source.includes("section a") || source.includes("set a")) return "Section A";
  if (source.includes("sect b") || source.includes("section b") || source.includes("set b")) return "Section B";
  if (source.includes("outline")) return "Outline";
  return "Internal";
};

export const getHomeTrendingFileSubTypeDisplay = ({ subType = "", questionType = "" } = {}) => {
  const normalizedSubType = String(subType).trim();
  const normalizedQuestion = String(questionType).trim();

  if (/outline/i.test(normalizedSubType) || /outline/i.test(normalizedQuestion)) return "Course Outline";
  if (/external/i.test(normalizedSubType)) return `External ${normalizedQuestion || "Quiz"}`.trim();
  if (/internal/i.test(normalizedSubType)) return `Internal ${normalizedQuestion || "Quiz"}`.trim();
  if (/section\s*[ab]/i.test(normalizedSubType)) return `${normalizedSubType} ${normalizedQuestion || "Exam"}`.trim();
  return normalizedSubType || normalizedQuestion || "Internal Quiz";
};

export const getHomeTrendingFileYearLabel = ({ year = "", title = "", createdAt = "", uploadedAt = "" } = {}) => {
  const explicitYear = String(year || "").trim();
  if (/^(19|20)\d{2}$/.test(explicitYear)) return explicitYear;

  const titleMatch = String(title).match(/\b(19|20)\d{2}\b/);
  if (titleMatch) return titleMatch[0];

  const dateValue = createdAt || uploadedAt;
  const date = new Date(dateValue);
  if (!Number.isNaN(date.getTime())) return String(date.getFullYear());

  return String(new Date().getFullYear());
};

export const normalizeHomeTrendingLevelKey = (value = "") => {
  const normalized = toHomeTrendingText(value);
  const digits = normalized.match(/\d+/)?.[0];
  return digits ? digits : normalized || "General";
};

export const buildHomeTrendingFileCardModel = (file = {}, index = 0, courseMetaMap = new Map(), normalizedCourses = []) => {
  const rawTitle = toHomeTrendingText(file?.title || file?.file_name || `File ${index + 1}`);
  const rawCourseName = toHomeTrendingText(file?.course || file?.course_name || file?.subject || "General Studies");
  const fallbackCourseName =
    rawCourseName || normalizedCourses[index % (normalizedCourses.length || 1)]?.title || "General Studies";
  const resolvedCourse = courseMetaMap.get(normalizeHomeTrendingText(fallbackCourseName));
  const category = toHomeTrendingText(file?.category || file?.type || file?.file_category);
  const tags = toArray(file?.tags);
  const questionType = getHomeTrendingQuestionTypeLabel({ title: rawTitle, category, tags });
  const questionTone = getHomeTrendingQuestionTone(questionType);
  const subType = getHomeTrendingFileSubTypeDisplay({
    subType: getHomeTrendingFileSubTypeLabel({ title: rawTitle, category, tags }),
    questionType,
  });

  const downloads = Math.max(
    0,
    Math.round(toHomeTrendingNumber(file?.downloads ?? file?.download_count ?? file?.stats?.downloads, 0))
  );
  const views = Math.max(0, Math.round(toHomeTrendingNumber(file?.views ?? file?.view_count ?? file?.stats?.views, 0)));
  const resolvedDownloads =
    downloads > 0 ? downloads : HOME_TRENDING_FILE_PREVIEW_DOWNLOAD_COUNTS[index % HOME_TRENDING_FILE_PREVIEW_DOWNLOAD_COUNTS.length];
  const resolvedViews =
    views > 0 ? views : HOME_TRENDING_FILE_PREVIEW_VIEW_COUNTS[index % HOME_TRENDING_FILE_PREVIEW_VIEW_COUNTS.length];
  const uploadedAt = file?.uploaded_at || file?.created_at || "";
  const uploadedDate = new Date(uploadedAt);
  const recencyBoost = Number.isNaN(uploadedDate.getTime())
    ? 0
    : Math.max(0, 365 - Math.floor((Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    id: String(file?.id || `${normalizeHomeTrendingText(rawTitle).replace(/\s+/g, "-")}-${index + 1}`),
    sourceFileId: file?.id || "",
    fileName: toHomeTrendingText(file?.file_name || `${rawTitle}.pdf`),
    title: toTitleCase(rawTitle),
    courseName: toTitleCase(fallbackCourseName),
    courseCode: getDisplayCourseCode(
      {
        ...(resolvedCourse || {}),
        course_code: file?.course_code || resolvedCourse?.course_code,
        code: resolvedCourse?.code || file?.course_code,
      },
      "CRS 100"
    ),
    creditsText:
      resolvedCourse?.creditsText ||
      (toHomeTrendingText(file?.credit || file?.credits)
        ? `${toHomeTrendingText(file?.credit || file?.credits)} Credits`
        : "2 Credits"),
    questionType,
    questionTone,
    uploader: toTitleCase(
      file?.uploader || file?.uploader_name || file?.uploaded_by || file?.creator_name || "Learnda Creator"
    ),
    year: getHomeTrendingFileYearLabel({
      year: file?.year,
      title: rawTitle,
      createdAt: file?.created_at,
      uploadedAt: file?.uploaded_at,
    }),
    subType,
    downloads: resolvedDownloads,
    views: resolvedViews,
    fileSize:
      formatHomeTrendingFileSizeLabel(file?.file_size || file?.size) ||
      HOME_TRENDING_FILE_PREVIEW_SIZES[index % HOME_TRENDING_FILE_PREVIEW_SIZES.length],
    levels: [...new Set([toHomeTrendingText(file?.level), ...(resolvedCourse?.levels || [])].map(normalizeHomeTrendingLevelKey).filter(Boolean))],
    semesters: [
      ...new Set(
        [toHomeTrendingText(file?.semester), ...(resolvedCourse?.semesters || [])]
          .map(normalizeHomeTrendingLevelKey)
          .filter(Boolean)
      ),
    ],
    programs: [
      ...new Set(
        [...toArray(file?.programs), ...toArray(resolvedCourse?.programs), toHomeTrendingText(file?.program), toHomeTrendingText(file?.department)]
          .map((value) => (typeof value === "string" ? value : value?.name || value?.title || ""))
          .map(toTitleCase)
          .filter(Boolean)
      ),
    ],
    isPremium: Boolean(file?.is_premium),
    fileUrl: file?.file_url || file?.url || "",
    trendingScore: resolvedViews * 0.62 + resolvedDownloads * 1.2 + recencyBoost * 0.4,
  };
};


export const resolveHomeTrendingEdutCategory = (item = {}) => {
  const normalizedCategory = normalizeType(
    item.normalized_category || item?.metadata?.normalized_category || item.category || item?.metadata?.category || ""
  );
  if (normalizedCategory === "articles") return "articles";
  if (normalizedCategory === "stories") return "stories";
  if (normalizedCategory === "facts") return "facts";
  if (normalizedCategory === "quotes") return "quotes";
  if (normalizedCategory === "jocular") return "jocular";

  const tone = normalizeType(item.tone || item?.metadata?.tone || "");
  if (tone === "article") return "articles";
  if (tone === "story") return "stories";
  if (tone === "fact") return "facts";
  if (tone === "quote") return "quotes";
  if (tone === "joke") return "jocular";

  const source = `${item.type || ""} ${item.category || ""} ${toArray(item.tags).join(" ")} ${item.title || ""}`.toLowerCase();
  if (source.includes("joke") || source.includes("jocular") || source.includes("humor") || source.includes("humour")) {
    return "jocular";
  }
  if (source.includes("did-you-know") || source.includes("did you know") || source.includes("fact")) return "facts";
  if (source.includes("story")) return "stories";
  if (source.includes("quote")) return "quotes";
  return "articles";
};

export const formatCommentDate = (value) => {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
