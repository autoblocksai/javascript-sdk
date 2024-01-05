import axios from 'axios';
import { AutoblocksTracer } from '../src/index';
import {
  AUTOBLOCKS_INGESTION_KEY,
  AUTOBLOCKS_TRACER_THROW_ON_ERROR,
} from '../src/util';

jest.mock('axios');

const axiosCreateMock = axios.create as jest.Mock;

describe('Autoblocks Tracer', () => {
  process.env.GITHUB_ACTIONS = '';

  describe('constructor', () => {
    it('accepts ingestion key as first arg (deprecated constructor)', () => {
      new AutoblocksTracer('mock-ingestion-key');

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-key',
        },
        timeout: 5000,
      });
    });

    it('accepts ingestion key in args', () => {
      new AutoblocksTracer({ ingestionKey: 'mock-ingestion-key' });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-key',
        },
        timeout: 5000,
      });
    });

    it('accepts ingestion key as environment variable', () => {
      process.env[AUTOBLOCKS_INGESTION_KEY] = 'mock-ingestion-key';

      new AutoblocksTracer();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-key',
        },
        timeout: 5000,
      });

      delete process.env[AUTOBLOCKS_INGESTION_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      (timeout, expected) => {
        new AutoblocksTracer('mock-ingestion-key', { timeout });

        expect(axios.create).toHaveBeenCalledWith({
          baseURL: 'https://ingest-event.autoblocks.ai',
          headers: {
            Authorization: 'Bearer mock-ingestion-key',
          },
          timeout: expected,
        });
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", (timeout, expected) => {
      new AutoblocksTracer({ ingestionKey: 'mock-ingestion-key', timeout });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-key',
        },
        timeout: expected,
      });
    });
  });

  describe('Sending Events', () => {
    let mockPost: jest.Mock;

    beforeEach(() => {
      mockPost = jest
        .fn()
        .mockResolvedValueOnce({ data: { traceId: 'mock-trace-id' } });
      axiosCreateMock.mockReturnValueOnce({ post: mockPost });
    });

    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2021, 0, 1, 1, 1, 1, 1));
    });

    const timestamp = '2021-01-01T01:01:01.001Z';

    afterAll(() => {
      jest.useRealTimers();
    });

    it('sends a message', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');
      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: {},
        },
        { headers: undefined },
      );
    });

    it('sends a message with properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      const { traceId } = await tracer.sendEvent('mock-message', {
        properties: { x: 1 },
      });

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 1 },
        },
        { headers: undefined },
      );
    });

    it('sends properties from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        properties: { x: 1 },
      });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 1 },
        },
        { headers: undefined },
      );
    });

    it('sends properties from setProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');
      tracer.setProperties({ x: 1 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 1 },
        },
        { headers: undefined },
      );
    });

    it('sends properties from updateProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');
      tracer.updateProperties({ x: 1 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 1 },
        },
        { headers: undefined },
      );
    });

    it('overrides properties in correct order', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });

      const { traceId } = await tracer.sendEvent('mock-message', {
        properties: { y: 20 },
      });

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 10, y: 20, z: 3 },
        },
        { headers: undefined },
      );
    });

    it('setProperties overrides all other properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });
      tracer.setProperties({ x: 100 });

      const { traceId } = await tracer.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: { x: 100 },
        },
        { headers: undefined },
      );
    });

    it('sends traceId from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        traceId: 'mock-trace-id',
      });

      await tracer.sendEvent('mock-message');

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'mock-trace-id',
          timestamp,
          properties: {},
        },
        { headers: undefined },
      );
    });

    it('sends traceId from setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');
      tracer.setTraceId('mock-trace-id');

      await tracer.sendEvent('mock-message');

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'mock-trace-id',
          timestamp,
          properties: {},
        },
        { headers: undefined },
      );
    });

    it('overrides traceId in constructor when calling setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        traceId: 'trace-id-in-constructor',
      });
      tracer.setTraceId('trace-id-in-set-trace-id');

      await tracer.sendEvent('mock-message');

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'trace-id-in-set-trace-id',
          timestamp,
          properties: {},
        },
        { headers: undefined },
      );
    });

    it('overrides traceId in constructor when calling traceId in sendEvent', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token', {
        traceId: 'trace-id-in-constructor',
      });

      await tracer.sendEvent('mock-message', {
        traceId: 'trace-id-in-send-event',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'trace-id-in-send-event',
          timestamp,
          properties: {},
        },
        { headers: undefined },
      );
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: { spanId: 'my-span-id' },
        },
        { headers: undefined },
      );
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: { spanId: 'my-span-id' },
        },
        { headers: undefined },
      );
    });

    it("doesn't unset spanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          spanId: 'my-span-id',
        },
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: { spanId: 'my-span-id' },
        },
        { headers: undefined },
      );
    });

    it('sends the parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        parentSpanId: 'my-parent-span-id',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: { parentSpanId: 'my-parent-span-id' },
        },
        { headers: undefined },
      );
    });

    it("doesn't unset parentSpanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          parentSpanId: 'my-parent-span-id',
        },
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: { parentSpanId: 'my-parent-span-id' },
        },
        { headers: undefined },
      );
    });

    it('sends the spanId and parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
        parentSpanId: 'my-parent-span-id',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: 'my-trace-id',
          timestamp,
          properties: {
            spanId: 'my-span-id',
            parentSpanId: 'my-parent-span-id',
          },
        },
        { headers: undefined },
      );
    });

    it('sends promptTracking as properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

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

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
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
        },
        { headers: undefined },
      );
    });

    it("doesn't unset promptTracking property if not provided in top-level field", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-token');

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

      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
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
        },
        { headers: undefined },
      );
    });
  });

  describe('Error Handling', () => {
    afterEach(() => {
      delete process.env[AUTOBLOCKS_TRACER_THROW_ON_ERROR];
    });

    it("doesn't throw if axios throws", async () => {
      axiosCreateMock.mockReturnValueOnce({
        post: jest.fn().mockRejectedValueOnce(new Error('mock-error')),
      });

      const tracer = new AutoblocksTracer('mock-ingestion-token');
      const { traceId } = await tracer.sendEvent('mock-message');
      expect(traceId).toBeUndefined();
    });

    it('throws if axios throws and AUTOBLOCKS_TRACER_THROW_ON_ERROR is set to 1', async () => {
      process.env[AUTOBLOCKS_TRACER_THROW_ON_ERROR] = '1';

      axiosCreateMock.mockReturnValueOnce({
        post: jest.fn().mockRejectedValueOnce(new Error('mock-error')),
      });

      const tracer = new AutoblocksTracer('mock-ingestion-token');

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

      const tracer = new AutoblocksTracer('mock-ingestion-token');

      await tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: something,
      });

      // No assertions necessary, this test is just checking that the types work
    });
  });
});
