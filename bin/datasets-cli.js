#!/usr/bin/env node

const { run } = require('../dist/datasets-cli');

async function main() {
  if (process.argv[2] === 'generate') {
    await run();
  } else {
    console.error(`Unknown command: ${process.argv.slice(2).join(' ')}`);
  }
}

main();
