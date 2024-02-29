import { runTestSuite, BaseTestEvaluator, Evaluation } from '../../src/testing';
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

  const expectPostRequest = (args: { path: string; body: unknown }) => {
    expect(mockFetch).toHaveBeenCalledWith(
      `${MOCK_CLI_SERVER_ADDRESS}${args.path}`,
      {
        method: 'POST',
        body: JSON.stringify(args.body),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };

  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = 'http://localhost:8000';
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

  it('sends an error if the evaluators are not instances of BaseTestEvaluator', async () => {
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
      '[my-test-id] Evaluators must be instances of BaseTestEvaluator.',
    );
    expect(req.body.error.stacktrace).toContain(
      'Error: [my-test-id] Evaluators must be instances of BaseTestEvaluator.',
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
      fn: (testCase: MyTestCase) => {
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
      fn: (testCase: MyTestCase) =>
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
      fn: (testCase: MyTestCase) =>
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
      fn: (testCase: MyTestCase) =>
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

  it('respects concurrency controls', async () => {
    // If we set max concurrency to 1 for both test cases and
    // evaluators, the order is deterministic.
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
      fn: (testCase: MyTestCase) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      maxTestCaseConcurrency: 1,
      maxEvaluatorConcurrency: 1,
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
      fn: async (testCase: MyTestCase) => {
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
      fn: (testCase: MyTestCase) =>
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
      fn: (testCase: MyTestCase) =>
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
      fn: (testCase: MyTestCase) => ({
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
});
