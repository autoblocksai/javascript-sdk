import {
  runTestSuite,
  BaseAutomaticBattle,
  BaseManualBattle,
  BaseHasAllSubstrings,
  BaseIsEquals,
  BaseIsValidJson,
} from '../../src/testing';
import crypto from 'crypto';
import { isMatch } from 'lodash';
import { API_ENDPOINT } from '../../src/util';

// This needs to be outside of the it block to be hoisted correctly
jest.mock('openai', () => ({
  __esModule: true,
  default: function () {
    // Using a function to simulate the constructor behavior
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    result: '2',
                    reason: 'this is the reason',
                  }),
                },
              },
            ],
          }),
        },
      },
    };
  },
}));

const MOCK_CLI_SERVER_ADDRESS = 'http://localhost:8000';

interface MyTestCase {
  input: string;
  expectedSubstrings: string[];
}

const md5 = (str: string) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

describe('OOB Evaluators', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({}),
      ok: true,
    } as Response);
  });

  const expectPublicAPIRequest = (args: {
    path: string;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }) => {
    for (const call of mockFetch.mock.calls) {
      const [callUrl, callArgs] = call;
      if (
        callUrl === `${API_ENDPOINT}${args.path}` &&
        callArgs.method === args.method
      ) {
        if (!args.body) {
          return;
        }
        const parsedBody = JSON.parse(callArgs.body);
        if (isMatch(parsedBody, args.body)) {
          return;
        }
      }
    }

    // If we reach here, we didn't find the expected request
    throw new Error(`Expected request not found: ${JSON.stringify(args)}`);
  };

  const expectPostRequest = (args: {
    path: string;
    body: Record<string, unknown>;
  }) => {
    console.log(mockFetch.mock.calls);
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

  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = MOCK_CLI_SERVER_ADDRESS;
    process.env.AUTOBLOCKS_API_KEY = 'fake-autoblocks';
    process.env.OPENAI_API_KEY = 'fake-openai';
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
    delete process.env.AUTOBLOCKS_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('BaseHasAllSubstrings', async () => {
    class HasAllSubstrings extends BaseHasAllSubstrings<MyTestCase, string> {
      id = 'has-all-substrings';

      outputMapper({ output }: { output: string }) {
        return output;
      }

      testCaseMapper({ testCase }: { testCase: MyTestCase }) {
        return testCase.expectedSubstrings;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
        {
          input: 'foo',
          expectedSubstrings: ['bar'],
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new HasAllSubstrings()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'has-all-substrings',
        score: 1,
        threshold: { gte: 1 },
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('foo'),
        evaluatorExternalId: 'has-all-substrings',
        score: 0,
        threshold: { gte: 1 },
      },
    });
  });

  it('BaseAutomaticBattle', async () => {
    class MyBattle extends BaseAutomaticBattle<MyTestCase, string> {
      id = 'battle';
      criteria = 'The best greeting';

      outputMapper({ output }: { output: string }) {
        return output;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new MyBattle()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectPublicAPIRequest({
      path: `/test-suites/my-test-id/test-cases/${md5('hello world')}/baseline`,
      method: 'GET',
    });
    expectPublicAPIRequest({
      path: `/test-suites/my-test-id/test-cases/${md5('hello world')}/baseline`,
      method: 'POST',
      body: {
        baseline: 'hello world',
      },
    });
  });

  it('BaseManualBattle', async () => {
    class MyBattle extends BaseManualBattle<MyTestCase, string> {
      id = 'battle';
      criteria = 'The best greeting';

      outputMapper({ output }: { output: string }) {
        return output;
      }

      baselineMapper(args: { testCase: MyTestCase }): string {
        return args.testCase.input;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new MyBattle()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    // Depends on the mocked openai implementation at the top of this file
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'battle',
        score: 1,
        threshold: { gte: 0.5 },
        metadata: {
          reason: 'this is the reason',
          baseline: 'hello world',
          challenger: 'hello world',
          criteria: 'The best greeting',
        },
      },
    });
  });

  it('BaseIsEquals', async () => {
    interface TestCase {
      input: string;
      expectedOutput: string;
    }

    class IsEquals extends BaseIsEquals<TestCase, string> {
      id = 'is-equals';

      outputMapper({ output }: { output: string }) {
        return output;
      }

      testCaseMapper({ testCase }: { testCase: TestCase }) {
        return testCase.expectedOutput;
      }
    }
    await runTestSuite<TestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          expectedOutput: 'hello world',
        },
        {
          input: 'foo',
          expectedOutput: 'bar',
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new IsEquals()],
      fn: ({ testCase }: { testCase: TestCase }) => testCase.input,
    });

    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'is-equals',
        score: 1,
        threshold: { gte: 1 },
        metadata: {
          expectedOutput: 'hello world',
          actualOutput: 'hello world',
        },
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('foo'),
        evaluatorExternalId: 'is-equals',
        score: 0,
        threshold: { gte: 1 },
      },
    });
  });

  it('BaseIsValidJson', async () => {
    interface TestCase {
      input: string;
    }

    class IsValidJson extends BaseIsValidJson<TestCase, string> {
      id = 'is-valid-json';

      outputMapper({ output }: { output: string }) {
        return output;
      }
    }
    await runTestSuite<TestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
        },
        {
          input: JSON.stringify({ foo: 'bar' }),
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new IsValidJson()],
      fn: ({ testCase }: { testCase: TestCase }) => testCase.input,
    });

    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'is-valid-json',
        score: 0,
        threshold: { gte: 1 },
      },
    });
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5(JSON.stringify({ foo: 'bar' })),
        evaluatorExternalId: 'is-valid-json',
        score: 1,
        threshold: { gte: 1 },
      },
    });
  });
});
