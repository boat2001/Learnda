'use strict';

const WORDS = new Set(`
a ability abilities about accepted acquire across activities activity advantages after aggregate all allows also among an analysis and approach approaches are area art as assessment attempt attitude attitudes based basic be behaviour behaviours believe believes by called can case child class classes classroom coherent concept concepts content control core course cumulative curriculum democratic design designs develops diagnostic discipline effective education educational educators english evaluation every except external fafunwa farrant field follow following follows for formal formative forms from generation goal government guidance has have held how human identify in initiated instinct involves is knowledge laws learner learning lives many means method monocratic natural negative next of offered on ongoing other person planned positive principles process processes pupils research researches role school scholars science scientific scientist similar specific separate several skills society subject subjects syllabus systematic teacher teachers teaching textbook that the their theory therefore they timetable to transmit type usually value views which who will worth worthwhile
autocratic bureaucratic bureacratic broadfield centred corecurriculum democraticevaluation external formal formative summative monocraticevaluation
`.split(/\s+/).filter(Boolean));

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function capitalizeLike(source, words) {
  if (!words.length) return '';
  const joined = words.join(' ');
  if (!/^[A-Z]/.test(source)) return joined;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function segmentToken(token) {
  const original = String(token || '');
  const lower = original.toLowerCase();
  if (lower.length < 13 || /\d/.test(lower) || /[^a-z]/i.test(original)) return original;

  const best = Array(lower.length + 1).fill(null);
  best[0] = { cost: 0, words: [] };

  for (let index = 0; index < lower.length; index += 1) {
    if (!best[index]) continue;
    const max = Math.min(lower.length, index + 24);
    for (let end = index + 2; end <= max; end += 1) {
      const part = lower.slice(index, end);
      if (!WORDS.has(part)) continue;
      const cost = best[index].cost + 1 - Math.min(part.length, 12) / 100;
      if (!best[end] || cost < best[end].cost) {
        best[end] = { cost, words: [...best[index].words, part] };
      }
    }
  }

  const solution = best[lower.length]?.words || [];
  if (solution.length < 2) return original;
  return capitalizeLike(original, solution);
}

function repairJoinedWords(value) {
  let text = normalizeWhitespace(value);
  if (!text) return '';

  text = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bWhichofthefollowing/gi, 'Which of the following ')
    .replace(/viewsisheldbyeducatorswhobelievethatteachingisascience/gi, 'views is held by educators who believe that teaching is a science')
    .replace(/viewsisheldbyeducatorswhobelievethatteachingisanart/gi, 'views is held by educators who believe that teaching is an art')
    .replace(/teachingfollowthescientificprinciple/gi, 'teaching follow the scientific principle')
    .replace(/teachinginvolvesspecificlawsandprinciples/gi, 'teaching involves specific laws and principles')
    .replace(/teachingcanbeviewedasadisciplinewhichrequiresextensivestudy/gi, 'teaching can be viewed as a discipline which requires extensive study')
    .replace(/teaching canbeviewedasadisciplinewhichrequiresextensivestudy/gi, 'teaching can be viewed as a discipline which requires extensive study')
    .replace(/theroleofteachersaresimilartotheroleofscientist/gi, 'the role of teachers are similar to the role of scientist')
    .replace(/effective([a-z]+)havenaturalinstinctsforteaching/gi, 'effective $1 have natural instincts for teaching')
    .replace(/effectiveteachershaveseveralartisticdisplaysontheirwalls/gi, 'effective teachers have several artistic displays on their walls')
    .replace(/effectiveteacherscoordinatetheirclassroomactivitieseverywell/gi, 'effective teachers coordinate their classroom activities very well')
    .replace(/effectiveteachershavegoodbehavior/gi, 'effective teachers have good behavior')
    .replace(/effective teachershaveseveralartisticdisplaysontheirwalls/gi, 'effective teachers have several artistic displays on their walls')
    .replace(/effective teacherscoordinatetheirclassroomactivitieseverywell/gi, 'effective teachers coordinate their classroom activities very well')
    .replace(/effective teachershavegoodbehavior/gi, 'effective teachers have good behavior')
    .replace(/skillsisthemostimportantforeffectiveteachers/gi, 'skill is the most important for effective teachers')
    .replace(/Decisiontaking/gi, 'Decision taking')
    .replace(/Visualillustrations/gi, 'Visual illustrations')
    .replace(/Identifyingdifficultpupils/gi, 'Identifying difficult pupils')
    .replace(/Changingtasks/gi, 'Changing tasks')
    .replace(/diagnosticiscalled/gi, 'diagnostic is called')
    .replace(/Theaggregateofalltheprocessesbymeansofwhichapersondevelops/gi, 'The aggregate of all the processes by means of which a person develops')
    .replace(/\bThetypeof/gi, 'The type of ')
    .replace(/\bCurriculumcan/gi, 'Curriculum can')
    .replace(/canbedescribedasthefollowingexcept/gi, 'can be described as the following except')
    .replace(/scholarsdefinededucationasadeliberateattemptto/gi, 'scholars defined education as a deliberate attempt to')
    .replace(/acquireandtotransmittheaccumulated/gi, 'acquire and to transmit the accumulated')
    .replace(/andunderstandingfromonehumangenerationtothenext/gi, 'and understanding from one human generation to the next')
    .replace(/skills,attitudes,knowledge/gi, 'skills, attitudes, knowledge')
    .replace(/abilities,skillsandotherformsofbehaviour/gi, 'abilities, skills and other forms of behaviour')
    .replace(/ofpositiveandsometimesof/gi, 'of positive and sometimes of')
    .replace(/negativevaluetothesocietyinwhichhelives/gi, 'negative value to the society in which he lives')
    .replace(/attainitseducationalgoal/gi, 'attain its educational goal')
    .replace(/Allthelearningofstudentswhichisplannedbyanddirectedbytheschoolto/gi, 'All the learning of students which is planned by and directed by the school to')
    .replace(/Aplanforlearning/gi, 'A plan for learning')
    .replace(/Theplannedexperiencesofferedtothelearnerundertheguidanceofthe/gi, 'The planned experiences offered to the learner under the guidance of the')
    .replace(/curriculumdesignsmakeseverysubjectaseparateunit/gi, 'curriculum designs make every subject a separate unit')
    .replace(/willdeterminehowmanysubjectsorclassesa/gi, 'will determine how many subjects or classes a')
    .replace(/teacherwillteachinaschool/gi, 'teacher will teach in a school')
    .replace(/Democraticevaluation/gi, 'Democratic evaluation')
    .replace(/Monocraticevaluation/gi, 'Monocratic evaluation')
    .replace(/\bTeachingcan/gi, 'Teaching can')
    .replace(/\bEffective([a-z])/gi, 'Effective $1')
    .replace(/\bResearcheson/gi, 'Researches on ')
    .replace(/\bTeachercentred/gi, 'Teacher centred')
    .replace(/\bsubjectcentred/gi, 'subject centred')
    .replace(/\bcorecurriculum\b/gi, 'core curriculum')
    .replace(/\bbroadfieldcurriculum\b/gi, 'broad field curriculum')
    .replace(/\bevaluation\b/gi, 'evaluation');

  text = text
    .split(/(\s+|[|,.;:!?()[\]{}"'/-]+)/)
    .map((part) => (/^[A-Za-z]{13,}$/.test(part) ? segmentToken(part) : part))
    .join('');

  const repaired = normalizeWhitespace(text)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/([A-Za-z])(_+)/g, '$1 $2')
    .replace(/(_+)([A-Za-z])/g, '$1 $2');
  return /^[A-Z]/.test(String(value || ''))
    ? repaired.charAt(0).toUpperCase() + repaired.slice(1)
    : repaired;
}

module.exports = {
  repairJoinedWords,
};
