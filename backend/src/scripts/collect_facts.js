const { run } = require('./edutainment_collector');
run('facts').catch((error) => { console.error(error); process.exitCode = 1; });
