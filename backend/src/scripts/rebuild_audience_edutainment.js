/* eslint-disable no-console */
const { facts, stories } = require('../data/audienceEdutainment');
const {
  fingerprint, loadDataset, normalize, writeDataset
} = require('./edutainment_collector');

function item(category, fields) {
  const body = normalize(fields.body);
  return {
    id: fingerprint(`${category}:${body}`), category, title: fields.title, body,
    summary: fields.summary || body.slice(0, 280), author: fields.author || 'Learnda Editorial',
    sourceName: fields.sourceName, sourceUrl: fields.sourceUrl, license: fields.license,
    imageUrl: null, tags: fields.tags, collectedAt: new Date().toISOString()
  };
}

function run() {
  const curatedFacts = facts.map(([title, body, sourceUrl]) => item('facts', {
    title, body, sourceUrl, sourceName: 'Learnda verified learning facts', license: 'Source-linked summary',
    tags: ['did-you-know', 'brain', 'learning', 'teaching', 'classroom']
  }));
  const factMap = new Map(curatedFacts.map((entry) => [fingerprint(entry.body), entry]));
  const factEntries = [...factMap.values()];
  writeDataset('facts', {
    ...loadDataset('facts'), entries: factEntries, total: factEntries.length,
    updatedAt: new Date().toISOString(), contentPolicy: 'did-you-know-learning-v1'
  });

  const storyEntries = stories.map((story) => item('stories', {
    title: story.title, body: story.body, summary: story.lesson, sourceName: 'Learnda original stories',
    sourceUrl: 'https://learnda.app', license: 'Learnda original',
    tags: ['student-teacher', 'ghana', 'classroom', 'teacher-life', 'reflection']
  }));
  writeDataset('stories', {
    ...loadDataset('stories'), entries: storyEntries, total: storyEntries.length,
    updatedAt: new Date().toISOString(), contentPolicy: 'learnda-audience-stories-v1'
  });
  const result = { facts: factEntries.length, stories: storyEntries.length };
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) run();
module.exports = { run };
