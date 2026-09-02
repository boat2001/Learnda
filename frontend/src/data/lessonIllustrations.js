/**
 * Local SVG illustration lookup for lesson chunks.
 *
 * Keyed by `courseCode:lessonNumber:chunkIndex` where:
 *   courseCode  – lowercase, no spaces ('ebs106', 'ebs107', ...)
 *   lessonNumber – integer (1-based, matches lesson_document.lesson_number)
 *   chunkIndex  – integer (0-based, matches lesson_document.chunks[] order)
 *
 * Only entries that have a local /lesson-images/*.svg are included here.
 * These take precedence over whatever illustration is stored in the DB so that
 * Learnda-authored interactive SVGs are shown instead of external stock photos.
 *
 * mobile_position accepted values (see lessonAssessment.js normalizeChunkIllustration):
 *   'before_paragraph_0'       – floats above the first paragraph (mobile)
 *   'between_paragraph_0_1'    – appears between first and second paragraph (mobile)
 *   'after_last_paragraph'     – appears after all paragraphs (mobile)
 */

const D = 'right'; // default desktop_align

const entry = (image_url, alt, caption, mobile_position = 'between_paragraph_0_1', desktop_align = D) => ({
  image_url,
  alt,
  caption,
  credit: 'Learnda Educational Diagram',
  type: 'diagram',
  mobile_position,
  desktop_align,
});

// ─── EBS 106 — Child Development and Family Life ──────────────────────────────

// Lesson 1: The Concept of Growth and Development
const ebs106_1 = {
  1: entry(
    '/lesson-images/growth-development-maturation.svg',
    'Comparison diagram of Growth, Development, and Maturation',
    'Growth, Development, and Maturation compared — each term describes a different aspect of change in a child.',
  ),
  2: entry(
    '/lesson-images/growth-development-maturation.svg',
    'Side-by-side comparison of Growth vs Development vs Maturation',
    'Key differences at a glance: Growth is quantitative and measurable; Development is broader and includes qualitative changes.',
    'before_paragraph_0',
  ),
  3: entry(
    '/lesson-images/maturation-readiness-teachers.svg',
    'Mind map showing maturation, readiness signs, and teacher implications',
    'What teachers need to know: maturation determines readiness. Tasks must align with a child\'s developmental stage.',
  ),
};

// Lesson 2: Physical Development of the Child
const ebs106_2 = {
  0: entry(
    '/lesson-images/physical-development-stages.svg',
    'Timeline of physical development stages: Infancy, Childhood, and Adolescence',
    'Physical development covers changes in height, weight, bones, muscles, teeth, brain, and sense organs across three major stages.',
  ),
  1: entry(
    '/lesson-images/motor-skills-diagram.svg',
    'Gross motor skills vs fine motor skills diagram',
    'Motor development has two branches: Gross Motor Skills (large muscles) and Fine Motor Skills (small muscles like fingers).',
  ),
  2: entry(
    '/lesson-images/physical-development-stages.svg',
    'Full physical development stages diagram covering infancy, childhood, and adolescence',
    'Childhood spans ages 2–11, divided into early, middle, and late childhood — each with distinct physical characteristics.',
    'after_last_paragraph',
  ),
};

// Lesson 3: Cognitive Development (Piaget)
const ebs106_3 = {
  0: entry(
    '/lesson-images/piaget-four-stages.svg',
    'Overview of Piaget\'s four stages of cognitive development',
    'Piaget\'s four stages of cognitive development — each stage builds on the previous one and cannot be skipped.',
    'after_last_paragraph',
  ),
  1: entry(
    '/lesson-images/piaget-object-permanence.svg',
    'Object permanence experiment: younger infant doesn\'t search for hidden toy; older infant lifts the blanket',
    'Object permanence — a key Sensorimotor milestone. Young infants believe a toy hidden under a blanket no longer exists.',
  ),
};

// Lesson 4: Prenatal Development
const ebs106_4 = {
  1: entry(
    '/lesson-images/prenatal-stages-timeline.svg',
    'Timeline of the three prenatal stages: Germinal, Embryonic, and Fetal',
    'The three stages of prenatal development. Tap or hover a stage for the teacher\'s note.',
  ),
  2: entry(
    '/lesson-images/teratogens-sensitive-periods.svg',
    'Six common teratogens and a chart showing vulnerability is highest during the embryonic stage',
    'Six common teratogens and when the foetus is most vulnerable. Tap or hover the bars and cards to explore.',
  ),
};

// Lesson 10: Kohlberg's Moral Development
const ebs106_10 = {
  3: entry(
    '/lesson-images/kohlberg-moral-stages.svg',
    'Kohlberg\'s three levels of moral reasoning with six stages',
    'Three levels, six stages — moral reasoning matures upward. Tap a level to highlight it.',
  ),
};

