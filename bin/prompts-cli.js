#!/usr/bin/env node

const { run } = require('../dist/prompts-cli');

async function main() {
  // TODO: move this into the new CLI at autoblocksai/cli
  if (process.argv[2] === 'generate') {
    await run();
  } else {
    console.error(`Unknown command: ${process.argv.slice(2).join(' ')}`);
  }
}

main();
