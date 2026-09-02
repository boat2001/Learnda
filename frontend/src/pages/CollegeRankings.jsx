import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiBarChart2, FiBookOpen, FiClipboard,
  FiFeather, FiGlobe, FiHome, FiMapPin,
  FiSearch, FiStar, FiSun, FiTrendingUp, FiUsers,
} from 'react-icons/fi';
import api from '../services/api';
import { GUEST_COLLEGES, LOGO_SRC } from './Home/homeUtils';
import './SharedPages.css';
import './CollegeRankings.css';

const CURRENT_YEAR = new Date().getFullYear();

const normalizeName = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const CATEGORIES = [
  { key: 'overall',           icon: FiBarChart2, label: 'Overall',             description: 'Balanced score across all public-signal ranking lenses' },
  { key: 'academics',         icon: FiBookOpen,  label: 'Academics',           description: 'Programme breadth, legacy, and academic structure' },
  { key: 'infrastructure',    icon: FiHome,      label: 'Infrastructure',      description: 'Campus readiness, access, and physical support systems' },
  { key: 'college_operation', icon: FiClipboard, label: 'College Operation',   description: 'Institutional maturity, delivery, and steady administration' },
  { key: 'student_behaviour', icon: FiUsers,     label: 'Student Behaviour',   description: 'Mission culture, conduct signals, and campus discipline' },
  { key: 'environment',       icon: FiSun,       label: 'Environment',         description: 'Setting, calm, and the quality of the learning atmosphere' },
  { key: 'alumni_impact',     icon: FiGlobe,     label: 'Alumni Impact',       description: 'Graduate visibility, reach, and institutional legacy' },
  { key: 'sports',            icon: FiActivity,  label: 'Sports',              description: 'Public campus activity, visibility, and sporting culture' },
  { key: 'popularity',        icon: FiStar,      label: 'Popularity',          description: 'Public pull, recognition, and student-facing visibility' },
  { key: 'beauty',            icon: FiFeather,   label: 'Beauty and Gentility',description: 'Orderliness, aesthetics, and campus elegance' },
];

const CATEGORY_WEIGHTS = {
  academics: 1.3,
  infrastructure: 1.1,
  college_operation: 1.05,
  student_behaviour: 0.95,
  environment: 0.95,
  alumni_impact: 1.1,
  sports: 0.8,
  popularity: 1,
  beauty: 0.85,
};

const FOOTPRINT_SIGNAL_MAP = {
  metro: 1,
  coastal_capital: 0.98,
  regional_capital: 0.92,
  highland_town: 0.84,
  district_hub: 0.75,
  campus_town: 0.66,
};

const FOOTPRINT_LABELS = {
  metro: 'Major urban footprint',
  coastal_capital: 'Coastal capital visibility',
  regional_capital: 'Regional capital presence',
  highland_town: 'Highland learning-town presence',
  district_hub: 'District-hub access',
  campus_town: 'Campus-town identity',
};

const CAMPUS_SIGNAL_MAP = {
  coastal: 1,
  highlands: 0.95,
  garden_city: 0.9,
  ridge_town: 0.82,
  urban: 0.78,
  town: 0.72,
};

const CAMPUS_LABELS = {
  coastal: 'Coastal campus setting',
  highlands: 'Highland campus setting',
  garden_city: 'Garden-city campus character',
  ridge_town: 'Elevated town-campus feel',
  urban: 'Urban campus rhythm',
  town: 'Town-campus calm',
};

const STATUS_SIGNAL_MAP = {
  university_unit: 1,
  public: 0.88,
  public_absorbed: 0.82,
  private: 0.72,
};

const STATUS_LABELS = {
  university_unit: 'Direct university academic unit',
  public: 'Public college structure',
  public_absorbed: 'Recently absorbed public structure',
  private: 'Private teacher-education structure',
};

const HERITAGE_SIGNAL_MAP = {
  university: 1,
  catholic: 0.92,
  presbyterian: 0.9,
  anglican: 0.86,
  sda: 0.84,
  ecumenical: 0.8,
  public: 0.74,
};

const HERITAGE_LABELS = {
  university: 'University-led academic heritage',
  catholic: 'Catholic education heritage',
  presbyterian: 'Presbyterian education heritage',
  anglican: 'Anglican education heritage',
  sda: 'SDA education heritage',
  ecumenical: 'Faith-based education heritage',
  public: 'Public education heritage',
};

const SPORTS_SIGNAL_MAP = {
  strong: 1,
  active: 0.82,
  growing: 0.68,
};

const SPORTS_LABELS = {
  strong: 'Strong public sports visibility',
  active: 'Active public sports culture',
  growing: 'Growing sports visibility',
};

