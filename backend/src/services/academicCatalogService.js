const { Institution, Program } = require('../models');
const {
  normalizeProgramCategory,
  getProgramCategoryCode
} = require('../utils/studentIdentity');
const {
  ACADEMIC_CATALOG_VERSION,
  UNIVERSITY_DEFINITIONS,
  ACADEMIC_CATALOG_COLLEGES
} = require('../config/academicCatalog');

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const uniqueStrings = (values = []) => Array.from(
  new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )
);

const getUniversityByCode = (code) => (
  UNIVERSITY_DEFINITIONS.find((entry) => entry.code === code) || null
);

const COLLEGE_MATCH_KEY_COUNTS = ACADEMIC_CATALOG_COLLEGES.reduce((acc, college) => {
  uniqueStrings([
    college.name,
    college.short_name,
    ...(Array.isArray(college.aliases) ? college.aliases : [])
  ]).forEach((value) => {
    const key = normalizeKey(value);
    acc[key] = (acc[key] || 0) + 1;
  });
  return acc;
}, {});

const getCollegeMatchKeys = (college) => uniqueStrings([
  college.name,
  ...uniqueStrings([
    college.short_name,
    ...(Array.isArray(college.aliases) ? college.aliases : [])
  ]).filter((value) => COLLEGE_MATCH_KEY_COUNTS[normalizeKey(value)] === 1)
]).map(normalizeKey);

const getInstitutionMetadata = (institution) => {
  if (!institution) return {};
  if (typeof institution.get === 'function') {
    return institution.get('metadata') || {};
  }
  return institution.metadata || {};
};

const buildInstitutionLookup = (institutions) => {
  const lookup = new Map();

  institutions.forEach((institution) => {
    const metadata = getInstitutionMetadata(institution);
    const aliasValues = uniqueStrings([
      metadata.alias,
      metadata.short_name,
      ...(Array.isArray(metadata.aliases) ? metadata.aliases : [])
    ]).filter((value) => COLLEGE_MATCH_KEY_COUNTS[normalizeKey(value)] === 1);

    [institution.name, ...aliasValues].forEach((value) => {
      lookup.set(normalizeKey(value), institution);
    });
  });

  return lookup;
};

const buildInstitutionMetadata = (existingMetadata, college) => {
  const affiliateUniversity = getUniversityByCode(college.affiliate_university_code);

  return {
    ...existingMetadata,
    short_name: college.short_name || existingMetadata.short_name || null,
    alias: college.short_name || existingMetadata.alias || null,
    aliases: uniqueStrings([
      ...(Array.isArray(college.aliases) ? college.aliases : []),
      college.short_name,
      college.name
    ]),
    ownership: college.ownership || existingMetadata.ownership || 'public',
    location: college.location || existingMetadata.location || null,
    region: college.region || existingMetadata.region || null,
    notes: uniqueStrings([
      ...(Array.isArray(existingMetadata.notes) ? existingMetadata.notes : []),
      ...(Array.isArray(college.notes) ? college.notes : [])
    ]),
    affiliate_university: affiliateUniversity?.name || existingMetadata.affiliate_university || null,
    affiliate_university_code: college.affiliate_university_code || existingMetadata.affiliate_university_code || null,
    programme_categories: uniqueStrings(college.programme_categories),
    programme_category_codes: uniqueStrings(
      (college.programme_categories || [])
        .map((name) => getProgramCategoryCode(name))
        .filter(Boolean)
    ),
    college_code: college.college_code || existingMetadata.college_code || null,
    academic_catalog_version: ACADEMIC_CATALOG_VERSION,
    academic_catalog_source: 'sharether_manual_catalog'
  };
};

const mapProgramCategory = (value) => {
  const normalized = normalizeProgramCategory(value);
  if (normalized) return normalized;

  const compact = String(value || '').trim().toUpperCase();
  if (compact === 'PRIMARY') return 'Primary Education';
  if (compact === 'JHS') return 'JHS Education';
  if (compact === 'ECE') return 'Early Childhood Education';
  return null;
};