// Lesson 11: Erikson's Psychosocial Development
const ebs106_11 = {
  1: entry(
    '/lesson-images/erikson-psychosocial-stages.svg',
    'Erikson\'s eight psychosocial stages, each a crisis with a virtue',
    'All eight stages at a glance — note Stage 4, which plays out in your classroom. Tap a stage to highlight it.',
  ),
};

// Lesson 15: Classical Conditioning (Pavlov)
const ebs106_15 = {
  2: entry(
    '/lesson-images/classical-conditioning-pavlov.svg',
    'Classical conditioning before, during and after: food causes salivation, bell paired with food, then bell alone',
    'How a neutral bell becomes a conditioned stimulus. Tap Before, During and After.',
  ),
};

// Lesson 16: Operant Conditioning (Skinner)
const ebs106_16 = {
  2: entry(
    '/lesson-images/operant-conditioning-matrix.svg',
    '2×2 matrix of operant conditioning: positive/negative reinforcement and punishment',
    'Reinforcement increases behaviour; punishment decreases it. Tap a quadrant to highlight it.',
  ),
};

// ─── EBS 107 — Computer Literacy ─────────────────────────────────────────────

// Lesson 2: Types and Classification of Computers
const ebs107_2 = {
  2: entry(
    '/lesson-images/computer-classification.svg',
    'Computers classified by purpose (special vs general) and by type (analog, digital, hybrid)',
    'Two ways to classify computers — by purpose and by operating type. Tap a card to highlight it.',
  ),
  3: entry(
    '/lesson-images/computer-size-spectrum.svg',
    'Computers by size from supercomputer to microcomputer',
    'From supercomputers to smartphones — classifying computers by size. Tap a tier to highlight it.',
  ),
};

// ─── EBS 210 — Algebraic Thinking ────────────────────────────────────────────

// Lesson 4: The Algebra of Sets
const ebs210_4 = {
  2: entry(
    '/lesson-images/sets-operations-venn.svg',
    'Interactive Venn diagram showing Union, Intersection, Difference, and Complement',
    'An interactive Venn diagram — tap Union, Intersection, Difference or Complement to highlight the answer region.',
  ),
  3: entry(
    '/lesson-images/sets-power-set.svg',
    'Power sets and the 2ⁿ rule shown as a doubling chart',
    'Power sets and the 2ⁿ rule — tap a bar to watch the subset count double.',
  ),
};

// ─── EBS 118 — Information Literacy ──────────────────────────────────────────

// Lesson 2: Information vs Knowledge
const ebs118_2 = {
  2: entry(
    '/lesson-images/information-vs-knowledge.svg',
    'The ladder from data to information to knowledge to wisdom',
    'Data becomes information, then knowledge, then wisdom. Tap a rung to explore.',
  ),
};

// ─── EBS 301J — Calculus ─────────────────────────────────────────────────────

// Lesson 6: Gradients, Tangents, and Normal Lines
const ebs301j_6 = {
  1: entry(
    '/lesson-images/calculus-tangent-gradient.svg',
    'A curve with a tangent showing positive, zero, or negative gradient and the perpendicular normal',
    'The gradient is the slope of the tangent. Tap Rising, Peak or Falling to see it change sign.',
  ),
};

// ─── Master lookup ────────────────────────────────────────────────────────────

const LOOKUP = {
  'ebs106:1': ebs106_1,
  'ebs106:2': ebs106_2,
  'ebs106:3': ebs106_3,
  'ebs106:4': ebs106_4,
  'ebs106:10': ebs106_10,
  'ebs106:11': ebs106_11,
  'ebs106:15': ebs106_15,
  'ebs106:16': ebs106_16,
  'ebs107:2': ebs107_2,
  'ebs210:4': ebs210_4,
  'ebs118:2': ebs118_2,
  'ebs301j:6': ebs301j_6,
};

/**
 * Returns a local SVG illustration for the given lesson chunk, or null.
 *
 * @param {string} courseCode  – raw course code from lesson metadata, e.g. 'EBS 106'
 * @param {string|number} lessonNumber – lesson number within the course, e.g. 1
 * @param {number} chunkIndex  – 0-based chunk index in lesson_document.chunks
 * @returns {{ image_url, alt, caption, credit, type, mobile_position, desktop_align } | null}
 */
export function getChunkIllustration(courseCode, lessonNumber, chunkIndex) {
  const code = String(courseCode || 'EBS 106').replace(/\s+/g, '').toLowerCase();
  const num = parseInt(lessonNumber, 10);
  if (!num) return null;

  const chunkMap = LOOKUP[`${code}:${num}`];
  if (!chunkMap) return null;

  return chunkMap[chunkIndex] || null;
}
