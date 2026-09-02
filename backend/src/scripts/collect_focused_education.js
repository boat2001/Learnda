/* eslint-disable no-console */
const { collectFocused } = require('./edutainment_collector');

async function run() {
  const countArg = process.argv.find((arg) => arg.startsWith('--count='));
  const count = Math.max(1, Number.parseInt(countArg?.slice(8) || '200', 10));
  const results = [];
  for (const category of ['quotes', 'facts', 'jokes', 'stories', 'articles']) {
    try { results.push(await collectFocused(category, count)); }
    catch (error) { results.push({ category, error: error.message }); }
  }
  console.log(JSON.stringify(results, null, 2));
  return results;
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { run };
