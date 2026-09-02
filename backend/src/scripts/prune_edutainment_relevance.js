/* eslint-disable no-console */
const { isTeacherRelevant, loadDataset, writeDataset } = require('./edutainment_collector');

function run() {
  const results = [];
  for (const category of ['quotes', 'facts', 'jokes', 'stories', 'articles']) {
    const dataset = loadDataset(category);
    const entries = dataset.entries.filter((item) => isTeacherRelevant(item, category));
    const removed = dataset.entries.length - entries.length;
    writeDataset(category, {
      ...dataset, entries, total: entries.length, updatedAt: new Date().toISOString(),
      relevancePolicy: 'teacher-learning-classroom-v1'
    });
    results.push({ category, removed, total: entries.length });
  }
  console.log(JSON.stringify(results, null, 2));
  return results;
}

if (require.main === module) run();
module.exports = { run };
