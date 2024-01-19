import { AutoblocksTracer } from '../src/index';
import { AutoblocksEnvVar } from '../src/util';

describe('Autoblocks Tracer', () => {
  let mockFetch: jest.SpyInstance;

  process.env.GITHUB_ACTIONS = '';

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2021, 0, 1, 1, 1, 1, 1));
  });

  const timestamp = '2021-01-01T01:01:01.001Z';

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - TS wants me to fully mock a fetch response, but we only
      // need the json() method
      .mockResolvedValue({
        json: () => Promise.resolve({ traceId: 'mock-trace-id' }),
      });
  });

  const expectPostRequest = (body: unknown, timeoutMs?: number) => {
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ingest-event.autoblocks.ai',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-ingestion-key',
        },
        signal: AbortSignal.timeout(timeoutMs || 5_000),
      },
    );
  };

  describe('constructor', () => {
    it('accepts ingestion key as first arg (deprecated constructor)', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      await tracer.sendEvent('my-event');

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
      });
    });

    it('accepts ingestion key in args', async () => {
      const tracer = new AutoblocksTracer({
        ingestionKey: 'mock-ingestion-key',
      });
      await tracer.sendEvent('my-event');

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
      });
    });

    it('accepts ingestion key as environment variable', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY] =
        'mock-ingestion-key';

      const tracer = new AutoblocksTracer();
      await tracer.sendEvent('my-event');

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
      });

      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      async (timeout, expected) => {
        const tracer = new AutoblocksTracer('mock-ingestion-key', { timeout });
        await tracer.sendEvent('my-event');

        expectPostRequest(
          {
            message: 'my-event',
            traceId: undefined,
            timestamp,
            properties: {},
          },
          expected,
        );
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", async (timeout, expected) => {
      const tracer = new AutoblocksTracer({
        ingestionKey: 'mock-ingestion-key',
        timeout,
      });
      await tracer.sendEvent('my-event');

      expectPostRequest(
        {
          message: 'my-event',
          traceId: undefined,
          timestamp,
          properties: {},
        },
        expected,
      );
    });
  });

  describe('Sending Events', () => {
    it('sends a message', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {},
      });
    });

    it('sends a message with properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      const { traceId } = await tracer.sendEvent('mock-message', {
        properties: { x: 1 },
      });

      expect(traceId).toEqual('mock-trace-id');
      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
      });
    });

    it('sends properties from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1 },
      });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
      });
    });

    it('sends properties from setProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.setProperties({ x: 1 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
      });
    });

    it('sends properties from updateProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.updateProperties({ x: 1 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
      });
    });

    it('overrides properties in correct order', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });

      const { traceId } = await tracer.sendEvent('mock-message', {
        properties: { y: 20 },
      });

      expect(traceId).toEqual('mock-trace-id');
      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 10, y: 20, z: 3 },
      });
    });

    it('setProperties overrides all other properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });
      tracer.setProperties({ x: 100 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 100 },
      });
    });

    it('sends traceId from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'mock-trace-id',
      });

      await tracer.sendEvent('mock-message');

      expectPostRequest({
        message: 'mock-message',
        traceId: 'mock-trace-id',
        timestamp,
        properties: {},
      });
    });

    it('sends traceId from setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.setTraceId('mock-trace-id');

      await tracer.sendEvent('mock-message');

      expectPostRequest({
        message: 'mock-message',
        traceId: 'mock-trace-id',
        timestamp,
        properties: {},
      });
    });

    it('overrides traceId in constructor when calling setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'trace-id-in-constructor',
      });
      tracer.setTraceId('trace-id-in-set-trace-id');

      await tracer.sendEvent('mock-message');

      expectPostRequest({
        message: 'mock-message',
        traceId: 'trace-id-in-set-trace-id',
        timestamp,
        properties: {},
      });
    });

    it('overrides traceId in constructor when calling traceId in sendEvent', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'trace-id-in-constructor',
      });

      await tracer.sendEvent('mock-message', {
        traceId: 'trace-id-in-send-event',
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'trace-id-in-send-event',
        timestamp,
        properties: {},
      });
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
      });
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
      });
    });

    it("doesn't unset spanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          spanId: 'my-span-id',
        },
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
      });
    });

    it('sends the parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        parentSpanId: 'my-parent-span-id',
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { parentSpanId: 'my-parent-span-id' },
      });
    });

    it("doesn't unset parentSpanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          parentSpanId: 'my-parent-span-id',
        },
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { parentSpanId: 'my-parent-span-id' },
      });
    });

    it('sends the spanId and parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
        parentSpanId: 'my-parent-span-id',
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          spanId: 'my-span-id',
          parentSpanId: 'my-parent-span-id',
        },
      });
    });

    it('sends promptTracking as properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          hello: 'world',
          promptTracking: 'i will be overwritten',
        },
        promptTracking: {
          id: 'my-prompt-tracking-id',
          templates: [
            {
              id: 'my-prompt-template-id',
              template: 'my-prompt-template',
              properties: {
                name: 'my-prompt-name',
              },
            },
          ],
        },
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          hello: 'world',
          promptTracking: {
            id: 'my-prompt-tracking-id',
            templates: [
              {
                id: 'my-prompt-template-id',
                template: 'my-prompt-template',
                properties: {
                  name: 'my-prompt-name',
                },
              },
            ],
          },
        },
      });
    });

    it("doesn't unset promptTracking property if not provided in top-level field", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          hello: 'world',
          promptTracking: {
            id: 'i will NOT be overwritten',
            templates: [],
          },
        },
      });

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          hello: 'world',
          promptTracking: {
            id: 'i will NOT be overwritten',
            templates: [],
          },
        },
      });
    });
  });

  describe('Error Handling', () => {
    afterEach(() => {
      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR];
    });

    it("doesn't throw if fetch throws", async () => {
      mockFetch.mockRejectedValueOnce('mock-error');

      const tracer = new AutoblocksTracer('mock-ingestion-key');
      const { traceId } = await tracer.sendEvent('mock-message');
      expect(traceId).toBeUndefined();
    });

    it('throws if fetch throws and AUTOBLOCKS_TRACER_THROW_ON_ERROR is set to 1', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR] = '1';

      mockFetch.mockRejectedValueOnce('mock-error');

      const tracer = new AutoblocksTracer('mock-ingestion-key');

      try {
        await tracer.sendEvent('mock-message');
        fail('Expected sendEvent to throw');
      } catch {
        // Expected
      }
    });
  });

  describe('Types', () => {
    it('allows sending an interface as properties', async () => {
      interface Something {
        x: string;
      }

      const something: Something = { x: 'hello' };

      const tracer = new AutoblocksTracer('mock-ingestion-key');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: something,
      });

      // No assertions necessary, this test is just checking that the types work
    });
  });
});
