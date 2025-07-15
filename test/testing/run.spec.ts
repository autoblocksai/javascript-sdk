import { AutoblocksTracer } from '../../src';
import {
  runTestSuite,
  BaseTestEvaluator,
  Evaluation,
  TracerEvent,
  BaseEvaluator,
  gridSearchAsyncLocalStorage,
  HumanReviewFieldContentType,
} from '../../src/testing';
import * as testingUtilModule from '../../src/testing/util';
import crypto from 'crypto';
import { isMatch, omit } from 'lodash';
import { API_ENDPOINT, AutoblocksEnvVar } from '../../src/util';
import { AutoblocksPromptManager } from '../../src/prompts';
const MOCK_CLI_SERVER_ADDRESS = 'http://localhost:8000';

interface MyTestCase {
  x: number;
  y: number;
}

const md5 = (str: string) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

const mockAPIKey = 'mock-api-key';

describe('Testing SDK', () => {
  let mockFetch: jest.SpyInstance;
  const mockRunId = 'mock-run-id';
  const mockTestCaseResultId = 'mock-test-case-result-id';

  const mockPrompt = {
    id: 'my-prompt-id',
    revisionId: 'my-revision-id',
    version: '1.0',
    templates: [
      {
        id: 'my-template-id',
        template: 'Hello, {{ name }}!',
      },
    ],
  };

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      const response = {
        json: () => {
          if (url.toString().endsWith('/start')) {
            return Promise.resolve({ id: mockRunId });
          }
          if (url.toString().endsWith('/results')) {
            return Promise.resolve({ id: mockTestCaseResultId });
          }
          if (url.toString().includes('prompts')) {
            return Promise.resolve(mockPrompt);
          }
          return Promise.resolve({});
        },
        ok: true,
      } as Response;
      return Promise.resolve(response);
    });
    // Make CI and local consistent
    process.env['CI'] = 'true';
    process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = mockAPIKey;
    process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
      MOCK_CLI_SERVER_ADDRESS;
  });

  afterEach(() => {
    if (mockFetch) {
      mockFetch.mockRestore();
    }
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_TEST_RUN_MESSAGE];
    delete process.env['CI'];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY];
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
    body: Record<string, unknown>;
  }) => {
    for (const call of mockFetch.mock.calls) {
      const [callUrl, callArgs] = call;
      if (callUrl === `${MOCK_CLI_SERVER_ADDRESS}${args.path}`) {
        expect(callArgs.method).toEqual('POST');
        expect(callArgs.headers).toEqual({
          'Content-Type': 'application/json',
        });
        const parsedBody = JSON.parse(callArgs.body);
        if (isMatch(parsedBody, args.body)) {
          return;
        }
      }
    }

    // If we reach here, we didn't find the expected request
    throw new Error(`Expected request not found: ${JSON.stringify(args)}`);
  };

  const expectPublicAPIPostRequest = (args: {
    path: string;
    body: Record<string, unknown>;
  }) => {
    for (const call of mockFetch.mock.calls) {
      const [callUrl, callArgs] = call;
      if (callUrl === `${API_ENDPOINT}/testing/ci${args.path}`) {
        expect(callArgs.method).toEqual('POST');
        expect(callArgs.headers).toEqual({
          Authorization: `Bearer ${mockAPIKey}`,
          'Content-Type': 'application/json',
        });
        const parsedBody = JSON.parse(callArgs.body);
        if (isMatch(parsedBody, args.body)) {
          return;
        }
      }
    }

    // If we reach here, we didn't find the expected request
    throw new Error(`Expected request not found: ${JSON.stringify(args)}`);
  };

  beforeAll(() => {
    // Remove this since we're setting it in beforeEach now
  });

  afterAll(() => {
    // Remove this since we're cleaning it up in afterEach now
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

  it('sends an error if there are duplicate test case hashes', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        { x: 1, y: 2 },
        { x: 1, y: 2 }, // Duplicate test case
      ],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(1);
    const req = decodeRequests()[0];
    expect(req.path).toEqual('/errors');
    expect(req.body.testExternalId).toEqual('my-test-id');
    expect(req.body.testCaseHash).toBeNull();
    expect(req.body.evaluatorExternalId).toBeNull();
    expect(req.body.error.name).toEqual('Error');
    expect(req.body.error.message).toEqual(
      "[my-test-id] Duplicate test case hash: 'c20ad4d76fe97759aa27a0c99bff6710'. See https://docs.autoblocks.ai/testing/sdk-reference#test-case-hashing",
    );
    expect(req.body.error.stacktrace).toContain(
      "Error: [my-test-id] Duplicate test case hash: 'c20ad4d76fe97759aa27a0c99bff6710'. See https://docs.autoblocks.ai/testing/sdk-reference#test-case-hashing",
    );
  });

  it('sends an error if there are duplicate evaluator ids', async () => {
    class MyEvaluator extends BaseTestEvaluator<MyTestCase, string> {
      id = 'my-evaluator';

      evaluateTestCase(): Evaluation {
        return { score: 0.5 };
      }
    }

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      evaluators: [new MyEvaluator(), new MyEvaluator()], // Duplicate evaluator
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expectNumPosts(1);
    const req = decodeRequests()[0];
    expect(req.path).toEqual('/errors');
    expect(req.body.testExternalId).toEqual('my-test-id');
    expect(req.body.testCaseHash).toBeNull();
    expect(req.body.evaluatorExternalId).toBeNull();
    expect(req.body.error.name).toEqual('Error');
    expect(req.body.error.message).toEqual(
      "[my-test-id] Duplicate evaluator id: 'my-evaluator'. Each evaluator id must be unique.",
    );
    expect(req.body.error.stacktrace).toContain(
      "Error: [my-test-id] Duplicate evaluator id: 'my-evaluator'. Each evaluator id must be unique.",
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
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator-1',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
      },
    });
  });

  it('tracks prompt manager usage', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      fn: async ({ testCase }) => {
        const promptManager = new AutoblocksPromptManager({
          // @ts-expect-error this is just a test
          id: 'my-prompt-id',
          version: {
            major: '1',
            // @ts-expect-error this is just a test
            minor: '0',
          },
          apiKey: 'mock-api-key',
        });

        await promptManager.init();

        promptManager.exec(() => {});

        return `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
      },
    });

    // Verify the test run requests
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
        testCaseRevisionUsage: [
          {
            entityExternalId: 'my-prompt-id',
            entityType: 'prompt',
            revisionId: 'my-revision-id',
          },
        ],
      },
    });

    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
      },
    });

    // Verify the prompt manager request
    const promptRequests = mockFetch.mock.calls.filter((call) =>
      call[0].toString().includes('/prompts/'),
    );
    expect(promptRequests).toHaveLength(1);
    expect(promptRequests[0][0]).toEqual(
      `${API_ENDPOINT}/prompts/my-prompt-id/major/1/minor/0`,
    );
    expect(promptRequests[0][1]).toEqual({
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-api-key',
        'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
      },
      signal: expect.any(AbortSignal),
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

    expect(
      requests.map((r) => ({
        ...r,
        body: omit(r.body, [
          'testCaseDurationMs',
          'testCaseHumanReviewInputFields',
          'testCaseHumanReviewOutputFields',
        ]),
      })),
    ).toEqual([
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
          runId: mockRunId,
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
          testCaseRevisionUsage: [],
        },
      },
      {
        path: '/results',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
          testCaseHash: md5(`34`),
          testCaseBody: { x: 3, y: 4 },
          testCaseOutput: '3 + 4 = 7',
          testCaseRevisionUsage: [],
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
          testCaseHash: md5(`12`),
          evaluatorExternalId: 'my-evaluator-1',
          score: 0.5,
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
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
          runId: mockRunId,
          testCaseHash: md5(`34`),
          evaluatorExternalId: 'my-evaluator-1',
          score: 0.5,
        },
      },
      {
        path: '/evals',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
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
          runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`12`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
      },
    });
  });

  it('creates a human review job', async () => {
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
      humanReviewJob: {
        name: 'my-human-review-job',
        assigneeEmailAddress: 'test@test.com',
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
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/human-review-job`,
      body: {
        name: 'my-human-review-job',
        assigneeEmailAddress: 'test@test.com',
      },
    });
  });

  it('creates a human review jobs', async () => {
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
      humanReviewJob: {
        name: 'my-human-review-job',
        assigneeEmailAddress: ['test@test.com', 'test2@test.com'],
      },
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`34`),
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/human-review-job`,
      body: {
        name: 'my-human-review-job',
        assigneeEmailAddress: 'test@test.com',
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/human-review-job`,
      body: {
        name: 'my-human-review-job',
        assigneeEmailAddress: 'test2@test.com',
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
        runId: mockRunId,
        testCaseHash: '1-2',
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: '3-4',
        testCaseBody: { x: 3, y: 4 },
        testCaseOutput: '3 + 4 = 7',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '{"result":"1 + 2 = 3"}',
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
      },
    });
  });

  it('collects test events', async () => {
    const timestamp = new Date().toISOString();

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      evaluators: [],
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
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results/${mockTestCaseResultId}/events`,
      body: {
        testCaseEvents: [
          {
            message: '1 + 2 = 3',
            traceId: 'test-trace-id',
            timestamp,
            properties: {},
            systemProperties: {},
          },
        ],
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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

    await runTestSuite<T, O>({
      id: 'my-test-id',
      testCaseHash: ['x'],
      testCases: [{ x: 0.5 }],
      evaluators: [new MyEvaluator()],
      fn: async ({ testCase }) => {
        return `${testCase.x}`;
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
        runId: mockRunId,
        testCaseHash: md5(`0.5`),
        testCaseBody: { x: 0.5 },
        testCaseOutput: '0.5',
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`0.5`),
        evaluatorExternalId: 'my-evaluator',
        score: 0.5,
      },
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
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

  it('sends test case durations to /results', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) => {
        return `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
      },
    });

    const requests = decodeRequests();
    expect(requests[1].path).toEqual('/results');
    expect(requests[1].body.testCaseDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('serializes test cases and outputs for human review', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      fn: ({ testCase }: { testCase: MyTestCase }) => {
        return `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
      },
      serializeTestCaseForHumanReview: (testCase) => {
        return [
          {
            name: 'x',
            value: `${testCase.x}`,
          },
          {
            name: 'y',
            value: `${testCase.x}`,
            contentType: HumanReviewFieldContentType.MARKDOWN,
          },
          {
            name: 'sum',
            value: `${testCase.x + testCase.y}`,
          },
        ];
      },
      serializeOutputForHumanReview: (output) => {
        return [
          {
            name: 'output',
            value: output,
          },
        ];
      },
    });

    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
        testCaseHumanReviewInputFields: [
          {
            name: 'x',
            value: '1',
          },
          {
            name: 'y',
            value: '1',
            contentType: HumanReviewFieldContentType.MARKDOWN,
          },
          {
            name: 'sum',
            value: '3',
          },
        ],
        testCaseHumanReviewOutputFields: [
          {
            name: 'output',
            value: '1 + 2 = 3',
          },
        ],
      },
    });
  });

  it('serializes dataset item ids', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      fn: ({ testCase }: { testCase: MyTestCase }) => {
        return `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`;
      },
      serializeDatasetItemId: (testCase) => {
        return `${testCase.x}-${testCase.y}`;
      },
    });

    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: mockRunId,
        testCaseHash: md5(`12`),
        testCaseBody: { x: 1, y: 2 },
        testCaseOutput: '1 + 2 = 3',
        datasetItemId: '1-2',
      },
    });
  });

  describe('Test Suite Filters', () => {
    it('filters test suites when none match', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES] =
        JSON.stringify(['random']);
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(0);
    });

    it('filters test suites when when there is a match', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES] =
        JSON.stringify(['test']);
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
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
          runId: mockRunId,
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
        },
      });
      expectPostRequest({
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
        },
      });
    });

    it('filters test suites when there is multiple filters', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES] =
        JSON.stringify(['random', 'test']);
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
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
          runId: mockRunId,
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
        },
      });
      expectPostRequest({
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
        },
      });
    });

    it('filters test suites when when there is an exact match', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES] =
        JSON.stringify(['my-test-id']);
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
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
          runId: mockRunId,
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
        },
      });
      expectPostRequest({
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
        },
      });
    });
  });

  describe('Tests and Hashes Overrides', () => {
    it('skips tests with no match on test id', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES] =
        JSON.stringify({ random: [] });
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(0);
    });

    it('handles no test cases matching for a test id', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES] =
        JSON.stringify({ 'my-test-id': ['random'] });
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(1);
      const req = decodeRequests()[0];
      expect(req.path).toEqual('/errors');
      expect(req.body.testExternalId).toEqual('my-test-id');
      expect(req.body.testCaseHash).toBeNull();
      expect(req.body.evaluatorExternalId).toBeNull();
    });

    it('only runs test case hashes that are set', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES] =
        JSON.stringify({ 'my-test-id': [md5(`12`)] });
      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
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
          runId: mockRunId,
          testCaseHash: md5(`12`),
          testCaseBody: { x: 1, y: 2 },
          testCaseOutput: '1 + 2 = 3',
        },
      });
      expectPostRequest({
        path: '/end',
        body: {
          testExternalId: 'my-test-id',
          runId: mockRunId,
        },
      });
    });
  });

  describe('Test Run Message Overrides', () => {
    it('uses legacy AUTOBLOCKS_TEST_RUN_MESSAGE when no unified format is set', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_TEST_RUN_MESSAGE] =
        'Legacy message';

      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(3);
      expectPostRequest({
        path: '/start',
        body: {
          testExternalId: 'my-test-id',
        },
      });
    });

    it('uses unified AUTOBLOCKS_OVERRIDES format for test run message', async () => {
      const customCliServerAddress = 'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        customCliServerAddress;
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        testRunMessage: 'Unified message',
      });

      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(3);
      // Use custom expectation for this test since it uses a different CLI server address
      for (const call of mockFetch.mock.calls) {
        const [callUrl, callArgs] = call;
        if (callUrl === `${customCliServerAddress}/start`) {
          expect(callArgs.method).toEqual('POST');
          expect(callArgs.headers).toEqual({
            'Content-Type': 'application/json',
          });
          const parsedBody = JSON.parse(callArgs.body);
          expect(parsedBody.testExternalId).toEqual('my-test-id');
          return;
        }
      }
      throw new Error('Expected /start request not found');
    });

    it('unified format takes precedence over legacy format for test run message', async () => {
      const customCliServerAddress = 'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        customCliServerAddress;
      // Set both formats - unified should take precedence
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        testRunMessage: 'Unified message',
      });
      process.env[AutoblocksEnvVar.AUTOBLOCKS_TEST_RUN_MESSAGE] =
        'Legacy message';

      await runTestSuite<MyTestCase, string>({
        id: 'my-test-id',
        testCases: [{ x: 1, y: 2 }],
        testCaseHash: ['x', 'y'],
        fn: ({ testCase }: { testCase: MyTestCase }) =>
          `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
      });

      expectNumPosts(3);
      // Use custom expectation for this test since it uses a different CLI server address
      for (const call of mockFetch.mock.calls) {
        const [callUrl, callArgs] = call;
        if (callUrl === `${customCliServerAddress}/start`) {
          expect(callArgs.method).toEqual('POST');
          expect(callArgs.headers).toEqual({
            'Content-Type': 'application/json',
          });
          const parsedBody = JSON.parse(callArgs.body);
          expect(parsedBody.testExternalId).toEqual('my-test-id');
          return;
        }
      }
      throw new Error('Expected /start request not found');
    });
  });
});

