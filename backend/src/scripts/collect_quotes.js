const { run } = require('./edutainment_collector');
run('quotes').catch((error) => { console.error(error); process.exitCode = 1; });
