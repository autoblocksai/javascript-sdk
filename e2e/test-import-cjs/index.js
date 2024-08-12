// eslint-disable-next-line
const { AutoblocksTracer } = require('@autoblocks/client');

// eslint-disable-next-line
console.log(new AutoblocksTracer('test'));

const assertLangchainImportThrowsError = () => {
  try {
    // eslint-disable-next-line
    require('@autoblocks/client/langchain');
  } catch {
    return;
  }

  throw new Error('Should not be able to import langchain module');
};

assertLangchainImportThrowsError();
