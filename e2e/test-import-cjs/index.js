const { AutoblocksTracer } = require('@autoblocks/client');
const { AutoblocksCallbackHandler } = require('@autoblocks/client/langchain');

console.log(new AutoblocksTracer('test'));
console.log(new AutoblocksCallbackHandler());
