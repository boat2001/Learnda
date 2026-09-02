/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../data/edutainment/collected');
const USER_AGENT = 'LearndaEdutainmentCollector/1.0 (https://learnda.app; educational indexing)';
const CATEGORIES = new Set(['quotes', 'facts', 'jokes', 'stories', 'articles']);
const WIKI_HOSTS = {
  quotes: 'https://en.wikiquote.org/w/api.php',
  facts: 'https://en.wikipedia.org/w/api.php',
  stories: 'https://en.wikipedia.org/w/api.php'
};
const SEARCHES = {
  quotes: ['education', 'learning', 'teachers', 'students', 'knowledge', 'motivation', 'leadership'],
  facts: [
    'spacing effect learning', 'testing effect memory', 'sleep and memory science', 'brain neuroplasticity',
    'history of zero mathematics', 'scientific discoveries', 'animal intelligence', 'human body science',
    'bilingualism language learning', 'Ghana history culture', 'classroom psychology', 'leadership psychology',
    'surprising astronomy discoveries', 'earth science phenomena', 'chemistry discoveries',
    'physics discoveries', 'ecology animal adaptation', 'geography world records', 'history of technology inventions'
  ],
  stories: ['Aesop fables moral', 'Panchatantra fables', 'African fables', 'Ghanaian folklore Anansi', 'teaching parable']
};
const EDUCATION_JOKES = [
  ['Why did the teacher wear sunglasses?', 'Because the students were so bright.'],
  ['Why was the mathematics book worried?', 'It had too many problems.'],
  ['Why did the student eat their homework?', 'The teacher said it was a piece of cake.'],
  ['Why did the pencil receive an award?', 'It was outstanding in its field of writing.'],
  ['Why was the geometry lesson so adorable?', 'It had acute angles.'],
  ['Why did the music teacher need a ladder?', 'To reach the high notes.'],
  ['Why did the history teacher visit the beach?', 'To study the current events.'],
  ['Why was the science teacher calm during the storm?', 'They knew how to conduct themselves.'],
  ['Why did the student bring a ladder to class?', 'They wanted to go to high school.'],
  ['What is a teacher\'s favourite nation?', 'Expla-nation.'],
  ['Why did the teacher write on the window?', 'They wanted the lesson to be clear.'],
  ['Why did the clock go to school?', 'It wanted to learn how to tell time.'],
  ['Why did the dictionary feel confident?', 'It knew it had the last word.'],
  ['Why did the student sit on the clock?', 'They wanted to be on time.'],
  ['What did the paper say to the pencil?', 'Write on!'],
  ['Why was the library so tall?', 'It had many stories.'],
  ['Why did the teacher bring string to class?', 'To tie the lesson together.'],
  ['Why did the student take a ruler to bed?', 'To see how long they slept.'],
  ['Why was the equal sign humble?', 'It knew it was no greater than or less than anyone else.'],
  ['Why did the biology teacher love gardening?', 'They enjoyed watching knowledge grow.'],
  ['What did one classroom wall say to the other?', 'Meet me at the corner.'],
  ['Why did the student become a gardener?', 'They wanted to improve their roots.'],
  ['Why are teachers good at gardening?', 'They help young minds grow.'],
  ['Why did the lesson cross the road?', 'To get to the other side of understanding.'],
  ['What is the best place to learn about angles?', 'A well-rounded classroom.'],
  ['Why did the book join the gym?', 'It wanted a stronger spine.'],
  ['Why was the globe invited to every lesson?', 'It had a world of knowledge.'],
  ['Why did the student carry an extra pen?', 'In case they had to draw a conclusion.'],
  ['Why did the teacher open the door?', 'To let new ideas in.'],
  ['Why do good questions make great classmates?', 'They always keep the conversation learning.']
];
const LEARNING_RIDDLES = [
  ['I grow when you ask questions and shrink when you assume you know everything. What am I?', 'Curiosity'],
  ['I keep yesterday available for today, but I improve when you practise recalling me. What am I?', 'Memory'],
  ['I am strengthened by mistakes when you reflect on them instead of hiding them. What am I?', 'Learning'],
  ['I can fill a classroom without taking up any space, and one good question can start me. What am I?', 'Discussion'],
  ['Teachers give me, learners use me, and I work best when I am specific and timely. What am I?', 'Feedback'],
  ['I divide study across several days and usually beat one long night of cramming. What am I?', 'Spaced practice'],
  ['I make you close the book and pull an answer from memory. What am I?', 'Retrieval practice'],
  ['I am not a grade, but I show a learner what to improve next. What am I?', 'Formative assessment'],
  ['I let learners think about how they think and choose better strategies. What am I?', 'Metacognition'],
  ['I become easier to cross when a teacher provides support and removes it gradually. What am I?', 'A learning scaffold'],
  ['I can turn many different learners into one problem-solving team. What am I?', 'Collaboration'],
  ['I am a short pause after a question that often produces longer, better answers. What am I?', 'Wait time'],
  ['I help a learner connect a new idea to something already understood. What am I?', 'Prior knowledge'],
  ['I am invisible, but belonging and safety help me grow in a classroom. What am I?', 'Confidence'],
  ['I tell a teacher whether to continue, reteach, or change direction during a lesson. What am I?', 'Student evidence'],
  ['I am carried by every learner, shaped by experience, and changed by practice. What am I?', 'The brain'],
  ['I organize what happens before, during, and after a lesson. What am I?', 'A lesson plan'],
  ['I make a difficult task manageable by breaking it into smaller steps. What am I?', 'Chunking'],
  ['I can be spoken, written, drawn, acted, or demonstrated to show understanding. What am I?', 'An explanation'],
  ['I improve a classroom when expectations are clear, fair, and consistent. What am I?', 'A routine'],
  ['I begin with listening and grow through trust between a teacher and learner. What am I?', 'A learning relationship'],
  ['I am useful information hidden inside an incorrect answer. What am I?', 'A misconception'],
  ['I let a student learn by watching a skilled example before trying alone. What am I?', 'Modelling'],
  ['I give the brain time to organize learning and often improve recall the next day. What am I?', 'Sleep'],
  ['I am a classroom where differences are planned for, not treated as interruptions. What am I?', 'An inclusive classroom'],
  ['I ask what changed in a learner, not merely what content a teacher covered. What am I?', 'A learning outcome'],
  ['I grow when a teacher notices effort, strategy, and progress rather than talent alone. What am I?', 'A growth mindset'],
  ['I help learners remember by combining words with a meaningful picture. What am I?', 'Dual coding'],
  ['I am the courage to say “I do not understand yet.” What am I?', 'A learning mindset'],
  ['I turn a classroom from a place of answers into a place of investigation. What am I?', 'Inquiry']
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const envInt = (name, fallback) => Math.max(0, Number.parseInt(process.env[name] || fallback, 10));

function parseArgs(argv) {
  const args = { category: null, limit: envInt('EDUTAINMENT_COLLECT_LIMIT', 5000), dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--category=')) args.category = arg.slice(11).toLowerCase();
    else if (arg.startsWith('--limit=')) args.limit = Math.max(1, Number.parseInt(arg.slice(8), 10) || 1);
  }
  return args;
}

function normalize(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/\[[0-9]+\]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanWikiText(value) {
  return normalize(String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^/>]*\/>/gi, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, ''));
}