/**
 * This is a separate describe() because the main one mocks
 * all fetch requests to be successful. This one will test
 * unsuccessful fetch requests within each test.
 */
describe('Testing SDK with HTTP Errors', () => {
  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = MOCK_CLI_SERVER_ADDRESS;
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
  });

  it('stops if /start fails', async () => {
    const mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false } as Response);

    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      evaluators: [],
      fn: ({ testCase }: { testCase: MyTestCase }) =>
        `${testCase.x} + ${testCase.y} = ${testCase.x + testCase.y}`,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${MOCK_CLI_SERVER_ADDRESS}/start`, {
      method: 'POST',
      body: JSON.stringify({
        testExternalId: 'my-test-id',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});

/**
 * This is a separate describe() because the main one mocks
 * all fetch requests to be successful. This one handles multiple start
 * requests for grid search
 */
describe('Testing Grid Search', () => {
  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = MOCK_CLI_SERVER_ADDRESS;
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
  });

  const expectPostRequest = (args: {
    path: string;
    body: Record<string, unknown>;
    mockFetch: jest.SpyInstance;
  }) => {
    for (const call of args.mockFetch.mock.calls) {
      const [callUrl, callArgs] = call;
      expect(callArgs.method).toEqual('POST');
      expect(callArgs.headers).toEqual({
        'Content-Type': 'application/json',
      });
      if (callUrl === `${MOCK_CLI_SERVER_ADDRESS}${args.path}`) {
        const parsedBody = JSON.parse(callArgs.body);
        if (isMatch(parsedBody, args.body)) {
          return;
        }
      }
    }

    // If we reach here, we didn't find the expected request
    throw new Error(`Expected request not found: ${JSON.stringify(args)}`);
  };

  it('runs grid search', async () => {
    const runIds = ['run-1', 'run-2', 'run-3', 'run-4'];
    const mockFetch = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      const response = {
        json: () =>
          Promise.resolve(
            url.toString().endsWith('/start') ? { id: runIds.shift() } : {},
          ),
        ok: true,
      } as Response;
      return Promise.resolve(response);
    });

    await runTestSuite<string, string>({
      id: 'my-test-id',
      testCases: ['my-test-case'],
      testCaseHash: (testCase) => testCase,
      fn: async () => {
        const store = gridSearchAsyncLocalStorage.getStore();
        if (!store) {
          throw new Error('store is undefined');
        }
        return `${store['x']} + ${store['y']} = ${parseInt(store['x']) + parseInt(store['y'])}`;
      },
      gridSearchParams: {
        x: ['1', '2'],
        y: ['3', '4'],
      },
    });

    // we have 1 test case and 4 grid search combinations
    // 1 call to /grids
    // 4 calls to /start
    // 4 calls to /results
    // 4 calls to /end
    expect(mockFetch).toHaveBeenCalledTimes(13);
    expectPostRequest({
      path: '/grids',
      body: {
        gridSearchParams: {
          x: ['1', '2'],
          y: ['3', '4'],
        },
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
        gridSearchParamsCombo: {
          x: '1',
          y: '3',
        },
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
        gridSearchParamsCombo: {
          x: '1',
          y: '4',
        },
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
        gridSearchParamsCombo: {
          x: '2',
          y: '3',
        },
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/start',
      body: {
        testExternalId: 'my-test-id',
        gridSearchParamsCombo: {
          x: '2',
          y: '4',
        },
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-1',
        testCaseHash: 'my-test-case',
        testCaseBody: 'my-test-case',
        testCaseOutput: '1 + 3 = 4',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-2',
        testCaseHash: 'my-test-case',
        testCaseBody: 'my-test-case',
        testCaseOutput: '1 + 4 = 5',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-3',
        testCaseHash: 'my-test-case',
        testCaseBody: 'my-test-case',
        testCaseOutput: '2 + 3 = 5',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-4',
        testCaseHash: 'my-test-case',
        testCaseBody: 'my-test-case',
        testCaseOutput: '2 + 4 = 6',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-1',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-2',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-3',
      },
      mockFetch,
    });
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
        runId: 'run-4',
      },
      mockFetch,
    });
  });
});

it('should retry failed test cases when retryCount is specified', async () => {
  process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = mockAPIKey;

  let callCount = 0;
  const testFunction = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount < 3) {
      // Simulate a retryable error for the first 2 calls
      const error = new Error('Connection timeout') as Error & { code: string };
      error.code = 'ETIMEDOUT';
      throw error;
    }
    return 'success';
  });

  await runTestSuite<MyTestCase, string>({
    id: 'retry-test',
    testCases: [{ x: 1, y: 2 }],
    testCaseHash: ['x', 'y'],
    fn: testFunction,
    retryCount: 3,
  });

  // Should have been called 3 times (initial + 2 retries)
  expect(testFunction).toHaveBeenCalledTimes(3);
  expect(callCount).toBe(3);
});
