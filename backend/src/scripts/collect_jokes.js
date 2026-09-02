const { run } = require('./edutainment_collector');
run('jokes').catch((error) => { console.error(error); process.exitCode = 1; });
