import { AutoblocksTracer } from '../../src';
import {
  runTestSuite,
  BaseTestEvaluator,
  Evaluation,
  TracerEvent,
  BaseEvaluator,
} from '../../src/testing';
import * as testingUtilModule from '../../src/testing/util';
import crypto from 'crypto';

const MOCK_CLI_SERVER_ADDRESS = 'http://localhost:8000';

interface MyTestCase {
  x: number;
  y: number;
}

const md5 = (str: string) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

describe('Testing SDK', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue({ json: () => Promise.resolve() } as any);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decodeRequests = (): { path: string; body: any }[] => {
    return mockFetch.mock.calls.map((call) => ({
      path: call[0].replace(MOCK_CLI_SERVER_ADDRESS, ''),
      body: JSON.parse(call[1].body),
    }));
  };

  const expectNumPosts = (num: number) => {
    expect(mockFetch).toHaveBeenCalledTimes(num);
  };

  const expectPostRequest = (args: {
    path: string;
    body: unknown;
    abortSignal?: AbortSignal;
  }) => {
    expect(mockFetch).toHaveBeenCalledWith(
      `${MOCK_CLI_SERVER_ADDRESS}${args.path}`,
      {
        method: 'POST',
        body: JSON.stringify(args.body),
        headers: {
          'Content-Type': 'application/json',
        },
        signal: args.abortSignal,
      },
    );
  };

  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = MOCK_CLI_SERVER_ADDRESS;
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
  });

  it('sends an error if there are no test cases', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [],
      testCaseHash: ['x'],
      evaluators: [],
      fn: () => 'hello',
    });

    expectNumPosts(1);
    const req = decodeRequests()[0];
    expect(req.path).toEqual('/errors');
    expect(req.body.testExternalId).toEqual('my-test-id');
    expect(req.body.testCaseHash).toBeNull();
    expect(req.body.evaluatorExternalId).toBeNull();
    expect(req.body.error.name).toEqual('Error');
    expect(req.body.error.message).toEqual(
      '[my-test-id] No test cases provided.',
    );
    expect(req.body.error.stacktrace).toContain(
      'Error: [my-test-id] No test cases provided.',
    );
  });

  it('sends an error if the evaluators are not instances of BaseTestEvaluator or BaseEvaluator', async () => {
    // Looks like an evaluator but doesn't extend BaseTestEvaluator
    class MyEvaluator {
      evaluateTestCase() {
        return { score: 1 };
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evaluators: [new MyEvaluator() as any],
      fn: () => 'hello',
    });

    expectNumPosts(1);
    const req = decodeRequests()[0];
    expect(req.path).toEqual('/errors');
    expect(req.body.testExternalId).toEqual('my-test-id');
    expect(req.body.testCaseHash).toBeNull();
    expect(req.body.evaluatorExternalId).toBeNull();
    expect(req.body.error.name).toEqual('Error');
    expect(req.body.error.message).toEqual(
      '[my-test-id] Evaluators must be instances of BaseTestEvaluator or BaseEvaluator.',
    );
    expect(req.body.error.stacktrace).toContain(
      'Error: [my-test-id] Evaluators must be instances of BaseTestEvaluator or BaseEvaluator.',
    );
  });

  it('handles errors in the function being tested', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) => {
        if (testCase.x === 1) {
          throw new Error('Something went wrong');
        }

        return `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
      },
    });

    expectNumPosts(4);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });

    const errorRequest = decodeRequests().find((req) => req.path === '/errors');

    expect(errorRequest?.body.testExternalId).toEqual('my-test-id');
    expect(errorRequest?.body.testCaseHash).toEqual(md5(`12`));
    expect(errorRequest?.body.evaluatorExternalId).toBeNull();
    expect(errorRequest?.body.error.name).toEqual('Error');
    expect(errorRequest?.body.error.message).toEqual('Something went wrong');
    expect(errorRequest?.body.error.stacktrace).toContain(
      'Error: Something went wrong',
    );
  });

  it('handles errors in an evaluator', async () => {
    class MyEvaluator extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator';

      evaluateTestCase({ testCase }: { testCase: MyTestCase }): Evaluation {
        if (testCase.x === 1) {
          throw new Error('Something went wrong');
        }
        return { score: 0.5 };
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator()],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(6);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });

    const errorRequest = decodeRequests().find((req) => req.path === '/errors');

    expect(errorRequest?.body.testExternalId).toEqual('my-test-id');
    expect(errorRequest?.body.testCaseHash).toEqual(md5(`12`));
    expect(errorRequest?.body.evaluatorExternalId).toEqual('my-evaluator');
    expect(errorRequest?.body.error.name).toEqual('Error');
    expect(errorRequest?.body.error.message).toEqual('Something went wrong');
    expect(errorRequest?.body.error.stacktrace).toContain(
      'Error: Something went wrong',
    );
  });

  it('handles no evaluators', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(4);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('handles two evaluators', async () => {
    class MyEvaluator1 extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator-1';

      evaluateTestCase(): Evaluation {
        return { score: 0.5 };
      }
    }

    class MyEvaluator2 extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator-2';

      evaluateTestCase(): Evaluation {
        return { score: 0.7, threshold: { gte: 0.5 } };
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator1(), new MyEvaluator2()],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(8);

    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator-2',
        score: 0.7,
        threshold: { gte: 0.5 },
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator-2',
        score: 0.7,
        threshold: { gte: 0.5 },
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  /**
   * If we set max concurrency to 1 for both test cases and
   * evaluators, the order is deterministic.
   */
  it('respects concurrency controls', async () => {
    class MyEvaluator1 extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator-1';
      maxConcurrency = 1;

      evaluateTestCase(): Evaluation {
        return { score: 0.5 };
      }
    }

    class MyEvaluator2 extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator-2';
      maxConcurrency = 1;

      evaluateTestCase(): Evaluation {
        return { score: 0.7, threshold: { gte: 0.5 } };
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator1(), new MyEvaluator2()],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      maxTestCaseConcurrency: 1,
    });

    expectNumPosts(8);

    const requests = decodeRequests();

    expect(requests).toEqual([
      {
        path: '/start',
        body: {
          testExternalId: 'my-test-id',
        },
      },
      {
        path: '/results',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
        },
      },
      {
        path: '/results',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`34`),
          testCaseBody: { x: 3, y: 4 },
          testCaseOutput: '3 + 4 = 7',
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`12`),
          evaluatorExternalId: 'my-evaluator-1',
          score: 0.5,
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`12`),
          evaluatorExternalId: 'my-evaluator-2',
          score: 0.7,
          threshold: { gte: 0.5 },
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`34`),
          evaluatorExternalId: 'my-evaluator-1',
          score: 0.5,
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          testCaseHash: md5(`34`),
          evaluatorExternalId: 'my-evaluator-2',
          score: 0.7,
          threshold: { gte: 0.5 },
        },
      },
      {
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
        },
      },
    ]);
  });

  it('works with an async test function', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: async ({ testCase }: { testCase: MyTestCase }) => {
        return new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve(
              `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
            );
          }, 100);
        });
      },
    });

    expectNumPosts(4);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('handles async evaluators', async () => {
    class MyEvaluator extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator';

      async evaluateTestCase(): Promise<Evaluation> {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ score: 0.5 });
          }, 100);
        });
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator()],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(6);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('allows specifying a custom hash function', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: (testCase: MyTestCase) => `${testCase.x}-${testCase.y}`,
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(4);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: '1-2',
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: '3-4',
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('serializes non-primitive test case outputs', async () => {
    await runTestSuite<MyTestCase, { result: string }>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) => ({
        result: `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      }),
    });

    expectNumPosts(3);
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '{"result":"1 + 2 = 3"}',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('collects test events', async () => {
    const timestamp = new Date().toISOString();

    class MyEvaluator1 extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator-1';

      evaluateTestCase(): Evaluation {
        return { score: 0.5 };
      }
    }

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator1()],
      fn: async ({ testCase }: { testCase: MyTestCase }) => {
        const tracer = new AutoblocksTracer({
          ingestionKey: 'test',
          timeout: {
            milliseconds: 1000,
          },
        });
        // Simulate one doing more work than the other to make sure concurrency is handled correctly
        if (testCase.x === 1) {
          await sleep(500);
        }
        const message = `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
        tracer.sendEvent(message, {
          timestamp,
          traceId: 'test-trace-id',
          properties: {},
        });
        return message;
      },
      // This should be equal to or greater than the number of test cases
      // to correctly test concurrency when sending test events
      maxTestCaseConcurrency: 2,
    });

    expectNumPosts(8);

    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/events',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        event: {
          message: '1 + 2 = 3',
          traceId: 'test-trace-id',
          timestamp,
          properties: {},
        },
      },
      abortSignal: AbortSignal.timeout(1000),
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/events',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        event: {
          message: '3 + 4 = 7',
          traceId: 'test-trace-id',
          timestamp,
          properties: {},
        },
      },
      abortSignal: AbortSignal.timeout(1000),
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('handles evaluators that implement BaseEvaluator', async () => {
    type T = { x: number };
    type O = string;

    class MyEvaluator extends BaseEvaluator<T, O> {
      id = 'my-evaluator';

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

    const timestamp = new Date().toISOString();

    await runTestSuite<T, O>({
      id: 'my-test-id',
      testCaseHash: ['x'],
      testCases: [{ x: 0.5 }],
      evaluators: [new MyEvaluator()],
      fn: async ({ testCase }) => {
        const tracer = new AutoblocksTracer('mock-ingestion-key');

        tracer.sendEvent('this is a test', {
          timestamp,
          traceId: 'test-trace-id',
          properties: {
            x: testCase.x,
          },
          evaluators: [new MyEvaluator()],
        });

        return 'whatever';
      },
    });

    expectNumPosts(5);

    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
      },
    });
    expectPostRequest({
      path: '/events',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`0.5`),
        event: {
          message: 'this is a test',
          traceId: 'test-trace-id',
          timestamp,
          properties: {
            x: 0.5,
            // Note: event evaluators are not run within test suites
          },
        },
      },
      abortSignal: AbortSignal.timeout(5_000),
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`0.5`),
        testCaseBody: { x: 0.5 },
        testCaseOutput: 'whatever',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(`0.5`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  /**
   * This is in its own describe() so that we can properly setup and teardown the spy.
   */
  describe('logs errors raised from our code when making payload for /results', () => {
    let isPrimitiveSpy: jest.SpyInstance;

    beforeEach(() => {
      isPrimitiveSpy = jest
        .spyOn(testingUtilModule, 'isPrimitive')
        .mockImplementation(() => {
          throw new Error('an error in isPrimitive');
        });
    });

    afterEach(() => {
      isPrimitiveSpy.mockRestore();
    });

    /**
     * Test that it logs errors thrown from our own code,
     * as opposed to errors thrown in `fn` or in `evaluateTestCase`.
     *
     * In this case we are testing that we are logging errors thrown
     * when building the JSON payload for the /results request.
     */
    it('logs errors', async () => {
      await runTestSuite<MyTestCase, { result: string }>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        evaluators: [],
        fn: ({ testCase }: { testCase: MyTestCase }) => ({
          result: `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
        }),
      });

      expect(isPrimitiveSpy).toHaveBeenCalled();

      expectNumPosts(3);
      expectPostRequest({
        path: '/start',
        body: {
          testExternalId: 'my-test-id',
        },
      });
      expectPostRequest({
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
        },
      });

      const errorReq = decodeRequests()[1];
      expect(errorReq.path).toEqual('/errors');
      expect(errorReq.body.testExternalId).toEqual('my-test-id');
      expect(errorReq.body.testCaseHash).toEqual(md5('12'));
      expect(errorReq.body.evaluatorExternalId).toBeNull();
      expect(errorReq.body.error.name).toEqual('Error');
      expect(errorReq.body.error.message).toEqual('an error in isPrimitive');
      expect(errorReq.body.error.stacktrace).toContain(
        'Error: an error in isPrimitive',
      );
    });
  });
});
