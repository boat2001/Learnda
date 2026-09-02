const { run } = require('./edutainment_collector');
run('stories').catch((error) => { console.error(error); process.exitCode = 1; });
