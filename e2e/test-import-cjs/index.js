const { AutoblocksTracer } = require('@autoblocks/client');

console.log(new AutoblocksTracer('test'));

const assertLangchainImportThrowsError = () => {
  try {
    require('@autoblocks/client/langchain');
  } catch {
    return;
  }

  throw new Error('Should not be able to import langchain module');
};

assertLangchainImportThrowsError();
