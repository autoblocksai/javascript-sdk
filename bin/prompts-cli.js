#!/usr/bin/env node

const { run, runV2 } = require('../dist/prompts-cli');

async function main() {
  if (process.argv[2] === 'generate') {
    console.log('Generating V1 prompts...');
    await run();
  } else if (process.argv[2] === 'generate-v2') {
    console.log('Generating V2 prompts...');
    await runV2();
  } else {
    console.error(`Unknown command: ${process.argv.slice(2).join(' ')}`);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred: ', error);
  process.exit(1);
});
