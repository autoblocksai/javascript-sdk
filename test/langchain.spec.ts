import { AutoblocksCallbackHandler } from '../src/langchain/index';

import { LLMChain } from 'langchain/chains';
import { OpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';

describe('AutoblocksCallbackHandler', () => {
  process.env.AUTOBLOCKS_INGESTION_KEY = 'test';

  let handler: AutoblocksCallbackHandler;
  let mockPost: jest.Mock;

  beforeEach(() => {
    handler = new AutoblocksCallbackHandler();

    mockPost = jest
      .fn()
      .mockResolvedValue({ data: { traceId: 'mock-trace-id' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (handler as any).tracer.client.post = mockPost;
  });

  afterAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = undefined;
  });

  it('openai llm chain', async () => {
    const llm = new OpenAI({ temperature: 0, callbacks: [handler] });
    const prompt = PromptTemplate.fromTemplate('2 + {number} =');
    const chain = new LLMChain({ prompt, llm, callbacks: [handler] });

    await chain.call({ number: 2 });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(4);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);

    expect(messages).toEqual([
      'langchain.chain.start',
      'langchain.llm.start',
      'langchain.llm.end',
      'langchain.chain.end',
    ]);

    // All traceIds should be equal and defined
    expect(traceIds.every(Boolean)).toBe(true);
    expect(traceIds.every((id) => id === traceIds[0])).toBe(true);
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
  });
});