const PUBLIC_SIGNAL_OVERRIDES = {
  [normalizeName('Abetifi Presbyterian College of Education')]: {
    foundedYear: 1952,
    footprint: 'highland_town',
    campusSetting: 'highlands',
    heritage: 'presbyterian',
    sportsCulture: 'active',
  },
  [normalizeName('Atebubu College of Education')]: {
    foundedYear: 1965,
    footprint: 'district_hub',
    campusSetting: 'town',
    heritage: 'public',
    sportsCulture: 'growing',
  },
  [normalizeName('Berekum College of Education')]: {
    foundedYear: 1953,
    footprint: 'district_hub',
    campusSetting: 'town',
    heritage: 'public',
    sportsCulture: 'active',
  },
  [normalizeName('Christ the Teacher College of Education')]: {
    foundedYear: 2014,
    footprint: 'metro',
    campusSetting: 'garden_city',
    heritage: 'catholic',
    status: 'private',
    sportsCulture: 'growing',
  },
  [normalizeName('Foso College of Education')]: {
    foundedYear: 1965,
    footprint: 'district_hub',
    campusSetting: 'town',
    heritage: 'public',
    sportsCulture: 'active',
  },
  [normalizeName('Holy Child College of Education')]: {
    foundedYear: 1946,
    footprint: 'coastal_capital',
    campusSetting: 'coastal',
    heritage: 'catholic',
    womenFocused: true,
    sportsCulture: 'active',
  },
  [normalizeName('Holy Spirit College of Education')]: {
    footprint: 'regional_capital',
    campusSetting: 'highlands',
    heritage: 'catholic',
    status: 'private',
    sportsCulture: 'active',
  },
  [normalizeName('Jasikan College of Education')]: {
    foundedYear: 1952,
    footprint: 'highland_town',
    campusSetting: 'highlands',
    heritage: 'public',
    sportsCulture: 'active',
  },
  [normalizeName('Kibi College of Education')]: {
    foundedYear: 1963,
    footprint: 'highland_town',
    campusSetting: 'highlands',
    heritage: 'presbyterian',
    sportsCulture: 'active',
  },
  [normalizeName('Nsawkaw College of Education')]: {
    footprint: 'district_hub',
    campusSetting: 'town',
    heritage: 'public',
    sportsCulture: 'growing',
  },
  [normalizeName('Offinso College of Education')]: {
    foundedYear: 1955,
    footprint: 'district_hub',
    campusSetting: 'garden_city',
    heritage: 'public',
    sportsCulture: 'active',
  },
  [normalizeName('OLA College of Education')]: {
    foundedYear: 1924,
    footprint: 'coastal_capital',
    campusSetting: 'coastal',
    heritage: 'catholic',
    womenFocused: true,
    sportsCulture: 'active',
  },
  [normalizeName('SDA College of Education')]: {
    foundedYear: 1962,
    footprint: 'district_hub',
    campusSetting: 'ridge_town',
    heritage: 'sda',
    status: 'private',
    sportsCulture: 'active',
  },
  [normalizeName('St. Ambrose College of Education')]: {
    foundedYear: 2009,
    footprint: 'district_hub',
    campusSetting: 'town',
    heritage: 'catholic',
    status: 'public_absorbed',
    sportsCulture: 'growing',
  },
  [normalizeName('St. Francis College of Education')]: {
    foundedYear: 1912,
    footprint: 'highland_town',
    campusSetting: 'highlands',
    heritage: 'catholic',
    sportsCulture: 'active',
  },
  [normalizeName("St. Monica's College of Education")]: {
    foundedYear: 1930,
    footprint: 'district_hub',
    campusSetting: 'garden_city',
    heritage: 'anglican',
    womenFocused: true,
    sportsCulture: 'active',
  },
  [normalizeName("St. Teresa's College of Education")]: {
    foundedYear: 1961,
    footprint: 'highland_town',
    campusSetting: 'highlands',
    heritage: 'catholic',
    womenFocused: true,
    sportsCulture: 'active',
  },
  [normalizeName('UCC College of Education Studies')]: {
    foundedYear: 1962,
    footprint: 'coastal_capital',
    campusSetting: 'coastal',
    heritage: 'university',
    status: 'university_unit',
    sportsCulture: 'strong',
  },
};

