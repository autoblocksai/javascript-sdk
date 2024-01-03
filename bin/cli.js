#!/usr/bin/env node

const { run } = require('../dist/prompts-cli');

async function main() {
  // TODO: use something like yargs to parse args
  // This is called via `autoblocks prompts generate`
  if (process.argv[2] === 'prompts' && process.argv[3] === 'generate') {
    await run();
  } else {
    console.error(`Unknown command: ${process.argv.slice(2).join(' ')}`);
  }
}

main();
