import crypto from 'crypto';
import { readFileSync } from 'fs';
import { AutoblocksCallbackHandler } from '../src/langchain/index';

import { LLMChain } from 'langchain/chains';
import { OpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';

import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { DynamicTool } from 'langchain/tools';

jest.setTimeout(200000);

// Used to verify we're sending the correct version
const CURRENT_LANGCHAIN_VERSION = JSON.parse(
  readFileSync('node_modules/langchain/package.json', 'utf8'),
).version;

const mockHandlerPost = (handler: AutoblocksCallbackHandler) => {
  const mockPost = jest
    .fn()
    .mockResolvedValue({ data: { traceId: 'mock-trace-id' } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (handler as any).tracer.client.post = mockPost;
  return mockPost;
};

describe('AutoblocksCallbackHandler', () => {
  process.env.AUTOBLOCKS_INGESTION_KEY = 'test';

  let handler: AutoblocksCallbackHandler;
  let mockPost: jest.Mock;

  beforeEach(() => {
    handler = new AutoblocksCallbackHandler();
    mockPost = mockHandlerPost(handler);
  });

  afterAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = undefined;
  });

  it('openai llm chain', async () => {
    const llm = new OpenAI({ temperature: 0 });
    const prompt = PromptTemplate.fromTemplate('2 + {number} =');
    const chain = new LLMChain({ prompt, llm });

    await chain.call({ number: 2 }, { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(4);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const properties = calls.map((call) => call[1].properties);

    expect(messages).toEqual([
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
    ]);

    // All traceIds should be equal and defined
    expect(traceIds.every(Boolean)).toBe(true);
    expect(traceIds.every((id) => id === traceIds[0])).toBe(true);

    // It should send the version and language with each event
    expect(
      properties.every(
        (prop) => prop.__langchainVersion === CURRENT_LANGCHAIN_VERSION,
      ),
    ).toBe(true);
    expect(
      properties.every((prop) => prop.__langchainLanguage === 'javascript'),
    ).toBe(true);
  });

  it('openai multiple chains', async () => {
    const prompt1 = PromptTemplate.fromTemplate(
      `What is the city {person} is from? Only respond with the name of the city.`,
    );
    const prompt2 = PromptTemplate.fromTemplate(
      `What country is the city {city} in? Respond in {language}.`,
    );

    const model = new ChatOpenAI({});

    const chain = prompt1.pipe(model).pipe(new StringOutputParser());

    const combinedChain = RunnableSequence.from([
      {
        city: chain,
        language: (input) => input.language,
      },
      prompt2,
      model,
      new StringOutputParser(),
    ]);

    await combinedChain.invoke(
      {
        person: 'Barack Obama',
        language: 'German',
      },
      { callbacks: [handler] },
    );

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(20);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const properties = calls.map((call) => call[1].properties);

    expect(messages).toEqual([
      'langchain.chain.start',
      'langchain.chain.start',
      'langchain.chain.start',
      'langchain.chain.start',
      'langchain.chain.end',
      'langchain.chain.start',
      'langchain.chain.end',
      'langchain.chatmodel.start',
      'langchain.llm.end',
      'langchain.chain.start',
      'langchain.chain.end',
      'langchain.chain.end',
      'langchain.chain.end',
      'langchain.chain.start',
      'langchain.chain.end',
      'langchain.chatmodel.start',
      'langchain.llm.end',
      'langchain.chain.start',
      'langchain.chain.end',
      'langchain.chain.end',
    ]);

    // All traceIds should be equal and defined
    expect(traceIds.every(Boolean)).toBe(true);
    expect(traceIds.every((id) => id === traceIds[0])).toBe(true);

    // It should send the version and language with each event
    expect(
      properties.every(
        (prop) => prop.__langchainVersion === CURRENT_LANGCHAIN_VERSION,
      ),
    ).toBe(true);
    expect(
      properties.every((prop) => prop.__langchainLanguage === 'javascript'),
    ).toBe(true);
  });

  it('resets the traceId for each call', async () => {
    const llm = new OpenAI({ temperature: 0 });
    const prompt = PromptTemplate.fromTemplate('2 + {number} =');
    const chain = new LLMChain({ prompt, llm });

    // First call
    await chain.call({ number: 2 }, { callbacks: [handler] });
    // Second call
    await chain.call({ number: 7 }, { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(8);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);

    expect(messages).toEqual([
      // First call
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
      // Second call
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
    ]);

    // First four calls should have the same traceId
    expect(traceIds.slice(0, 4).every(Boolean)).toBe(true);
    expect(traceIds.slice(0, 4).every((id) => id === traceIds[0])).toBe(true);
    // Last four calls should have the same traceId
    expect(traceIds.slice(4).every(Boolean)).toBe(true);
    expect(traceIds.slice(4).every((id) => id === traceIds[4])).toBe(true);
    // First and last traceIds should be different
    expect(traceIds[0]).not.toEqual(traceIds[4]);
  });

  it('gives access to the tracer', async () => {
    const llm = new OpenAI({ temperature: 0 });
    const prompt = PromptTemplate.fromTemplate('2 + {number} =');
    const chain = new LLMChain({ prompt, llm });

    const mockTraceId = crypto.randomUUID();
    // Set the trace id via the tracer on the handler
    handler.tracer.setTraceId(mockTraceId);

    await chain.call({ number: 2 }, { callbacks: [handler] });

    // Send a custom event via the tracer on the handler
    await handler.tracer.sendEvent('my.custom.event');

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(5);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);

    expect(messages).toEqual([
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
      'my.custom.event',
    ]);

    // All events (including the custom event) should have the same traceId
    expect(traceIds.every((traceId) => traceId === mockTraceId)).toBe(true);
  });

  it('works with agents and tools', async () => {
    const model = new OpenAI({ temperature: 0 });
    const tools = [
      new DynamicTool({
        name: 'FOO',
        description:
          'call this to get the value of foo. input should be an empty string.',
        func: async () => 'baz',
      }),
      new DynamicTool({
        name: 'BAR',
        description:
          'call this to get the value of bar. input should be an empty string.',
        func: async () => 'baz1',
      }),
    ];

    const executor = await initializeAgentExecutorWithOptions(tools, model, {
      agentType: 'zero-shot-react-description',
    });

    await executor.call(
      { input: 'What is the value of foo?' },
      { callbacks: [handler] },
    );

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(14);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);

    expect(messages).toEqual([
      'langchain.chain.start',
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
      'langchain.agent.action',
      'langchain.tool.start',
      'langchain.tool.end',
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
      'langchain.agent.end',
      'langchain.chain.end',
    ]);

    // All traceIds should be equal and defined
    expect(traceIds.every(Boolean)).toBe(true);
    expect(traceIds.every((id) => id === traceIds[0])).toBe(true);
  });
});

describe('AutoblocksCallbackHandler (prefixes and separators)', () => {
  process.env.AUTOBLOCKS_INGESTION_KEY = 'test';

  afterAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = undefined;
  });

  it('allows specifying a message prefix', async () => {
    const handler = new AutoblocksCallbackHandler({ messagePrefix: 'foo' });
    const mockPost = mockHandlerPost(handler);

    const llm = new OpenAI();
    await llm.predict('hi!', { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    expect(messages).toEqual(['foo.llm.start', 'foo.llm.end']);
  });

  it('allows specifying a message prefix and a message separator', async () => {
    const handler = new AutoblocksCallbackHandler({
      messagePrefix: 'foo',
      messageSeparator: '-',
    });
    const mockPost = mockHandlerPost(handler);

    const llm = new OpenAI();
    await llm.predict('hi!', { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    expect(messages).toEqual(['foo-llm-start', 'foo-llm-end']);
  });

  it('allows specifying an empty message prefix', async () => {
    const handler = new AutoblocksCallbackHandler({ messagePrefix: '' });
    const mockPost = mockHandlerPost(handler);

    const llm = new OpenAI();
    await llm.predict('hi!', { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    expect(messages).toEqual(['llm.start', 'llm.end']);
  });

  it('allows specifying a message separator', async () => {
    const handler = new AutoblocksCallbackHandler({ messageSeparator: '-' });
    const mockPost = mockHandlerPost(handler);

    const llm = new OpenAI();
    await llm.predict('hi!', { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    expect(messages).toEqual(['langchain-llm-start', 'langchain-llm-end']);
  });

  it('ignores empty message separators', async () => {
    const handler = new AutoblocksCallbackHandler({ messageSeparator: '' });
    const mockPost = mockHandlerPost(handler);

    const llm = new OpenAI();
    await llm.predict('hi!', { callbacks: [handler] });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    expect(messages).toEqual(['langchain.llm.start', 'langchain.llm.end']);
  });
});