const COLLEGE_ALIAS_GROUPS = {
  [normalizeName('Abetifi Presbyterian College of Education')]: [
    'Abetifi College of Education',
    'Abetifi Presbyterian CoE',
    'Abetifi College of Education, Kwahu Abetifi',
  ],
  [normalizeName('Atebubu College of Education')]: [
    'Atebubu CoE',
    'Atebubu College of Education, Atebubu',
  ],
  [normalizeName('Berekum College of Education')]: [
    'Berekum CoE',
    'Berekum College of Education, Berekum',
  ],
  [normalizeName('Christ the Teacher College of Education')]: [
    'Christ the Teacher CoE',
    'Christ Teacher College of Education',
  ],
  [normalizeName('Foso College of Education')]: [
    'Foso College of Education, Assin Foso',
    'Foso CoE',
  ],
  [normalizeName('Holy Child College of Education')]: [
    'Holy Child College of Education, Takoradi',
    'Holy Child CoE',
  ],
  [normalizeName('Holy Spirit College of Education')]: [
    'Holy Spirit College of Education, Ho',
    'Holy Spirit CoE',
  ],
  [normalizeName('Jasikan College of Education')]: [
    'Jasikan CoE',
  ],
  [normalizeName('Kibi College of Education')]: [
    'Kibi Presbyterian College of Education',
    'Kibi Presbyterian CoE',
    'Kibi College of Education, Kibi',
  ],
  [normalizeName('Nsawkaw College of Education')]: [
    'Nsawkaw CoE',
  ],
  [normalizeName('Offinso College of Education')]: [
    'Offinso College of Education, Offinso',
    'Offinso CoE',
  ],
  [normalizeName('OLA College of Education')]: [
    'OLA College of Education, Cape Coast',
    'Our Lady of Apostles College of Education',
    'Our Lady of Apostles (OLA) College of Education',
  ],
  [normalizeName('SDA College of Education')]: [
    'Agona SDA College of Education',
    'SDA College of Education, Agona',
    'Seventh Day Adventist College of Education',
  ],
  [normalizeName('St. Ambrose College of Education')]: [
    'Saint Ambrose College of Education',
    'St Ambrose College of Education',
  ],
  [normalizeName('St. Francis College of Education')]: [
    'Saint Francis College of Education',
    'St Francis College of Education',
  ],
  [normalizeName("St. Monica's College of Education")]: [
    'Saint Monicas College of Education',
    'St Monica College of Education',
    "St Monica's College of Education, Mampong",
  ],
  [normalizeName("St. Teresa's College of Education")]: [
    'Saint Teresas College of Education',
    'St Teresa College of Education',
    "St Teresa's College of Education, Hohoe",
  ],
  [normalizeName('UCC College of Education Studies')]: [
    'University of Cape Coast College of Education Studies',
    'UCC College of Education Studies, Cape Coast',
  ],
};

const COLLEGE_ALIAS_LOOKUP = (() => {
  const lookup = {};

  GUEST_COLLEGES.forEach((college) => {
    const canonicalKey = normalizeName(college.name);
    lookup[canonicalKey] = canonicalKey;
  });

  Object.entries(COLLEGE_ALIAS_GROUPS).forEach(([canonicalKey, aliases]) => {
    lookup[canonicalKey] = canonicalKey;
    aliases.forEach((alias) => {
      lookup[normalizeName(alias)] = canonicalKey;
    });
  });

  return lookup;
})();

const DEFAULT_AFFILIATION_LOOKUP = GUEST_COLLEGES.reduce((accumulator, college) => {
  accumulator[normalizeName(college.name)] = college.affiliation || null;
  return accumulator;
}, {
  [normalizeName('UCC College of Education Studies')]: 'University of Cape Coast',
});

const stripLocationSuffix = (value = '') =>
  normalizeName(value)
    .replace(/\b(cape coast|takoradi|kumasi|hohoe|ho|kwahu abetifi|kwahu|assin foso|agona|mampong|asokore)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveCollegeKey = (record = {}) => {
  const candidates = [record.name, record.alias, record.index_code].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    if (COLLEGE_ALIAS_LOOKUP[normalized]) {
      return COLLEGE_ALIAS_LOOKUP[normalized];
    }

    const stripped = stripLocationSuffix(candidate);
    if (COLLEGE_ALIAS_LOOKUP[stripped]) {
      return COLLEGE_ALIAS_LOOKUP[stripped];
    }
  }

  return normalizeName(record.name);
};

const createGuestCollegeRecord = (college) => ({
  id: college.id,
  name: college.name,
  alias: null,
  index_code: null,
  affiliate_university: college.affiliation,
  motto: null,
  description: `${college.name} serves teacher trainees with ${college.programs.join(', ')} programmes on Sharether.`,
  image_url: college.image,
  image_alt: college.name,
  est_date: null,
  region: null,
  location_label: college.established,
  programs: college.programs || [],
});

