#!/usr/bin/env node

const { PromptTemplateManager } = require('../dist/prompts');

async function main() {
  // TODO: use something like yargs to parse args
  if (process.argv[2] === 'gen-prompt-template-types') {
    const mgr = new PromptTemplateManager();
    await mgr.init({ generateTypes: true });
  }
}

main();
