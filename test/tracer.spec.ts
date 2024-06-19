import { AutoblocksTracer, flush } from '../src/index';
import * as tracerModule from '../src/tracer/tracer';
import {
  BaseEvaluator,
  BaseEventEvaluator,
  Evaluation,
  TracerEvent,
} from '../src/testing';
import { AutoblocksEnvVar, INGESTION_ENDPOINT } from '../src/util';
import crypto from 'crypto';

jest.setTimeout(10_000);

describe('Autoblocks Tracer', () => {
  let mockFetch: jest.SpyInstance;

  const timestamp = '2021-01-01T01:01:01.001Z';

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - TS wants me to fully mock a fetch response, but we only
      // need the json() method
      .mockResolvedValue({
        json: () => Promise.resolve({ traceId: 'mock-trace-id' }),
      });

    jest.spyOn(tracerModule, 'makeISOTimestamp').mockReturnValue(timestamp);
  });

  const expectPostRequest = (body: unknown, timeoutMs?: number) => {
    expect(mockFetch).toHaveBeenCalledWith(INGESTION_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-ingestion-key',
        'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
      },
      signal: AbortSignal.timeout(timeoutMs || 5_000),
    });
  };

  describe('constructor', () => {
    it('accepts ingestion key as first arg (deprecated constructor)', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('my-event');
      await flush();

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('accepts ingestion key in args', async () => {
      const tracer = new AutoblocksTracer({
        ingestionKey: 'mock-ingestion-key',
      });
      tracer.sendEvent('my-event');
      await flush();

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('accepts ingestion key as environment variable', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY] =
        'mock-ingestion-key';

      const tracer = new AutoblocksTracer();
      tracer.sendEvent('my-event');
      await flush();

      expectPostRequest({
        message: 'my-event',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });

      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      // TODO figure out why { milliseconds: 1 }, which is less than
      // the duration we sleep for in the flush() loop, makes this fail.
      // When the HTTP timeout is less than the amount of time we wait
      // for in the flush loop, the AbortSignal will already be in an
      // aborted state when we call fetch.
      [{ milliseconds: 200 }, 200],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      async (timeout, expected) => {
        const tracer = new AutoblocksTracer('mock-ingestion-key', { timeout });
        tracer.sendEvent('my-event');
        await flush();

        expectPostRequest(
          {
            message: 'my-event',
            traceId: undefined,
            timestamp,
            properties: {},
            systemProperties: {},
          },
          expected,
        );
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 200 }, 200],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", async (timeout, expected) => {
      const tracer = new AutoblocksTracer({
        ingestionKey: 'mock-ingestion-key',
        timeout,
      });
      tracer.sendEvent('my-event');
      await flush();

      expectPostRequest(
        {
          message: 'my-event',
          traceId: undefined,
          timestamp,
          properties: {},
          systemProperties: {},
        },
        expected,
      );
    });
  });

  describe('Sending Events', () => {
    it('sends a message', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('sends multiple messages', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message-1');
      tracer.sendEvent('mock-message-2');
      tracer.sendEvent('mock-message-3');
      await flush();

      expectPostRequest({
        message: 'mock-message-1',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });

      expectPostRequest({
        message: 'mock-message-2',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });

      expectPostRequest({
        message: 'mock-message-2',
        traceId: undefined,
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('sends a message with properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        properties: { x: 1 },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
        systemProperties: {},
      });
    });

    it('sends a message with human review fields', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        properties: { x: 1 },
        humanReviewFields: [
          {
            name: 'my-field',
            value: 'my-value',
          },
        ],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
        systemProperties: {
          humanReviewFields: [
            {
              name: 'my-field',
              value: 'my-value',
            },
          ],
        },
      });
    });

    it('uses the timestamp given', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      const myTimestamp = '2024-03-27T15:04:57.179Z';

      tracer.sendEvent('mock-message', {
        timestamp: myTimestamp,
        properties: { x: 1 },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp: myTimestamp,
        properties: { x: 1 },
        systemProperties: {},
      });
    });

    it('sends properties from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1 },
      });

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
        systemProperties: {},
      });
    });

    it('sends properties from setProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.setProperties({ x: 1 });

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
        systemProperties: {},
      });
    });

    it('sends properties from updateProperties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.updateProperties({ x: 1 });

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 1 },
        systemProperties: {},
      });
    });

    it('overrides properties in correct order', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });

      tracer.sendEvent('mock-message', {
        properties: { y: 20 },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 10, y: 20, z: 3 },
        systemProperties: {},
      });
    });

    it('setProperties overrides all other properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        properties: { x: 1, y: 2, z: 3 },
      });
      tracer.updateProperties({ x: 10 });
      tracer.setProperties({ x: 100 });

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: { x: 100 },
        systemProperties: {},
      });
    });

    it('sends traceId from constructor', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'mock-trace-id',
      });

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'mock-trace-id',
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('sends traceId from setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.setTraceId('mock-trace-id');

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'mock-trace-id',
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('overrides traceId in constructor when calling setTraceId', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'trace-id-in-constructor',
      });
      tracer.setTraceId('trace-id-in-set-trace-id');

      tracer.sendEvent('mock-message');
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'trace-id-in-set-trace-id',
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('overrides traceId in constructor when calling traceId in sendEvent', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key', {
        traceId: 'trace-id-in-constructor',
      });

      tracer.sendEvent('mock-message', {
        traceId: 'trace-id-in-send-event',
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'trace-id-in-send-event',
        timestamp,
        properties: {},
        systemProperties: {},
      });
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
        systemProperties: {},
      });
    });

    it('sends the spanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
        systemProperties: {},
      });
    });

    it("doesn't unset spanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          spanId: 'my-span-id',
        },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { spanId: 'my-span-id' },
        systemProperties: {},
      });
    });

    it('sends the parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        parentSpanId: 'my-parent-span-id',
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { parentSpanId: 'my-parent-span-id' },
        systemProperties: {},
      });
    });

    it("doesn't unset parentSpanId sent from properties", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          parentSpanId: 'my-parent-span-id',
        },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: { parentSpanId: 'my-parent-span-id' },
        systemProperties: {},
      });
    });

    it('sends the spanId and parentSpanId as a property', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        spanId: 'my-span-id',
        parentSpanId: 'my-parent-span-id',
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          spanId: 'my-span-id',
          parentSpanId: 'my-parent-span-id',
        },
        systemProperties: {},
      });
    });

    it('sends promptTracking as properties', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          hello: 'world',
          promptTracking: 'i will be overwritten',
        },
        promptTracking: {
          id: 'my-prompt-tracking-id',
          version: '1.1',
          templates: [
            {
              id: 'my-prompt-template-id',
              template: 'my-prompt-template',
            },
          ],
          params: {
            params: {
              x: 1,
            },
          },
        },
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          hello: 'world',
          promptTracking: {
            id: 'my-prompt-tracking-id',
            version: '1.1',
            templates: [
              {
                id: 'my-prompt-template-id',
                template: 'my-prompt-template',
              },
            ],
            params: {
              params: {
                x: 1,
              },
            },
          },
        },
        systemProperties: {},
      });
    });

    it("doesn't unset promptTracking property if not provided in top-level field", async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: {
          hello: 'world',
          promptTracking: {
            id: 'i will NOT be overwritten',
            templates: [],
          },
        },
      });
      await flush();

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
        systemProperties: {},
      });
    });
  });

  describe('Evaluators', () => {
    class MyEvaluator extends BaseEventEvaluator {
      id = 'my-evaluator';

      evaluateEvent(): Evaluation {
        return {
          score: 0.9,
        };
      }
    }

    class MyFullInfoEvaluator extends BaseEventEvaluator {
      id = 'my-full-info-evaluator';

      evaluateEvent(): Evaluation {
        return {
          score: 0.9,
          threshold: { gt: 0, lte: 1 },
          metadata: {
            'some-metadata-key': 'some-metadata-value',
          },
        };
      }
    }

    class MyAsyncEvaluator extends BaseEventEvaluator {
      id = 'my-async-evaluator';

      async evaluateEvent(): Promise<Evaluation> {
        return Promise.resolve({ score: 0.9 });
      }
    }

    class MyAsyncFullInfoEvaluator extends BaseEventEvaluator {
      id = 'my-async-full-info-evaluator';

      async evaluateEvent(): Promise<Evaluation> {
        return Promise.resolve({
          score: 0.9,
          threshold: { gt: 0, lte: 1 },
          metadata: {
            'some-metadata-key': 'some-metadata-value',
          },
        });
      }
    }

    const mockUUIDs = Array.from({ length: 10 }, () => crypto.randomUUID());

    let cryptoMock: jest.SpyInstance | undefined;

    beforeEach(() => {
      cryptoMock = jest.spyOn(crypto, 'randomUUID');
      mockUUIDs.forEach((uuid) => {
        cryptoMock?.mockReturnValueOnce(uuid);
      });
    });

    afterEach(() => {
      cryptoMock?.mockRestore();
    });

    it('sends a message with minimal info', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message', {
        evaluators: [new MyEvaluator()],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {
          evaluations: [
            {
              id: mockUUIDs[0],
              score: 0.9,
              threshold: undefined,
              metadata: undefined,
              evaluatorExternalId: 'my-evaluator',
            },
          ],
        },
        systemProperties: {},
      });
    });

    it('sends a message with all info', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message', {
        properties: {
          'my-prop-key': 'my-prop-value',
        },
        traceId: 'my-trace-id',
        evaluators: [new MyFullInfoEvaluator()],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: 'my-trace-id',
        timestamp,
        properties: {
          'my-prop-key': 'my-prop-value',
          evaluations: [
            {
              id: mockUUIDs[0],
              score: 0.9,
              threshold: {
                gt: 0,
                lte: 1,
              },
              metadata: {
                'some-metadata-key': 'some-metadata-value',
              },
              evaluatorExternalId: 'my-full-info-evaluator',
            },
          ],
        },
        systemProperties: {},
      });
    });

    it('handles async evaluators', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message', {
        evaluators: [new MyAsyncEvaluator()],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {
          evaluations: [
            {
              id: mockUUIDs[0],
              score: 0.9,
              threshold: undefined,
              metadata: undefined,
              evaluatorExternalId: 'my-async-evaluator',
            },
          ],
        },
        systemProperties: {},
      });
    });

    it('handles multiple evaluators', async () => {
      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message', {
        evaluators: [
          new MyEvaluator(),
          new MyAsyncEvaluator(),
          new MyFullInfoEvaluator(),
          new MyAsyncFullInfoEvaluator(),
        ],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {
          evaluations: [
            {
              id: mockUUIDs[0],
              score: 0.9,
              threshold: undefined,
              metadata: undefined,
              evaluatorExternalId: 'my-evaluator',
            },
            {
              id: mockUUIDs[1],
              score: 0.9,
              threshold: undefined,
              metadata: undefined,
              evaluatorExternalId: 'my-async-evaluator',
            },
            {
              id: mockUUIDs[2],
              score: 0.9,
              threshold: {
                gt: 0,
                lte: 1,
              },
              metadata: {
                'some-metadata-key': 'some-metadata-value',
              },
              evaluatorExternalId: 'my-full-info-evaluator',
            },
            {
              id: mockUUIDs[3],
              score: 0.9,
              threshold: {
                gt: 0,
                lte: 1,
              },
              metadata: {
                'some-metadata-key': 'some-metadata-value',
              },
              evaluatorExternalId: 'my-async-full-info-evaluator',
            },
          ],
        },
        systemProperties: {},
      });
    });

    it('handles evaluators that implement BaseEvaluator', async () => {
      type T = { x: number };
      type O = string;

      class MyCombinedEvaluator extends BaseEvaluator<T, O> {
        id = 'my-combined-evaluator';

        private someSharedImplementation(x: number) {
          return x;
        }

        evaluateTestCase(args: { testCase: T; output: O }): Evaluation {
          return {
            score: this.someSharedImplementation(args.testCase.x),
          };
        }

        evaluateEvent(args: { event: TracerEvent }): Evaluation {
          return {
            score: this.someSharedImplementation(args.event.properties['x']),
          };
        }
      }

      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message', {
        properties: {
          x: 0.5,
        },
        evaluators: [new MyCombinedEvaluator()],
      });
      await flush();

      expectPostRequest({
        message: 'mock-message',
        traceId: undefined,
        timestamp,
        properties: {
          x: 0.5,
          evaluations: [
            {
              id: mockUUIDs[0],
              score: 0.5,
              threshold: undefined,
              metadata: undefined,
              evaluatorExternalId: 'my-combined-evaluator',
            },
          ],
        },
        systemProperties: {},
      });
    });

    describe('errors', () => {
      it('does not block if there is an evaluator error', async () => {
        class ErrorEvaluator extends BaseEventEvaluator {
          id = 'error-evaluator';

          evaluateEvent(): Evaluation {
            throw new Error('Something unexpected happened');
            return {
              score: 0.9,
            };
          }
        }
        const tracer = new AutoblocksTracer('mock-ingestion-key');
        tracer.sendEvent('mock-message', {
          evaluators: [new ErrorEvaluator()],
        });
        await flush();

        expectPostRequest({
          message: 'mock-message',
          traceId: undefined,
          timestamp,
          properties: {},
          systemProperties: {},
        });
      });

      describe('Autoblocks code error', () => {
        let runEvaluatorUnsafeSpy: jest.SpyInstance;

        beforeEach(() => {
          runEvaluatorUnsafeSpy = jest
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .spyOn(AutoblocksTracer.prototype as any, 'runEvaluatorUnsafe');
        });

        afterEach(() => {
          runEvaluatorUnsafeSpy.mockRestore();
        });

        it('does not block if there is an error in our code running the evaluation', async () => {
          class ErrorEvaluator extends BaseEventEvaluator {
            id = 'error-evaluator';

            evaluateEvent(): Evaluation {
              throw new Error('Something unexpected happened');
            }
          }
          const tracer = new AutoblocksTracer('mock-ingestion-key');
          runEvaluatorUnsafeSpy.mockImplementationOnce(() => {
            throw Error('Brutal!');
          });
          tracer.sendEvent('mock-message', {
            evaluators: [new ErrorEvaluator()],
          });
          await flush();

          expectPostRequest({
            message: 'mock-message',
            traceId: undefined,
            timestamp,
            properties: {},
            systemProperties: {},
          });
        });
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
      tracer.sendEvent('mock-message');
      await flush();
    });

    // TODO figure out how to test unhandled rejections
    it.skip('throws if fetch throws and AUTOBLOCKS_TRACER_THROW_ON_ERROR is set to 1', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR] = '1';

      mockFetch.mockRejectedValueOnce('mock-error');

      const tracer = new AutoblocksTracer('mock-ingestion-key');
      tracer.sendEvent('mock-message');
      await flush();
    });
  });

  describe('Types', () => {
    it('allows sending an interface as properties', async () => {
      interface Something {
        x: string;
      }

      const something: Something = { x: 'hello' };

      const tracer = new AutoblocksTracer('mock-ingestion-key');

      tracer.sendEvent('mock-message', {
        traceId: 'my-trace-id',
        properties: something,
      });

      // No assertions necessary, this test is just checking that the types work
    });
  });
});
