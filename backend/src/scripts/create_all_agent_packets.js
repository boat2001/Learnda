'use strict';
/**
 * Create all no-API agent packets in one run:
 * - lessons
 * - quiz practice
 * - past-question practice
 *
 * Usage:
 *   node src/scripts/create_all_agent_packets.js
 *   node src/scripts/create_all_agent_packets.js --course="Child Development"
 *   node src/scripts/create_all_agent_packets.js --limit=10
 *   node src/scripts/create_all_agent_packets.js --no-ocr
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'create_agent_import_packets.js');

function pickForwardedArgs(argv) {
  return argv.filter((arg) =>
    /^--course=/.test(arg) ||
    /^--limit=/.test(arg) ||
    arg === '--no-ocr'
  );
}

function runPacketStep(label, args) {
  console.log(`\n[packets] ${label}`);
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    throw new Error(`${label} packet creation failed.`);
  }
}

function main() {
  const forwarded = pickForwardedArgs(process.argv.slice(2));

  runPacketStep('lessons', ['--kind=lessons', ...forwarded]);
  runPacketStep('quizzes', ['--kind=practice', '--type=quiz', ...forwarded]);
  runPacketStep('past questions', ['--kind=practice', '--type=past_question', ...forwarded]);

  console.log('\nAll agent packet batches completed.');
}

main();