const mergeCollegeRecords = (guestRecord, apiRecord) => {
  const base = guestRecord || {};
  const incoming = apiRecord || {};
  const resolvedKey = resolveCollegeKey({ name: incoming.name || base.name });

  return {
    ...base,
    ...incoming,
    name: base.name || incoming.name,
    affiliate_university:
      incoming.affiliate_university ||
      base.affiliate_university ||
      DEFAULT_AFFILIATION_LOOKUP[resolvedKey] ||
      null,
    description: incoming.description || base.description || null,
    image_url: incoming.image_url || base.image_url || null,
    image_alt: incoming.image_alt || base.image_alt || base.name || incoming.name,
    est_date: incoming.est_date || base.est_date || null,
    region: incoming.region || base.region || null,
    location_label: incoming.location_label || base.location_label || incoming.region || base.region || null,
    programs: Array.from(new Set([...(base.programs || []), ...(incoming.programs || [])])).filter(Boolean),
    // Platform and curated signals passed through from API
    user_count: incoming.user_count ?? base.user_count ?? 0,
    content_count: incoming.content_count ?? base.content_count ?? 0,
    signals: { ...(base.signals || {}), ...(incoming.signals || {}) },
  };
};

const clampScore = (value) => Math.max(62, Math.min(98, Math.round(value)));
const clampSignal = (value, fallback = 0.58) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0.1, value));
};

const getProgramBreadthSignal = (programs = [], maxPrograms = 3) =>
  Math.max(0.35, Math.min(1, (programs.length || 1) / Math.max(maxPrograms, 1)));

const getLegacySignal = (foundedYear) => {
  if (!foundedYear) return 0.58;
  const age = Math.max(6, CURRENT_YEAR - foundedYear);
  return clampSignal(age / 120, 0.58);
};

const getModernitySignal = (foundedYear, status) => {
  if (foundedYear) {
    return clampSignal((foundedYear - 1900) / 130, status === 'private' ? 0.82 : 0.56);
  }
  return status === 'private' ? 0.82 : 0.56;
};

const getAffiliationSignal = (collegeName, affiliation) => {
  if (/ucc college of education studies/i.test(collegeName || '')) return 1;
  if (/ucc/i.test(affiliation || '')) return 0.84;
  if (/uew|university of ghana|uds/i.test(affiliation || '')) return 0.78;
  return 0.66;
};

const inferHeritage = (name = '') => {
  if (/ucc college of education studies/i.test(name)) return 'university';
  if (/st\.|holy|ola|christ/i.test(name)) return 'catholic';
  if (/sda/i.test(name)) return 'sda';
  if (/abetifi|kibi/i.test(name)) return 'presbyterian';
  return 'public';
};

const inferWomenFocused = (name = '') =>
  /holy child|ola|st\. monica|st\. teresa/i.test(name);

const inferStatus = (name = '') => {
  if (/ucc college of education studies/i.test(name)) return 'university_unit';
  if (/christ the teacher|holy spirit|sda college/i.test(name)) return 'private';
  if (/st\. ambrose/i.test(name)) return 'public_absorbed';
  return 'public';
};

const inferFootprint = (location = '', name = '') => {
  const normalizedLocation = normalizeName(location);
  const normalizedName = normalizeName(name);

  if (/cape coast/.test(normalizedLocation)) return 'coastal_capital';
  if (/takoradi/.test(normalizedLocation)) return 'coastal_capital';
  if (/kumasi/.test(normalizedLocation)) return 'metro';
  if (/ho /.test(`${normalizedLocation} `) || normalizedLocation === 'ho volta') return 'regional_capital';
  if (/hohoe|jasikan|abetifi|kibi/.test(normalizedLocation)) return 'highland_town';
  if (/ucc college of education studies/.test(normalizedName)) return 'coastal_capital';
  if (/mampong|offinso/.test(normalizedLocation)) return 'district_hub';
  return 'district_hub';
};

const inferCampusSetting = (location = '', name = '') => {
  const normalizedLocation = normalizeName(location);
  const normalizedName = normalizeName(name);

  if (/cape coast|takoradi/.test(normalizedLocation) || /ucc college of education studies/.test(normalizedName)) {
    return 'coastal';
  }
  if (/abetifi|kibi|hohoe|jasikan|ho /.test(`${normalizedLocation} `)) return 'highlands';
  if (/kumasi|mampong|offinso/.test(normalizedLocation)) return 'garden_city';
  if (/agona|asokore/.test(normalizedLocation)) return 'ridge_town';
  if (/cape coast|kumasi|ho|takoradi/.test(normalizedLocation)) return 'urban';
  return 'town';
};

