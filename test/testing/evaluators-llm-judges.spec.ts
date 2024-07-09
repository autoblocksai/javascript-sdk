import {
  runTestSuite,
  BaseLLMJudge,
  BaseNSFW,
  BaseToxicity,
  BaseAutomaticBattle,
  BaseManualBattle,
} from '../../src/testing';
import crypto from 'crypto';
import { isMatch } from 'lodash';
import { API_ENDPOINT } from '../../src/util';
import { EvaluationOverride } from '../../src/testing/models';

const MOCK_CLI_SERVER_ADDRESS = 'http://localhost:8000';

const md5 = (str: string) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

jest.setTimeout(30_000);

describe('LLM Judges', () => {
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

  const expectCLIPostRequest = (args: {
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
  });

  afterAll(() => {
    delete process.env.AUTOBLOCKS_CLI_SERVER_ADDRESS;
    delete process.env.AUTOBLOCKS_API_KEY;
  });

  it('BaseLLMJudge', async () => {
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            originalScore: 1,
            overrideScore: 0,
            inputFields: [
              {
                id: '1',
                name: 'input',
                value: '123',
              },
            ],
            outputFields: [
              {
                id: '2',
                name: 'input',
                value: '123',
              },
            ],
            comments: [
              {
                fieldId: '2',
                quotedText: '123',
                commentText: 'This does not contain any zeros',
              },
            ],
          },
        ]),
      ok: true,
    } as Response);

    interface MyTestCase {
      input: string;
    }

    class NoZeros extends BaseLLMJudge<MyTestCase, string> {
      id = 'no-zeros';
      threshold = { gte: 1 };
      numOverrides = 1;
      scoreChoices = [
        { name: 'No', value: 1 },
        { name: 'Yes', value: 0 },
      ];

      makePrompt(args: {
        testCase: MyTestCase;
        output: string;
        recentOverrides: EvaluationOverride[];
      }): string {
        return `Does ${args.output} contain any zeros?`;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: '123',
        },
        {
          input: '000',
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new NoZeros()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectPublicAPIRequest({
      path: `/test-suites/my-test-id/evaluators/no-zeros/human-reviews?n=1`,
      method: 'GET',
    });
    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('123'),
        evaluatorExternalId: 'no-zeros',
        score: 1,
        threshold: { gte: 1 },
      },
    });
    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('000'),
        evaluatorExternalId: 'no-zeros',
        score: 0,
        threshold: { gte: 1 },
      },
    });
  });

  it('BaseNSFW', async () => {
    interface MyTestCase {
      input: string;
    }

    class NSFW extends BaseNSFW<MyTestCase, string> {
      id = 'nsfw';

      outputMapper(args: { output: string }): string {
        return args.output;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'shit',
        },
        {
          input: 'I love you',
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new NSFW()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('shit'),
        evaluatorExternalId: 'nsfw',
        score: 0,
        threshold: { gte: 1 },
      },
    });
    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('I love you'),
        evaluatorExternalId: 'nsfw',
        score: 1,
        threshold: { gte: 1 },
      },
    });
  });

  it('BaseToxicty', async () => {
    interface MyTestCase {
      input: string;
    }

    class Toxicity extends BaseToxicity<MyTestCase, string> {
      id = 'toxicity';

      outputMapper(args: { output: string }): string {
        return args.output;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'I hate you',
        },
        {
          input: 'I love you',
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new Toxicity()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('I hate you'),
        evaluatorExternalId: 'toxicity',
        score: 0,
        threshold: { gte: 1 },
      },
    });
    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('I love you'),
        evaluatorExternalId: 'toxicity',
        score: 1,
        threshold: { gte: 1 },
      },
    });
  });

  it('BaseAutomaticBattle', async () => {
    interface MyTestCase {
      input: string;
    }

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
    interface MyTestCase {
      input: string;
      baseline: string;
    }
    class MyBattle extends BaseManualBattle<MyTestCase, string> {
      id = 'battle';
      criteria = 'The best greeting';

      outputMapper({ output }: { output: string }) {
        return output;
      }

      baselineMapper(args: { testCase: MyTestCase }): string {
        return args.testCase.baseline;
      }
    }
    await runTestSuite<MyTestCase, string>({
      id: 'my-test-id',
      testCases: [
        {
          input: 'hello world',
          baseline: 'goodbye',
        },
      ],
      testCaseHash: (testCase) => md5(testCase.input),
      evaluators: [new MyBattle()],
      fn: ({ testCase }: { testCase: MyTestCase }) => testCase.input,
    });

    // Depends on the mocked openai implementation at the top of this file
    expectCLIPostRequest({
      path: '/evals',
      body: {
        testExternalId: 'my-test-id',
        testCaseHash: md5('hello world'),
        evaluatorExternalId: 'battle',
        score: 1,
        threshold: { gte: 0.5 },
      },
    });
  });
});
