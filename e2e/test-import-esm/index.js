import { AutoblocksTracer } from '@autoblocks/client';

console.log(new AutoblocksTracer('test'));

const assertLangchainImportThrowsError = async () => {
  try {
    await import('@autoblocks/client/langchain');
  } catch {
    return;
  }

  throw new Error('Should not be able to import langchain module');
};

assertLangchainImportThrowsError();