const inferSportsCulture = (footprint = 'district_hub', status = 'public') => {
  if (status === 'university_unit' || footprint === 'metro') return 'strong';
  if (footprint === 'coastal_capital' || footprint === 'regional_capital' || footprint === 'highland_town') {
    return 'active';
  }
  return 'growing';
};

const buildPublicProfile = (college) => {
  const key = normalizeName(college.name);
  const override = PUBLIC_SIGNAL_OVERRIDES[key] || {};
  const location = college.location_label || college.region || '';
  const status = override.status || inferStatus(college.name);
  const footprint = override.footprint || inferFootprint(location, college.name);
  const campusSetting = override.campusSetting || inferCampusSetting(location, college.name);
  const heritage = override.heritage || inferHeritage(college.name);
  const womenFocused = override.womenFocused ?? inferWomenFocused(college.name);
  const sportsCulture = override.sportsCulture || inferSportsCulture(footprint, status);

  return {
    foundedYear: override.foundedYear || null,
    footprint,
    campusSetting,
    heritage,
    status,
    womenFocused,
    sportsCulture,
  };
};

const buildSignalHighlights = (college, profile) => {
  const highlights = [];
  const programCount = college.programs?.length || 0;
  const curatedSignals = college.signals || {};
  const effectiveFoundingYear = curatedSignals.founding_year_verified || profile.foundedYear;

  if (effectiveFoundingYear) {
    highlights.push(`Founded ${effectiveFoundingYear}${curatedSignals.founding_year_verified ? ' ✓' : ''}`);
  }

  if (curatedSignals.ntc_pass_rate != null) {
    highlights.push(`NTC pass rate: ${curatedSignals.ntc_pass_rate}%`);
  }

  if (curatedSignals.accreditation_tier) {
    highlights.push(curatedSignals.accreditation_tier === 'full' ? 'Full accreditation' : 'Provisional accreditation');
  }

  if (curatedSignals.enrollment_count) {
    highlights.push(`~${curatedSignals.enrollment_count.toLocaleString()} students enrolled`);
  }

  if (college.user_count > 0) {
    highlights.push(`${college.user_count} students on Sharether`);
  }

  highlights.push(FOOTPRINT_LABELS[profile.footprint]);
  highlights.push(CAMPUS_LABELS[profile.campusSetting]);
  highlights.push(STATUS_LABELS[profile.status]);

  if (profile.womenFocused) {
    highlights.push('Women-focused teacher education legacy');
  }

  if (college.affiliate_university) {
    highlights.push(college.affiliate_university);
  }

  if (programCount) {
    highlights.push(`${programCount} programme track${programCount > 1 ? 's' : ''} on record`);
  }

  highlights.push(HERITAGE_LABELS[profile.heritage]);
  highlights.push(SPORTS_LABELS[profile.sportsCulture]);

  return Array.from(new Set(highlights)).filter(Boolean);
};

