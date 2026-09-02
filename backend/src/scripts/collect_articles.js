const { run } = require('./edutainment_collector');
run('articles').catch((error) => { console.error(error); process.exitCode = 1; });
