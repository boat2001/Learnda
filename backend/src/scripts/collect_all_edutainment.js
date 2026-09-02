/* eslint-disable no-console */
const { collect, parseArgs } = require('./edutainment_collector');

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];
  for (const category of ['quotes', 'facts', 'jokes', 'stories', 'articles']) {
    try { results.push(await collect(category, options)); }
    catch (error) { results.push({ category, error: error.message }); }
  }
  console.log(JSON.stringify(results, null, 2));
  if (results.every((item) => item.error)) process.exitCode = 1;
  return results;
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { run };