const buildCollegeScores = (college, maxPrograms, maxUsers) => {
  const profile = buildPublicProfile(college);
  const curatedSignals = college.signals || {};

  // Prefer admin-verified founding year over public-signal inference
  const effectiveFoundingYear = curatedSignals.founding_year_verified || profile.foundedYear;
  const legacy = getLegacySignal(effectiveFoundingYear);

  const breadth = getProgramBreadthSignal(college.programs, maxPrograms);
  const affiliation = getAffiliationSignal(college.name, college.affiliate_university);
  const footprint = clampSignal(FOOTPRINT_SIGNAL_MAP[profile.footprint], 0.75);
  const campusSetting = clampSignal(CAMPUS_SIGNAL_MAP[profile.campusSetting], 0.72);
  const status = clampSignal(STATUS_SIGNAL_MAP[profile.status], 0.88);
  const heritage = clampSignal(HERITAGE_SIGNAL_MAP[profile.heritage], 0.74);
  const sportsCulture = clampSignal(SPORTS_SIGNAL_MAP[profile.sportsCulture], 0.68);
  const womenFocused = profile.womenFocused ? 1 : 0;
  const modernity = getModernitySignal(effectiveFoundingYear, profile.status);

  // Tier 1: platform popularity — how many users are registered at this college
  const platformPopularity = clampSignal(Math.min(1, (college.user_count || 0) / Math.max(maxUsers, 1)), 0);

  // Tier 3: admin-curated NTC pass rate (0–100 → 0–1 signal)
  const ntcSignal = curatedSignals.ntc_pass_rate != null
    ? clampSignal(curatedSignals.ntc_pass_rate / 100, legacy)
    : null;

  // Tier 3: accreditation tier signal
  const accreditationSignal = curatedSignals.accreditation_tier === 'full' ? 1
    : curatedSignals.accreditation_tier === 'provisional' ? 0.72
    : null;

  // Tier 3: Google Maps rating (1–5 → 0–1)
  const mapsSignal = curatedSignals.google_maps_rating != null
    ? clampSignal((curatedSignals.google_maps_rating - 1) / 4, 0)
    : null;

  const visibility = clampSignal(
    (legacy * 0.34) +
      (footprint * 0.25) +
      (status * 0.14) +
      (affiliation * 0.15) +
      (womenFocused * 0.06) +
      (/ucc college of education studies/i.test(college.name || '') ? 0.12 : 0),
    0.66
  );

  const scores = {
    // NTC pass rate replaces legacy as primary academics input when available
    academics: clampScore(59 + ((ntcSignal ?? legacy) * 15) + (breadth * 10) + (affiliation * 9) + ((accreditationSignal ?? status) * 5) + (heritage * 3)),
    infrastructure: clampScore(56 + (footprint * 10) + (campusSetting * 9) + ((accreditationSignal ?? status) * 10) + (modernity * 8) + (visibility * 3)),
    college_operation: clampScore(58 + ((accreditationSignal ?? status) * 13) + (legacy * 8) + (affiliation * 8) + (heritage * 4) + (footprint * 3)),
    student_behaviour: clampScore(59 + (heritage * 10) + (womenFocused * 6) + (footprint * 7) + (status * 5) + (legacy * 3)),
    environment: clampScore(55 + (campusSetting * 14) + ((mapsSignal != null ? mapsSignal * 6 : 0)) + (footprint * 10) + (heritage * 4) + (womenFocused * 3) + (visibility * 2)),
    alumni_impact: clampScore(54 + (legacy * 17) + (visibility * 11) + (affiliation * 7) + (heritage * 4) + (womenFocused * 4)),
    sports: clampScore(53 + (sportsCulture * 15) + (visibility * 8) + (footprint * 8) + (status * 4) + (breadth * 4)),
    // Platform user count lifts popularity score directly
    popularity: clampScore(55 + (visibility * 14) + (platformPopularity * 8) + (footprint * 7) + (legacy * 7) + (womenFocused * 5) + (status * 3)),
    beauty: clampScore(55 + (campusSetting * 16) + (footprint * 8) + (heritage * 5) + (womenFocused * 4) + (visibility * 2)),
  };

  const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const weightedTotal = Object.entries(CATEGORY_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + ((scores[key] || 0) * weight),
    0
  );

  return {
    profile,
    highlights: buildSignalHighlights(college, profile),
    scores: {
      overall: clampScore(weightedTotal / totalWeight),
      ...scores,
    },
  };
};

const getLocationLabel = (college) => college.location_label || college.region || 'College campus';