function fingerprint(value) {
  const normalized = normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function isTeacherRelevant(item, category = item?.category) {
  if (item?.tags?.includes('english-course-reading')) return true;
  const text = `${item?.title || ''} ${item?.body || ''}`;
  const core = /\b(brain|neuro\w*|cognit\w*|memory|attention|curiosity|motivat\w*|learn\w*|teach\w*|educat\w*|student\w*|pupil\w*|classroom\w*|school\w*|academic\w*|study|studies|studying|lesson\w*|pedagog\w*|curricul\w*|assessment\w*|exam\w*|literacy|knowledge|instruction\w*|adolescen\w*|metacogn\w*|feedback|homework|college|university|mentor\w*|inclusive education|special needs|child development)\b/i;
  if (core.test(text)) return true;
  if (category === 'jokes') {
    return /\b(mathemat\w*|geometry|science|history|geography|language|reading|writing|book|pencil|library|music|biology|dictionary|globe)\b/i.test(text);
  }
  return false;
}

function isInterestingFact(item) {
  const body = normalize(item?.body).replace(/^Did you know\?\s*/i, '');
  if (!body || !isTeacherRelevant({ ...item, body }, 'facts')) return false;
  if (/thumb\||\{\{|\[\[|\s\*\s/.test(body)) return false;
  if (/\b(may refer to|can refer to|disambiguation|list of|lists of|ministry of|department of|centre for|center for|association of|institute of|journal of|education in [A-Z]|higher education in|compulsory education|national education system)\b/i.test(body)) return false;
  if (/^(?:thumb\S*\s*)?[^.!?]{0,120}\b(?:is|are|was|were|refers to|encompasses|attempts to describe|is defined as|means)\b/i.test(body)) return false;
  return /\b(can|could|may|might|often|usually|when|while|because|than|after|before|during|helps?|improv\w*|affect\w*|support\w*|interfere\w*|increase\w*|reduce\w*|strengthen\w*|remember\w*|forget\w*|attention|memory|brain|practice|feedback|stress|sleep|belong\w*)\b/i.test(body);
}

function shortFact(value) {
  const text = normalize(value);
  if (!text || /^\{\{|infobox/i.test(text)) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let fact = '';
  const candidates = sentences.slice(0, 4).map((sentence, index) => ({
    sentence: sentence.trim(),
    score: (/\d|first|only|discover|can |known|largest|smallest|oldest|youngest|more than|less than/i.test(sentence) ? 3 : 0)
      - (/^[^.!?]{1,80}\s(?:is|are|was|were)\s/i.test(sentence) ? 1 : 0) - index * 0.1
  })).sort((a, b) => b.score - a.score);
  for (const { sentence } of candidates) {
    const candidate = `${fact} ${sentence}`.trim();
    if (candidate.length > 280) break;
    fact = candidate;
    if (fact.length >= 80) break;
  }
  if (!fact) fact = text.slice(0, 277).replace(/\s+\S*$/, '').trim() + '...';
  return fact.length >= 35 ? fact : '';
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function writeDataset(category, dataset) {
  atomicJson(path.join(ROOT, `${category}.json`), dataset);
  const shardSize = Math.max(100, envInt('EDUTAINMENT_SHARD_SIZE', 1000));
  const shardDir = path.join(ROOT, 'shards', category);
  const parts = [];
  for (let offset = 0; offset < dataset.entries.length; offset += shardSize) {
    const number = Math.floor(offset / shardSize) + 1;
    const filename = `part-${String(number).padStart(4, '0')}.json`;
    const entries = dataset.entries.slice(offset, offset + shardSize);
    atomicJson(path.join(shardDir, filename), {
      schemaVersion: dataset.schemaVersion, category, part: number, entries, total: entries.length
    });
    parts.push({ file: filename, count: entries.length });
  }
  atomicJson(path.join(shardDir, 'index.json'), {
    schemaVersion: dataset.schemaVersion, category, updatedAt: dataset.updatedAt,
    total: dataset.entries.length, shardSize, parts
  });
}

async function fetchJson(url, attempts = envInt('EDUTAINMENT_COLLECT_RETRIES', 3) || 1) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), envInt('EDUTAINMENT_COLLECT_TIMEOUT_MS', 20000));
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      return await response.json();
    } catch (caught) {
      error = caught;
      if (attempt < attempts) await sleep(Math.min(1000 * (2 ** (attempt - 1)), 8000));
    } finally { clearTimeout(timer); }
  }
  throw error;
}

function baseItem(category, fields) {
  const body = normalize(fields.body);
  if (!body || body.length < 20) return null;
  return {
    id: fingerprint(`${category}:${body}`), category, title: normalize(fields.title) || body.slice(0, 90),
    body, summary: normalize(fields.summary) || body.slice(0, 280), author: normalize(fields.author) || null,
    sourceName: fields.sourceName, sourceUrl: fields.sourceUrl, license: fields.license || null,
    imageUrl: fields.imageUrl || null, tags: [...new Set(fields.tags || [])], collectedAt: new Date().toISOString()
  };
}

function wikiUrl(host, params) {
  const url = new URL(host);
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

async function wikiSearch(category, limit, terms = SEARCHES[category]) {
  const host = WIKI_HOSTS[category];
  const results = [];
  for (const term of terms) {
    let offset = 0;
    while (results.length < limit) {
      const count = Math.min(50, limit - results.length);
      const data = await fetchJson(wikiUrl(host, {
        generator: 'search', gsrsearch: term, gsrnamespace: '0', gsrlimit: String(count), gsroffset: String(offset),
        prop: 'extracts|pageimages|info|revisions', exintro: category !== 'stories' ? '1' : '0', explaintext: '1', exlimit: 'max',
        rvprop: 'content', rvslots: 'main',
        piprop: 'thumbnail', pithumbsize: '900', inprop: 'url'
      }));
      const pages = data.query?.pages || [];
      if (!pages.length) break;
      for (const page of pages) {
        const revisionText = page.revisions?.[0]?.slots?.main?.content || '';
        const text = normalize(page.extract) || cleanWikiText(revisionText);
        const url = page.fullurl;
        if (!text || !url) continue;
        if (category === 'quotes') {
          const lines = revisionText.split(/\r?\n/);
          for (let index = 0; index < lines.length; index += 1) {
            if (!/^\*[^*]/.test(lines[index])) continue;
            const quote = cleanWikiText(lines[index].replace(/^\*\s*/, ''));
            const attribution = /^\*\*/.test(lines[index + 1] || '')
              ? cleanWikiText(lines[index + 1].replace(/^\*+\s*/, '')) : '';
            if (quote.length < 25 || quote.length > 600) continue;
            results.push(baseItem(category, {
              title: page.title, body: quote, author: attribution || page.title, sourceName: 'Wikiquote', sourceUrl: url,
              license: 'CC BY-SA 4.0', imageUrl: page.thumbnail?.source, tags: [term, 'education']
            }));
          }
        } else {
          const body = category === 'stories' ? text.slice(0, 5000) : shortFact(text);
          results.push(baseItem(category, {
            title: page.title, body, summary: body.slice(0, 280), author: category === 'stories' ? page.title : null,
            sourceName: 'Wikipedia', sourceUrl: url, license: 'CC BY-SA 4.0',
            imageUrl: page.thumbnail?.source, tags: [term, category === 'facts' ? 'did-you-know' : 'inspiration']
          }));
        }
      }
      offset += pages.length;
      if (!data.continue || offset >= 1000) break;
      await sleep(envInt('EDUTAINMENT_COLLECT_DELAY_MS', 300));
    }
  }
  return results.filter(Boolean).slice(0, limit);
}

async function collectJokes(limit) {
  const datasetUrl = 'https://raw.githubusercontent.com/15Dkatz/official_joke_api/master/jokes/index.json';
  const riddlesUrl = 'https://raw.githubusercontent.com/nkilm/riddles-api/main/data/riddles.json';
  const unsafe = /\b(sex|porn|nazi|suicide|rape|genital|penis|vagina|prostitut|racist|blonde)\b/i;
  const technical = /\b(program(?:mer|ming)?|developer|software|code|coding|javascript|java|python|database|server|linux|git|array|boolean|function|algorithm|computer)\b/i;
  const items = [];
  for (const [setup, punchline] of EDUCATION_JOKES) {
    items.push(baseItem('jokes', {
      title: setup, body: `${setup} ${punchline}`, author: 'Traditional classroom joke',
      sourceName: 'Learnda classroom collection', sourceUrl: 'https://learnda.app',
      license: 'Learnda-curated', tags: ['student-safe', 'teacher', 'classroom', 'education']
    }));
  }
  const data = await fetchJson(datasetUrl);
  for (const joke of data) {
    const body = `${joke.setup} ${joke.punchline}`;
    if (joke.type !== 'general' || unsafe.test(body) || technical.test(body) || body.length > 260) continue;
    items.push(baseItem('jokes', { title: joke.setup, body, author: 'Anonymous', sourceName: 'Official Joke API',
      sourceUrl: 'https://github.com/15Dkatz/official_joke_api', license: 'Open API; see source repository', tags: ['student-safe', joke.type] }));
    if (items.length >= limit) break;
  }
  if (items.length < limit) {
    const riddles = await fetchJson(riddlesUrl);
    for (const riddle of riddles) {
      const question = normalize(riddle.riddle);
      const answer = normalize(riddle.answer);
      const body = `${question} Answer: ${answer}`;
      if (!question || !answer || unsafe.test(body) || technical.test(body) || body.length > 320) continue;
      items.push(baseItem('jokes', {
        title: question, body, author: 'Anonymous', sourceName: 'Riddles API dataset',
        sourceUrl: 'https://github.com/nkilm/riddles-api', license: 'MIT',
        tags: ['student-safe', 'riddle', 'brain-teaser']
      }));
      if (items.length >= limit) break;
    }
  }
  return items.filter(Boolean);
}

async function collectArticles(limit, query = 'teacher education training Ghana classroom learning pedagogy') {
  const items = [];
  let cursor = '*';
  while (items.length < limit) {
    const rows = Math.min(200, limit - items.length);
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query', query);
    url.searchParams.set('filter', 'type:journal-article');
    url.searchParams.set('select', 'DOI,title,abstract,author,URL,publisher,subject,published');
    url.searchParams.set('rows', String(rows));
    url.searchParams.set('cursor', cursor);
    url.searchParams.set('mailto', process.env.EDUTAINMENT_CONTACT_EMAIL || 'admin@learnda.app');
    const data = await fetchJson(url.href);
    const records = data.message?.items || [];
    for (const record of records) {
      const title = normalize(record.title?.[0]);
      const abstract = normalize(record.abstract);
      const body = abstract || `${title}. Read the source publication for the full article.`;
      const authors = (record.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', ');
      items.push(baseItem('articles', { title, body, summary: body.slice(0, 400), author: authors,
        sourceName: record.publisher || 'Crossref', sourceUrl: record.URL || `https://doi.org/${record.DOI}`,
        license: 'Metadata indexed by Crossref; article rights remain with publisher', tags: ['ghana', 'teacher-training', ...(record.subject || []).slice(0, 5)] }));
    }
    cursor = data.message?.['next-cursor'];
    if (!cursor || !records.length) break;
    await sleep(envInt('EDUTAINMENT_COLLECT_DELAY_MS', 300));
  }
  return items.filter(Boolean);
}

function loadDataset(category) {
  const file = path.join(ROOT, `${category}.json`);
  if (!fs.existsSync(file)) return { schemaVersion: 'learnda.edutainment.v1', category, updatedAt: null, total: 0, entries: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function prepareCurrent(category, dataset) {
  const relevantEntries = dataset.entries.filter((item) => isTeacherRelevant(item, category));
  const relevantDataset = { ...dataset, total: relevantEntries.length, entries: relevantEntries };
  if (category === 'jokes') {
    const technical = /\b(program(?:mer|ming)?|developer|software|code|coding|javascript|java|python|database|server|linux|git|array|boolean|function|algorithm|computer)\b/i;
    const entries = relevantDataset.entries.filter((item) => !technical.test(`${item.title} ${item.body}`));
    return { ...relevantDataset, total: entries.length, entries };
  }
  if (category !== 'facts') return relevantDataset;
  const entries = relevantDataset.entries.filter(isInterestingFact).map((item) => {
    const body = shortFact(item.body);
    if (!body) return null;
    return { ...item, body, summary: body };
  }).filter(Boolean);
  return { ...relevantDataset, total: entries.length, entries };
}

function merge(dataset, incoming, limit) {
  const seen = new Set();
  const entries = [];
  for (const item of [...dataset.entries, ...incoming]) {
    if (!item?.body) continue;
    const key = fingerprint(item.body);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(item);
  }
  return { ...dataset, updatedAt: new Date().toISOString(), requestedTarget: limit, total: entries.length, entries };
}

async function collect(category, options = {}) {
  if (!CATEGORIES.has(category)) throw new Error(`Unknown category: ${category}`);
  const limit = options.limit || 1000;
  const original = loadDataset(category);
  const current = prepareCurrent(category, original);
  const needed = Math.max(0, limit - current.entries.length);
  if (!needed) {
    if (!options.dryRun && current.entries.some((item, index) => item.body !== original.entries[index]?.body)) {
      writeDataset(category, { ...current, updatedAt: new Date().toISOString() });
    }
    return { category, added: 0, total: current.entries.length };
  }
  const batchSize = Math.max(1, options.batchSize || envInt('EDUTAINMENT_COLLECT_BATCH_SIZE', 500));
  const batchNeeded = Math.min(needed, batchSize);
  let incoming;
  if (category === 'jokes') incoming = await collectJokes(batchNeeded * 3);
  else if (category === 'articles') incoming = await collectArticles(batchNeeded);
  else incoming = await wikiSearch(category, category === 'facts' ? batchNeeded * 4 : batchNeeded);
  const merged = merge(current, incoming.filter((item) => isTeacherRelevant(item, category)
    && (category !== 'facts' || isInterestingFact(item))), limit);
  if (!options.dryRun) writeDataset(category, merged);
  return {
    category, added: merged.total - current.entries.length, total: merged.total,
    target: limit, dryRun: Boolean(options.dryRun)
  };
}

async function collectFocused(category, count = 200, options = {}) {
  if (!CATEGORIES.has(category)) throw new Error(`Unknown category: ${category}`);
  const current = prepareCurrent(category, loadDataset(category));
  const terms = {
    quotes: ['teachers', 'classroom', 'students', 'memory', 'brain', 'learning from mistakes'],
    facts: ['learning science memory', 'brain attention', 'teacher student relationship', 'classroom psychology',
      'retrieval practice education', 'teacher wellbeing', 'student motivation', 'sleep learning'],
    stories: ['inspiring teacher biography', 'education reformer biography', 'student activism education',
      'school life story', 'classroom teaching', 'Ghanaian educator'],
    articles: []
  };
  let incoming = [];
  if (category === 'jokes') {
    incoming = LEARNING_RIDDLES.map(([question, answer]) => baseItem('jokes', {
      title: question, body: `${question} Answer: ${answer}`, author: 'Learnda',
      sourceName: 'Learnda learning riddles', sourceUrl: 'https://learnda.app',
      license: 'Learnda original', tags: ['teacher', 'student', 'classroom', 'learning', 'brain-teaser']
    }));
  } else if (category === 'articles') {
    incoming = await collectArticles(count, 'teacher wellbeing classroom management student learning brain memory Ghana');
  } else {
    incoming = await wikiSearch(category, count * 3, terms[category]);
  }
  const merged = merge(current, incoming.filter((item) => item && isTeacherRelevant(item, category)), current.entries.length + count);
  if (!options.dryRun) writeDataset(category, merged);
  return { category, added: merged.total - current.entries.length, total: merged.total };
}

async function run(categoryOverride) {
  const args = parseArgs(process.argv.slice(2));
  const category = categoryOverride || args.category;
  const result = await collect(category, args);
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = {
  collect, collectFocused, run, parseArgs, normalize, fingerprint, merge, loadDataset,
  shortFact, isTeacherRelevant, isInterestingFact, atomicJson, writeDataset, ROOT
};
