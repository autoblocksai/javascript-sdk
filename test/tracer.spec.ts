import axios from 'axios';
import { AutoblocksTracer } from '../src/index';

jest.mock('axios');

const axiosCreateMock = axios.create as jest.Mock;

describe('Autoblocks Tracer', () => {
  process.env.GITHUB_ACTIONS = '';

  describe('constructor', () => {
    it('creates a client with the correct parameters', () => {
      new AutoblocksTracer('mock-ingestion-token');

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-token',
        },
        timeout: undefined,
      });
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", (timeout, expected) => {
      new AutoblocksTracer('mock-ingestion-token', { timeout });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://ingest-event.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-ingestion-token',
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
  });

  describe('Error Handling', () => {
    it("doesn't throw if axios throws", async () => {
      axiosCreateMock.mockReturnValueOnce({
        post: jest.fn().mockRejectedValueOnce(new Error('mock-error')),
      });

      const tracer = new AutoblocksTracer('mock-ingestion-token');
      const { traceId } = await tracer.sendEvent('mock-message');
      expect(traceId).toBeUndefined();
    });
  });
});
