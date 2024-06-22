import { runTestSuite, HasAllSubstrings } from '../../src/testing';
import crypto from 'crypto';
import { isMatch } from 'lodash';
import { Battle } from '../../src/testing/evaluators/battle';
import { API_ENDPOINT } from '../../src/util';

const MOCK_CLI_SERVER_ADDRESS = 'http://localhost:8000';

interface MyTestCase {
  input: string;
  expectedSubstrings: string[];
}

const md5 = (str: string) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

describe('Testing SDK', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({}),
      ok: true,
    } as Response);
  });

  const expectNumRequests = (num: number) => {
    expect(mockFetch).toHaveBeenCalledTimes(num);
  };

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

  it('has-all-substrings', async () => {
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
      evaluators: [
        new HasAllSubstrings({
          outputMapper: (output) => output,
          testCaseMapper: (testCase) => testCase.expectedSubstrings,
        }),
      ],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectNumRequests(6);

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
        testCaseHash: md5('hello world'),
        testCaseBody: {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
        testCaseOutput: 'hello world',
      },
    });
    expectPostRequest({
      path: '/results',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('foo'),
        testCaseBody: {
          input: 'foo',
          expectedSubstrings: ['bar'],
        },
        testCaseOutput: 'foo',
      },
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
    expectPostRequest({
      path: '/end',
      body: {
        testExternalId: 'my-test-id',
      },
    });
  });

  it('battle', async () => {
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [
        new Battle({
          criteria: 'The best greeting',
          outputMapper: (output) => output,
        }),
      ],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectNumRequests(6);

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
        testCaseHash: md5('hello world'),
        testCaseBody: {
          input: 'hello world',
          expectedSubstrings: ['hello', 'world'],
        },
        testCaseOutput: 'hello world',
      },
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
    expectPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'battle',
        score: 1,
        threshold: { gte: 0.5 },
        metadata: {
          reason: 'No baseline found, saving the output as the baseline.',
        },
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
