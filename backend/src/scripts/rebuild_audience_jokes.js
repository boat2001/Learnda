/* eslint-disable no-console */
const jokes = require('../data/audienceJokes');
const { fingerprint, loadDataset, normalize, writeDataset } = require('./edutainment_collector');

function makeItem(title, body, sourceName, tags) {
  const clean = normalize(body);
  return {
    id: fingerprint(`jokes:${clean}`), category: 'jokes', title, body: clean, summary: clean,
    author: 'Sharether Editorial', sourceName, sourceUrl: 'https://sharether.com',
    license: 'Sharether original', imageUrl: null, tags, collectedAt: new Date().toISOString()
  };
}

function run() {
  const current = loadDataset('jokes');
  const unsuitable = /\b(kidnap\w*|drugs?|cross-eyed|hate|poutine)\b/i;
  const sourcedJokes = current.entries.filter((entry) => !entry.tags?.includes('riddle')
    && !entry.tags?.includes('brain-teaser') && !unsuitable.test(entry.body));
  const originalJokes = jokes.map(([title, body]) => makeItem(title, body, 'Sharether teacher-life jokes', [
    'joke', 'funny', 'teacher', 'student-teacher', 'classroom', 'education'
  ]));
  const riddles = current.entries.filter((entry) => entry.sourceName === 'Sharether learning riddles').slice(0, 10);
  const unique = new Map([...sourcedJokes, ...originalJokes, ...riddles]
    .map((entry) => [fingerprint(entry.body), entry]));
  const entries = [...unique.values()];
  writeDataset('jokes', {
    ...current, entries, total: entries.length, updatedAt: new Date().toISOString(),
    contentPolicy: 'teacher-humour-90-jokes-10-riddles-v1'
  });
  const result = { total: entries.length, jokes: entries.length - riddles.length, riddles: riddles.length };
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) run();
module.exports = { run };
