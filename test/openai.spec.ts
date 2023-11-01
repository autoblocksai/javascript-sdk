import crypto from 'crypto';
import { OpenAI } from 'openai';
import { AutoblocksTracer } from '../src';
import { traceOpenAI } from '../src/openai';

jest.setTimeout(60000);

const checkAllEqualAndDefined = (xs: string[]) => {
  expect(xs.every((x) => x === xs[0])).toBe(true);
  expect(xs.every(Boolean)).toBe(true);
};

describe('traceOpenAI', () => {
  process.env.AUTOBLOCKS_INGESTION_KEY = 'test';

  let tracer: AutoblocksTracer;

  beforeAll(async () => {
    tracer = await traceOpenAI();

    // Call multiple times to make sure the patch is idempotent
    await traceOpenAI();
    await traceOpenAI();
  });

  const openai = new OpenAI();

  let mockPost: jest.Mock;

  beforeEach(() => {
    mockPost = jest
      .fn()
      .mockResolvedValue({ data: { traceId: 'mock-trace-id' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tracer as any).client.post = mockPost;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tracer.setTraceId(undefined as any);
  });

  afterAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = undefined;
  });

  it('completions.create', async () => {
    await openai.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: 'Say this is a test.',
      temperature: 0,
    });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const timestamps = calls.map((call) => call[1].timestamp);
    const properties = calls.map((call) => call[1].properties);
    const spanIds = properties.map((p) => p.spanId);

    expect(messages).toEqual([
      'ai.completion.request',
      'ai.completion.response',
    ]);

    checkAllEqualAndDefined(traceIds);
    checkAllEqualAndDefined(spanIds);

    expect(timestamps.every(Boolean)).toBe(true);

    expect(properties[0].model).toEqual('gpt-3.5-turbo-instruct');
    expect(properties[0].prompt).toEqual('Say this is a test.');
    expect(properties[0].temperature).toEqual(0);
    expect(properties[0].provider).toEqual('openai');

    expect(properties[1].latencyMs).toBeDefined();
    expect(properties[1].response.choices[0].text).toBeDefined();
    expect(properties[1].response.usage).toBeDefined();
    expect(properties[1].response.model).toEqual('gpt-3.5-turbo-instruct');
    expect(properties[1].response.object).toEqual('text_completion');
    expect(properties[1].response.usage.prompt_tokens).toEqual(6);
  });

  it('chat.completions.create', async () => {
    await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-3.5-turbo',
    });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const timestamps = calls.map((call) => call[1].timestamp);
    const properties = calls.map((call) => call[1].properties);
    const spanIds = properties.map((p) => p.spanId);

    expect(messages).toEqual([
      'ai.completion.request',
      'ai.completion.response',
    ]);

    checkAllEqualAndDefined(traceIds);
    checkAllEqualAndDefined(spanIds);

    expect(timestamps.every(Boolean)).toBe(true);

    expect(properties[0].messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
    expect(properties[0].model).toEqual('gpt-3.5-turbo');
    expect(properties[0].provider).toEqual('openai');

    expect(properties[1].latencyMs).toBeDefined();
    expect(properties[1].response.choices[0].message.content).toBeDefined();
    expect(properties[1].response.usage).toBeDefined();
    expect(properties[1].response.model.startsWith('gpt-3.5-turbo-')).toBe(
      true,
    );
    expect(properties[1].response.object).toEqual('chat.completion');
    expect(properties[1].response.usage.prompt_tokens).toEqual(13);
  });

  it('chat.completion.create with custom event', async () => {
    const traceId = crypto.randomUUID();
    tracer.setTraceId(traceId);

    await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-3.5-turbo',
    });

    await tracer.sendEvent('custom.event');

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(3);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);

    expect(messages).toEqual([
      'ai.completion.request',
      'ai.completion.response',
      'custom.event',
    ]);
    expect(traceIds.every((t) => t === traceId)).toBe(true);
  });

  it("doesn't override the traceId if it's already set", async () => {
    const traceId = crypto.randomUUID();
    tracer.setTraceId(traceId);

    await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-3.5-turbo',
    });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const traceIds = calls.map((call) => call[1].traceId);
    expect(traceIds.every((t) => t === traceId)).toBe(true);
  });

  it('generates a new traceId for every openai call', async () => {
    await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-3.5-turbo',
    });
    await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-3.5-turbo',
    });

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(4);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const spanIds = calls.map((call) => call[1].properties.spanId);

    expect(messages).toEqual([
      'ai.completion.request',
      'ai.completion.response',
      'ai.completion.request',
      'ai.completion.response',
    ]);

    expect(traceIds[0]).toEqual(traceIds[1]);
    expect(traceIds[2]).toEqual(traceIds[3]);
    expect(traceIds[0]).not.toEqual(traceIds[2]);

    expect(spanIds[0]).toEqual(spanIds[1]);
    expect(spanIds[2]).toEqual(spanIds[3]);
    expect(spanIds[0]).not.toEqual(spanIds[2]);
  });

  it('completions.create (error)', async () => {
    try {
      await openai.completions.create({
        // Invalid model
        model: 'fdsa',
        prompt: 'Say this is a test.',
        temperature: 0,
      });
    } catch {
      // expected
    }

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const properties = calls.map((call) => call[1].properties);
    const spanIds = properties.map((p) => p.spanId);

    expect(messages).toEqual(['ai.completion.request', 'ai.completion.error']);

    checkAllEqualAndDefined(traceIds);
    checkAllEqualAndDefined(spanIds);

    expect(properties[0].model).toEqual('fdsa');
    expect(properties[0].prompt).toEqual('Say this is a test.');
    expect(properties[0].temperature).toEqual(0);
    expect(properties[0].provider).toEqual('openai');

    expect(properties[1].latencyMs).toBeDefined();
    expect(properties[1].error).toEqual(
      'Error: 404 The model `fdsa` does not exist',
    );
    expect(properties[1].provider).toEqual('openai');
  });

  it('chat.completions.create (error)', async () => {
    try {
      await openai.chat.completions.create({
        messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
        // Invalid model
        model: 'fdsa',
      });
    } catch {
      // expected
    }

    const calls = mockPost.mock.calls;
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call[1].message);
    const traceIds = calls.map((call) => call[1].traceId);
    const properties = calls.map((call) => call[1].properties);
    const spanIds = properties.map((p) => p.spanId);

    expect(messages).toEqual(['ai.completion.request', 'ai.completion.error']);

    checkAllEqualAndDefined(traceIds);
    checkAllEqualAndDefined(spanIds);

    expect(properties[0].messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
    expect(properties[0].model).toEqual('fdsa');
    expect(properties[0].provider).toEqual('openai');

    expect(properties[1].latencyMs).toBeDefined();
    expect(properties[1].error).toEqual(
      'Error: 404 The model `fdsa` does not exist',
    );
    expect(properties[1].provider).toEqual('openai');
  });
});
