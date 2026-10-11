// How each subject or learning area looks: an icon and one of the four logo
// wing colours. Young learners find subjects by colour and picture before
// they can reliably read the name (§8), so these must stay stable: a subject
// keeps its look from KG to SHS.
//
// Colours group subjects into families rather than being assigned at random:
//   blue   - languages and reading
//   orange - mathematics and number
//   green  - science, health and the natural world
//   amber  - arts, society, faith and practical subjects
import {
  MdAbc,
  Md123,
  MdAccountBalance,
  MdAgriculture,
  MdAutoStories,
  MdBiotech,
  MdBolt,
  MdBuild,
  MdBusinessCenter,
  MdCalculate,
  MdComputer,
  MdDesignServices,
  MdDirectionsRun,
  MdEngineering,
  MdFlight,
  MdFunctions,
  MdHandyman,
  MdHealthAndSafety,
  MdHistoryEdu,
  MdKitchen,
  MdMenuBook,
  MdPalette,
  MdPrecisionManufacturing,
  MdPublic,
  MdReceiptLong,
  MdRecordVoiceOver,
  MdScience,
  MdSmartToy,
  MdSupport,
  MdTerrain,
  MdTheaterComedy,
  MdTranslate,
  MdTrendingUp,
  MdVolunteerActivism,
  MdForest,
} from 'react-icons/md';

const V = (icon, color) => Object.freeze({ icon, color });

const VISUALS = Object.freeze({
  // Kindergarten learning areas (§4.1)
  language_literacy: V(MdAbc, 'blue'),
  numeracy: V(Md123, 'orange'),
  environmental_studies: V(MdForest, 'green'),
  physical_development: V(MdDirectionsRun, 'green'),

  // Primary and JHS (§4.2, §4.3)
  english: V(MdMenuBook, 'blue'),
  mathematics: V(MdCalculate, 'orange'),
  science: V(MdScience, 'green'),
  ghanaian_language: V(MdRecordVoiceOver, 'blue'),
  owop: V(MdPublic, 'amber'),
  creative_arts: V(MdPalette, 'amber'),
  creative_arts_design: V(MdPalette, 'amber'),
  history: V(MdHistoryEdu, 'amber'),
  rme: V(MdVolunteerActivism, 'amber'),
  pe: V(MdDirectionsRun, 'green'),
  physical_health_education: V(MdDirectionsRun, 'green'),
  computing: V(MdComputer, 'blue'),
  french: V(MdTranslate, 'blue'),
  arabic: V(MdTranslate, 'blue'),
  social_studies: V(MdPublic, 'amber'),
  career_technology: V(MdHandyman, 'amber'),

  // SHS (§4.4)
  general_science: V(MdScience, 'green'),
  peh_core: V(MdDirectionsRun, 'green'),
  peh_elective: V(MdDirectionsRun, 'green'),
  intervention_english: V(MdSupport, 'blue'),
  intervention_mathematics: V(MdSupport, 'orange'),
  agriculture: V(MdAgriculture, 'green'),
  agricultural_science: V(MdAgriculture, 'green'),
  additional_mathematics: V(MdFunctions, 'orange'),
  biology: V(MdBiotech, 'green'),
  chemistry: V(MdScience, 'green'),
  physics: V(MdBolt, 'green'),
  ict: V(MdComputer, 'blue'),
  robotics: V(MdSmartToy, 'blue'),
  engineering: V(MdEngineering, 'orange'),
  aviation_aerospace: V(MdFlight, 'blue'),
  biomedical_science: V(MdHealthAndSafety, 'green'),
  manufacturing: V(MdPrecisionManufacturing, 'orange'),
  economics: V(MdTrendingUp, 'orange'),
  geography: V(MdTerrain, 'green'),
  government: V(MdAccountBalance, 'amber'),
  religious_studies: V(MdVolunteerActivism, 'amber'),
  literature_in_english: V(MdAutoStories, 'blue'),
  ghanaian_languages: V(MdRecordVoiceOver, 'blue'),
  business_studies: V(MdBusinessCenter, 'orange'),
  business_management: V(MdBusinessCenter, 'orange'),
  accounting: V(MdReceiptLong, 'orange'),
  applied_technology: V(MdBuild, 'amber'),
  applied_technology_auto_metal: V(MdBuild, 'amber'),
  applied_technology_building_wood: V(MdBuild, 'amber'),
  applied_technology_electrical_electronic: V(MdBolt, 'amber'),
  design_communication_technology: V(MdDesignServices, 'amber'),
  home_economics: V(MdKitchen, 'amber'),
  art_design_foundation: V(MdPalette, 'amber'),
  art_design_studio: V(MdPalette, 'amber'),
  performing_arts: V(MdTheaterComedy, 'amber'),
});

const FALLBACK_COLORS = ['blue', 'orange', 'green', 'amber'];

/**
 * The icon and colour for a subject slug. Unknown slugs still get a stable
 * colour (hashed from the slug) and a book icon, so new subjects added on the
 * backend render sensibly before anyone updates this table.
 */
export const getSubjectVisual = (slug = '') => {
  if (VISUALS[slug]) return VISUALS[slug];
  const hash = [...String(slug)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return V(MdMenuBook, FALLBACK_COLORS[hash % FALLBACK_COLORS.length]);
};

/** CSS custom properties for a subject's colour family, for a `style` prop. */
export const subjectColorVars = (slug) => {
  const { color } = getSubjectVisual(slug);
  return {
    '--subject': `var(--brand-${color})`,
    '--subject-ink': `var(--ink-${color})`,
    '--subject-tint': `var(--tint-${color})`,
  };
};
