/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { fingerprint, loadDataset, writeDataset } = require('./edutainment_collector');

const SOURCE_FILE = '141-chicken-soup-for-the-soul.pdf';
const SOURCE_SHA256 = '6a1f8deadd04a4a807cb6bb25d5066b560632d0088f5ccdd8d79c92973fd75ad';
const BOOK = 'Chicken Soup for the Soul';
const BOOK_AUTHORS = 'Jack Canfield and Mark Victor Hansen';
const selected = [
  {
    category: 'stories', title: 'Love: The One Creative Force', author: 'Eric Butterworth', page: 3,
    summary: 'A teacher’s long-term influence becomes visible when former pupils credit her care and belief in them for changing the direction of their lives. The story invites teachers to consider how genuine regard can shape expectations, resilience, and possibility.',
    lesson: 'Learners may remember how a teacher regarded them long after they forget individual lessons.',
    tags: ['teacher-influence', 'care', 'expectations']
  },
  {
    category: 'stories', title: 'Who You Are Makes a Difference', author: 'Helice Bridges', page: 13,
    summary: 'A teacher begins a recognition activity with her senior students, and the acknowledgements travel beyond the classroom into workplaces and families. The chain illustrates how specific, sincere recognition can affect belonging and relationships.',
    lesson: 'Specific recognition can travel beyond the classroom and help people understand their value.',
    tags: ['recognition', 'belonging', 'class-project']
  },
  {
    category: 'stories', title: 'One at a Time', author: 'Jack Canfield and Mark Victor Hansen', page: 13,
    summary: 'A person helping stranded starfish is challenged because the task is too large to finish. The response focuses on the individual already helped, offering student teachers a reflection on meaningful impact when no one educator can solve every problem.',
    lesson: 'A teacher does not need to solve every problem before helping the learner within reach.',
    tags: ['individual-support', 'teacher-impact', 'service']
  },
  {
    category: 'stories', title: 'On Courage', author: 'Dan Millman', page: 18,
    summary: 'A child agrees to help a seriously ill sibling despite misunderstanding the personal cost. The account presents courage as action taken while afraid and reminds educators that examples of courage can become powerful teachers themselves.',
    lesson: 'Courage is often learned through witnessing and reflecting on another person’s choices.',
    tags: ['courage', 'learning-from-experience', 'reflection']
  },
  {
    category: 'stories', title: 'A Simple Gesture', author: 'John W. Schlatter', page: 23,
    summary: 'A student notices a peer struggling with a heavy load and offers companionship without knowing the depth of the crisis. Their later conversation reveals how an ordinary act of attention can interrupt isolation. This story should be presented with a mental-health content note.',
    lesson: 'Small acts of peer care can matter greatly; warning signs of distress should also be referred to trusted adults and professional support.',
    tags: ['peer-support', 'student-wellbeing', 'mental-health-content-note']
  },
  {
    category: 'stories', title: 'Carpe Diem!', author: 'Alan Cohen', page: 30,
    summary: 'Using a transformative fictional teacher as a starting point, the author reflects on acting with courage instead of waiting for certainty. For student teachers, the relevant question is how education can help learners examine inherited expectations and form purposeful goals.',
    lesson: 'Education can create space for learners to examine expectations and make thoughtful choices about their lives.',
    tags: ['student-agency', 'purpose', 'teacher-influence']
  },
  {
    category: 'stories', title: 'Why I Chose My Father to Be My Dad', author: 'Bettie B. Youngs', page: 54,
    summary: 'An educator remembers how conversations with a parent connected history, travel, formal education, confidence, and wisdom to everyday work. The reflection shows that teaching often happens through patient explanation, repeated encouragement, and shared experience.',
    lesson: 'Encouragement and explanation can shape a learner’s sense of what is possible over many years.',
    tags: ['informal-learning', 'encouragement', 'lifelong-learning']
  },
  {
    category: 'stories', title: 'The Animal School', author: 'George H. Reavis', page: 59,
    summary: 'An imaginary school requires every animal to master the same activities in the same way. Existing strengths are neglected while differences are treated as failures. The fable offers a direct prompt for discussing differentiation, inclusion, assessment, and the limits of uniform expectations.',
    lesson: 'Equal requirements are not always equitable when learners bring different strengths and needs.',
    tags: ['differentiation', 'inclusion', 'assessment', 'fable']
  },
  {
    category: 'articles', title: 'The Rules for Being Human: A Reflection Guide', author: 'Cherie Carter-Scott', page: 52,
    summary: 'A reflective framework presents life as continuing learning through experimentation, repeated lessons, personal choice, and self-examination. Learnda readers can use the ideas as prompts for journaling about mistakes, growth, and professional identity rather than as fixed rules.',
    lesson: 'Reflection turns experience, including unsuccessful attempts, into material for continued learning.',
    tags: ['reflection', 'growth', 'professional-identity']
  },
  {
    category: 'articles', title: 'Children Learn What They Live: Classroom Reflection', author: 'Dorothy Law Nolte', page: 53,
    summary: 'A well-known reflective piece contrasts environments shaped by criticism, hostility, or shame with those shaped by encouragement, fairness, acceptance, and security. It can support discussion about classroom climate while avoiding the claim that any single influence determines a child’s development.',
    lesson: 'The repeated social climate adults create can influence how children participate, relate, and view themselves.',
    tags: ['classroom-climate', 'child-development', 'encouragement']
  }
];

function toEntry(record) {
  const body = `${record.summary}\n\nKey reflection: ${record.lesson}`;
  return {
    id: fingerprint(`${record.category}:${record.title}:${body}`), category: record.category,
    title: record.title, body, summary: record.summary, author: record.author,
    sourceName: BOOK, sourceUrl: null, license: 'Copyrighted work - summary and metadata only',
    imageUrl: null, tags: ['book-summary', 'teacher-education', ...record.tags],
    collectedAt: new Date().toISOString(), metadata: {
      book: BOOK, bookAuthors: BOOK_AUTHORS, sourceFile: SOURCE_FILE,
      sourceSha256: SOURCE_SHA256, pdfPage: record.page, rightsTreatment: 'summary-only-no-full-text'
    }
  };
}

function run() {
  const results = {};
  for (const category of ['stories', 'articles']) {
    const dataset = loadDataset(category);
    const additions = selected.filter((item) => item.category === category).map(toEntry);
    const unique = new Map([...dataset.entries, ...additions].map((entry) => [fingerprint(entry.body), entry]));
    const entries = [...unique.values()];
    writeDataset(category, { ...dataset, entries, total: entries.length, updatedAt: new Date().toISOString() });
    results[category] = { added: entries.length - dataset.entries.length, total: entries.length };
  }
  const indexPath = path.resolve(__dirname, '../../data/edutainment/sources/chicken-soup-for-the-soul.index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify({
    source: { title: BOOK, authors: BOOK_AUTHORS, file: SOURCE_FILE, sha256: SOURCE_SHA256, pages: 193 },
    rightsTreatment: 'Copyrighted source: store original summaries and metadata only; do not store full story text.',
    classifications: { stories: 8, articles: 2, quotes: 0, facts: 0, jokes: 0 },
    selected: selected.map(({ category, title, author, page, tags }) => ({ category, title, author, pdfPage: page, tags }))
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(results));
  return results;
}

if (require.main === module) run();
module.exports = { run, selected };