const createProgramOption = (program, category) => ({
  id: program.id,
  key: program.key,
  name: program.name,
  category,
  category_code: getProgramCategoryCode(category),
  is_placeholder: false
});

const createFallbackProgramOption = (category) => ({
  id: `fallback-${getProgramCategoryCode(category) || normalizeKey(category)}`,
  key: `${normalizeKey(category)}-general`,
  name: category,
  category,
  category_code: getProgramCategoryCode(category),
  is_placeholder: true
});

async function ensureAcademicCatalogInstitutions() {
  const existingInstitutions = await Institution.findAll();
  const lookup = buildInstitutionLookup(existingInstitutions);

  for (const college of ACADEMIC_CATALOG_COLLEGES) {
    const keysToMatch = getCollegeMatchKeys(college);

    const institution = keysToMatch
      .map((key) => lookup.get(key))
      .find(Boolean);

    if (institution) {
      const nextMetadata = buildInstitutionMetadata(getInstitutionMetadata(institution), college);
      const patch = {};

      if (institution.name !== college.name) {
        patch.name = college.name;
      }

      if (JSON.stringify(nextMetadata) !== JSON.stringify(getInstitutionMetadata(institution))) {
        patch.metadata = nextMetadata;
      }

      if (Object.keys(patch).length) {
        await institution.update(patch);
      }

      keysToMatch.forEach((key) => {
        lookup.set(key, institution);
      });
      continue;
    }

    const createdInstitution = await Institution.create({
      name: college.name,
      metadata: buildInstitutionMetadata({}, college)
    });

    keysToMatch.forEach((key) => {
      lookup.set(key, createdInstitution);
    });
  }

  return Institution.findAll({ order: [['name', 'ASC']] });
}

async function getAcademicCatalog() {
  const [institutions, programRows] = await Promise.all([
    ensureAcademicCatalogInstitutions(),
    Program.findAll({ order: [['name', 'ASC']] })
  ]);

  const institutionLookup = buildInstitutionLookup(institutions);
  const colleges = ACADEMIC_CATALOG_COLLEGES.map((college) => {
    const institution = getCollegeMatchKeys(college)
      .map((key) => institutionLookup.get(key))
      .find(Boolean);

    const affiliateUniversity = getUniversityByCode(college.affiliate_university_code);

    return {
      id: institution?.id || null,
      name: institution?.name || college.name,
      short_name: college.short_name,
      college_code: college.college_code || getInstitutionMetadata(institution).college_code || null,
      affiliate_university: affiliateUniversity?.name || null,
      affiliate_university_code: college.affiliate_university_code,
      ownership: college.ownership,
      location: college.location || null,
      region: college.region || null,
      notes: Array.isArray(college.notes) ? college.notes : [],
      aliases: Array.isArray(college.aliases) ? college.aliases : [],
      programme_categories: (college.programme_categories || []).map((category) => ({
        name: category,
        code: getProgramCategoryCode(category)
      }))
    };
  });

  const categoryNames = uniqueStrings(
    colleges.flatMap((college) => college.programme_categories.map((category) => category.name))
  );

  const programsByCategory = categoryNames.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {});

  programRows.forEach((program) => {
    const category = mapProgramCategory(program.category || program.metadata?.category);
    if (!category || !programsByCategory[category]) return;
    programsByCategory[category].push(createProgramOption(program, category));
  });

  categoryNames.forEach((category) => {
    if (!programsByCategory[category].length) {
      programsByCategory[category] = [createFallbackProgramOption(category)];
    }
  });

  const universities = UNIVERSITY_DEFINITIONS.map((university) => ({
    code: university.code,
    name: university.name,
    colleges_count: colleges.filter(
      (college) => college.affiliate_university_code === university.code
    ).length
  }));

  const programmeCategories = categoryNames.map((category) => ({
    name: category,
    code: getProgramCategoryCode(category),
    programs_count: (programsByCategory[category] || []).length
  }));

  return {
    version: ACADEMIC_CATALOG_VERSION,
    universities,
    colleges,
    programme_categories: programmeCategories,
    programs_by_category: programsByCategory
  };
}

module.exports = {
  ensureAcademicCatalogInstitutions,
  getAcademicCatalog
};
