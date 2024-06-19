import { runTestSuite, HasAllSubstrings } from '../../src/testing';
import crypto from 'crypto';
import { isMatch } from 'lodash';

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
      json: () => Promise.resolve(),
      ok: true,
    } as Response);
  });

  const expectNumPosts = (num: number) => {
    expect(mockFetch).toHaveBeenCalledTimes(num);
  };

  const expectPostRequest = (args: {
    path: string;
    body: Record<string, unknown>;
  }) => {
    for (const call of mockFetch.mock.calls) {
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

  beforeAll(() => {
    process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS = MOCK_CLI_SERVER_ADDRESS;
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
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
});