export default function CollegeRankings() {
  const [apiColleges, setApiColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('overall');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    const loadColleges = async () => {
      setLoading(true);
      try {
        const response = await api.ranking.getColleges({ limit: 100 });
        if (!active) return;
        setApiColleges(response?.data?.colleges || []);
      } catch (error) {
        if (active) {
          setApiColleges([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadColleges();
    return () => {
      active = false;
    };
  }, []);

  const colleges = useMemo(() => {
    const merged = new Map();

    GUEST_COLLEGES.forEach((college) => {
      const record = createGuestCollegeRecord(college);
      merged.set(resolveCollegeKey(record), record);
    });

    apiColleges.forEach((college) => {
      const key = resolveCollegeKey(college);
      merged.set(key, mergeCollegeRecords(merged.get(key), college));
    });

    const mergedColleges = Array.from(merged.values());
    const maxPrograms = Math.max(...mergedColleges.map((item) => item.programs?.length || 0), 1);
    const maxUsers = Math.max(...mergedColleges.map((item) => item.user_count || 0), 1);

    return mergedColleges.map((college) => {
      const rankingModel = buildCollegeScores(college, maxPrograms, maxUsers);
      return {
        ...college,
        image_url: college.image_url || LOGO_SRC,
        image_alt: college.image_alt || college.name,
        profile: rankingModel.profile,
        publicHighlights: rankingModel.highlights,
        scores: rankingModel.scores,
      };
    });
  }, [apiColleges]);

  // Full sorted list — rank positions come from here, not from the filtered list
  const ranked = useMemo(
    () =>
      [...colleges].sort((left, right) => {
        const scoreGap = (right.scores?.[category] || 0) - (left.scores?.[category] || 0);
        if (scoreGap !== 0) return scoreGap;
        return (right.scores?.overall || 0) - (left.scores?.overall || 0);
      }),
    [colleges, category]
  );

  // True rank position per college id (1-based)
  const rankMap = useMemo(
    () => Object.fromEntries(ranked.map((college, i) => [college.id, i + 1])),
    [ranked]
  );

  // Filter for display only — rank positions are still from the full list
  const displayList = useMemo(() => {
    const normalizedQuery = normalizeName(search);
    if (!normalizedQuery) return ranked;
    return ranked.filter((college) => normalizeName(college.name).includes(normalizedQuery));
  }, [ranked, search]);

  const showPodium = !search && displayList.length >= 3;
  const topThree = showPodium ? displayList.slice(0, 3) : [];
  const rest = showPodium ? displayList.slice(3) : displayList;
  const categoryInfo = CATEGORIES.find((item) => item.key === category);

  return (
    <div className="college-rankings page-shell">

      {/* ── Hero ── */}
      <section className="page-hero page-hero-compact page-hero-lean hero-theme-rankings">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">College rankings</span>
            <h1 className="hero-title">Every UCC college, ranked by what matters.</h1>
            <p className="hero-subtitle">
              Ten ranking lenses — academics, environment, sports, beauty and more — so you can compare
              colleges across every dimension that shapes your experience.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => document.getElementById('cr-rankings')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See rankings
              </button>
            </div>
          </div>
          <div className="hero-panel">
            <p className="panel-title">What powers the rankings</p>
            <div className="panel-list">
              {[
                ['10 ranking lenses', 'Each lens surfaces a different angle — from academics to campus beauty.'],
                ['Public institutional signals', 'Founded year, footprint, heritage, affiliation, and programme breadth.'],
                ['Transparent by design', 'A public-signal index for exploration on Sharether, not an official accreditation table.'],
              ].map(([title, desc]) => (
                <div key={title} className="panel-list-item">
                  <span className="panel-dot" />
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Controls ── */}
      <section className="page-section cr-controls" id="cr-rankings">
        <div className="cr-search-wrap">
          <FiSearch className="cr-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="cr-search-input"
            placeholder="Search colleges…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="cr-lens-scroll">
          {CATEGORIES.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className={`cr-lens-tab${category === key ? ' cr-lens-tab--active' : ''}`}
              onClick={() => setCategory(key)}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {categoryInfo && (
          <div className="cr-lens-desc">
            <FiTrendingUp aria-hidden="true" />
            <span><strong>{categoryInfo.label}:</strong> {categoryInfo.description}</span>
          </div>
        )}
      </section>

      {/* ── Podium — top 3 ── */}
      {!loading && showPodium && (
        <section className="page-section">
          <div className="section-heading">
            <h2>Top three</h2>
            <p>The colleges leading the {categoryInfo?.label?.toLowerCase() || 'overall'} ranking right now.</p>
          </div>
          <div className="cr-podium">
            {/* Silver — #2, renders left */}
            <div className="cr-podium-card cr-podium-silver">
              <div className="cr-medal cr-medal-silver">🥈</div>
              <img className="cr-podium-img" src={topThree[1].image_url || LOGO_SRC} alt={topThree[1].name} loading="lazy" />
              <div className="cr-podium-body">
                <h3>{topThree[1].name}</h3>
                <p>{getLocationLabel(topThree[1])}</p>
                <div className="cr-podium-signals">
                  {topThree[1].publicHighlights?.slice(0, 3).map((h) => (
                    <span key={h} className="cr-signal-chip">{h}</span>
                  ))}
                </div>
              </div>
              <div className="cr-podium-score">
                <strong>{topThree[1].scores?.[category] || 0}</strong>
                <span>{categoryInfo?.label}</span>
              </div>
            </div>
            {/* Gold — #1, renders center */}
            <div className="cr-podium-card cr-podium-gold cr-podium-first">
              <div className="cr-medal cr-medal-gold">🥇</div>
              <img className="cr-podium-img" src={topThree[0].image_url || LOGO_SRC} alt={topThree[0].name} loading="lazy" />
              <div className="cr-podium-body">
                <h3>{topThree[0].name}</h3>
                <p>{getLocationLabel(topThree[0])}</p>
                <div className="cr-podium-signals">
                  {topThree[0].publicHighlights?.slice(0, 3).map((h) => (
                    <span key={h} className="cr-signal-chip">{h}</span>
                  ))}
                </div>
              </div>
              <div className="cr-podium-score cr-podium-score--gold">
                <strong>{topThree[0].scores?.[category] || 0}</strong>
                <span>{categoryInfo?.label}</span>
              </div>
            </div>
            {/* Bronze — #3, renders right */}
            <div className="cr-podium-card cr-podium-bronze">
              <div className="cr-medal cr-medal-bronze">🥉</div>
              <img className="cr-podium-img" src={topThree[2].image_url || LOGO_SRC} alt={topThree[2].name} loading="lazy" />
              <div className="cr-podium-body">
                <h3>{topThree[2].name}</h3>
                <p>{getLocationLabel(topThree[2])}</p>
                <div className="cr-podium-signals">
                  {topThree[2].publicHighlights?.slice(0, 3).map((h) => (
                    <span key={h} className="cr-signal-chip">{h}</span>
                  ))}
                </div>
              </div>
              <div className="cr-podium-score">
                <strong>{topThree[2].scores?.[category] || 0}</strong>
                <span>{categoryInfo?.label}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Loading ── */}
      {loading && (
        <section className="page-section">
          <div className="cr-loading">
            <div className="spinner" />
            <p>Building rankings…</p>
          </div>
        </section>
      )}

      {/* ── Full leaderboard ── */}
      {!loading && (
        <section className="page-section">
          <div className="section-heading">
            <h2>Full leaderboard</h2>
            <p>
              {displayList.length} {displayList.length === 1 ? 'college' : 'colleges'}
              {search ? ` matching "${search}"` : ` ranked by ${categoryInfo?.label?.toLowerCase() || 'overall score'}`}.
            </p>
          </div>
          {rest.length === 0 ? (
            <div className="cr-empty">
              <p>{search ? 'No colleges match your search.' : 'No colleges to display.'}</p>
            </div>
          ) : (
            <div className="cr-list">
              {rest.map((college) => {
                const score = college.scores?.[category] || 0;
                const overall = college.scores?.overall || 0;
                const barWidth = Math.round(Math.max(8, ((score - 62) / 36) * 92 + 8));
                return (
                  <div key={college.id} className="cr-row">
                    <div className="cr-row-rank">#{rankMap[college.id]}</div>
                    <img className="cr-row-img" src={college.image_url || LOGO_SRC} alt={college.name} loading="lazy" />
                    <div className="cr-row-body">
                      <div className="cr-row-top">
                        <div className="cr-row-meta">
                          <h4>{college.name}</h4>
                          <span className="cr-row-location">
                            <FiMapPin aria-hidden="true" />
                            {getLocationLabel(college)}
                          </span>
                        </div>
                        <div className="cr-row-scores">
                          <div className="cr-score-block cr-score-block--primary">
                            <strong>{score}</strong>
                            <small>{categoryInfo?.label}</small>
                          </div>
                          {category !== 'overall' && (
                            <div className="cr-score-block">
                              <strong>{overall}</strong>
                              <small>Overall</small>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="cr-bar-row">
                        <div className="cr-score-bar-wrap">
                          <div className="cr-score-bar" style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className="cr-bar-score">{score}</span>
                      </div>
                      <div className="cr-row-chips">
                        {college.publicHighlights?.slice(0, 3).map((h) => (
                          <span key={h} className="cr-signal-chip cr-signal-chip--sm">{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Methodology ── */}
      <section className="page-section">
        <div className="section-heading">
          <h2>How colleges are ranked</h2>
          <p>Every score is computed from verifiable public signals — no guesswork, no randomness.</p>
        </div>
        <div className="trending-highlights-grid">
          {[
            [FiBookOpen,   'Academic signals',      'Programme breadth, founding year, and academic affiliation carry the most weight. Older, more affiliated, and broader institutions score higher here.'],
            [FiMapPin,     'Location footprint',    'Campus city size and access level — coastal capitals, metro areas, and regional hubs signal stronger infrastructure and public reach.'],
            [FiGlobe,      'Heritage and affiliation', 'Mission origin (university-led, Catholic, Presbyterian, SDA, public) and the strength of the affiliated university both factor in.'],
            [FiActivity,   'Campus setting',        'The physical and environmental character of the campus — coastal, highland, garden city, ridge, urban, or town — shapes environment and beauty scores.'],
            [FiStar,       'Platform signals',      'The number of students registered on Sharether from each college feeds directly into the Popularity lens, updating as the platform grows.'],
            [FiTrendingUp, 'Verified data override','When admin-curated figures are entered — NTC pass rate, accreditation tier, enrollment — they replace the inferred estimates in the relevant lenses.'],
          ].map(([Icon, title, desc]) => (
            <div key={title} className="info-card">
              <Icon size={18} style={{ color: 'var(--primary-color)' }} />
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
