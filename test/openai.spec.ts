import crypto from 'crypto';
import { OpenAI } from 'openai';
import { AutoblocksTracer } from '../src';
import { traceOpenAI } from '../src/openai';

jest.setTimeout(200000);

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

  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - TS wants me to fully mock a fetch response, but we only
      // need the json() method
      .mockResolvedValue({ json: () => Promise.resolve({}) });

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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);
    const timestamps = calls.map((call) => call.timestamp);
    const properties = calls.map((call) => call.properties);
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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);
    const timestamps = calls.map((call) => call.timestamp);
    const properties = calls.map((call) => call.properties);
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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(3);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);

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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(2);

    const traceIds = calls.map((call) => call.traceId);
    expect(traceIds.every((t) => t === traceId)).toBe(true);
  });

  it('generates a new traceId for every openai call', async () => {
    await Promise.all([
      openai.chat.completions.create({
        messages: [{ role: 'system', content: 'Hello!' }],
        model: 'gpt-3.5-turbo',
      }),
      openai.chat.completions.create({
        messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
        model: 'gpt-3.5-turbo',
      }),
    ]);

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(4);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);
    const spanIds = calls.map((call) => call.properties.spanId);

    expect(messages).toEqual([
      'ai.completion.request',
      'ai.completion.request',
      'ai.completion.response',
      'ai.completion.response',
    ]);

    expect(traceIds[0]).not.toEqual(traceIds[1]);
    expect(spanIds[0]).not.toEqual(spanIds[1]);

    expect(traceIds.every(Boolean)).toBe(true);
    expect(spanIds.every(Boolean)).toBe(true);

    expect(new Set(traceIds).size).toEqual(2);
    expect(new Set(spanIds).size).toEqual(2);
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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);
    const properties = calls.map((call) => call.properties);
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

    const calls = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(calls.length).toEqual(2);

    const messages = calls.map((call) => call.message);
    const traceIds = calls.map((call) => call.traceId);
    const properties = calls.map((call) => call.properties);
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
