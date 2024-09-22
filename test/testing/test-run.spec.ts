import { isMatch } from 'lodash';
import { HumanReviewFieldContentType, TestRun } from '../../src/testing';
import { API_ENDPOINT, AutoblocksEnvVar } from '../../src/util';

describe('TestRun', () => {
  let mockFetch: jest.SpyInstance;
  const mockRunId = 'mock-run-id';
  const mockTestCaseResultId = 'mock-test-case-result-id';
  const mockAPIKey = 'mock-api-key';

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      const response = {
        json: () => {
          if (url.toString().endsWith('/runs')) {
            return Promise.resolve({ id: mockRunId });
          }
          if (url.toString().endsWith('/results')) {
            return Promise.resolve({ id: mockTestCaseResultId });
          }
          return Promise.resolve({});
        },
        ok: true,
      } as Response;
      return Promise.resolve(response);
    });
    // Make CI and local consistent
    process.env['CI'] = 'false';
    process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = mockAPIKey;
  });

  afterEach(() => {
    delete process.env['CI'];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY];
  });

  const expectPublicAPIPostRequest = (args: {
    path: string;
    body: Record<string, unknown>;
  }) => {
    for (const call of mockFetch.mock.calls) {
      const [callUrl, callArgs] = call;
      if (callUrl === `${API_ENDPOINT}/testing/local${args.path}`) {
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

  it('does not allow adding a result before starting.', async () => {
    const testRun = new TestRun<{ input: string }, { output: string }>({
      message: 'Test run',
      testId: 'test-id',
      testCaseHash: (testCase) => testCase.input,
      serializeTestCaseForHumanReview: ({ input }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: input,
          name: 'input',
        },
      ],
      serializeOutputForHumanReview: ({ output }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: output,
          name: 'output',
        },
      ],
    });

    await expect(async () => {
      await testRun.addResult({
        testCase: { input: 'test' },
        testCaseDurationMs: 100,
        output: { output: 'test' },
        evaluations: [
          {
            id: 'evaluator-external-id',
            score: 1,
            threshold: {
              gte: 0.5,
            },
          },
        ],
      });
    }).rejects.toThrow(
      'You must start the run with `start()` before adding results.',
    );
  });

  it('does not allow adding a result after the run has ended', async () => {
    const testRun = new TestRun<{ input: string }, { output: string }>({
      message: 'Test run',
      testId: 'test-id',
      testCaseHash: (testCase) => testCase.input,
      serializeTestCaseForHumanReview: ({ input }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: input,
          name: 'input',
        },
      ],
      serializeOutputForHumanReview: ({ output }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: output,
          name: 'output',
        },
      ],
    });

    await testRun.start();
    await testRun.end();

    await expect(async () => {
      await testRun.addResult({
        testCase: { input: 'test' },
        testCaseDurationMs: 100,
        output: { output: 'test' },
        evaluations: [
          {
            id: 'evaluator-external-id',
            score: 1,
            threshold: {
              gte: 0.5,
            },
          },
        ],
      });
    }).rejects.toThrow('You cannot add results to an ended run.');
  });

  it('does not allow ending a run that has not been started', async () => {
    const testRun = new TestRun<{ input: string }, { output: string }>({
      message: 'Test run',
      testId: 'test-id',
      testCaseHash: (testCase) => testCase.input,
      serializeTestCaseForHumanReview: ({ input }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: input,
          name: 'input',
        },
      ],
      serializeOutputForHumanReview: ({ output }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: output,
          name: 'output',
        },
      ],
    });

    await expect(async () => {
      await testRun.end();
    }).rejects.toThrow(
      'You must start the run with `start()` before ending it.',
    );
  });

  it('should go through full lifecycle', async () => {
    const testRun = new TestRun<{ input: string }, { output: string }>({
      message: 'Test run',
      testId: 'test-id',
      testCaseHash: (testCase) => testCase.input,
      serializeTestCaseForHumanReview: ({ input }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: input,
          name: 'input',
        },
      ],
      serializeOutputForHumanReview: ({ output }) => [
        {
          type: HumanReviewFieldContentType.TEXT,
          value: output,
          name: 'output',
        },
      ],
    });

    await testRun.start();
    expectPublicAPIPostRequest({
      path: '/runs',
      body: {
        testExternalId: 'test-id',
        message: 'Test run',
      },
    });
    expect(testRun.runId).toBe(mockRunId);

    await testRun.addResult({
      testCase: { input: 'test' },
      testCaseDurationMs: 100,
      output: { output: 'test' },
      evaluations: [
        {
          id: 'evaluator-external-id',
          score: 1,
          threshold: {
            gte: 0.5,
          },
        },
      ],
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results`,
      body: {
        testCaseHash: 'test',
        testCaseDurationMs: 100,
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results/${mockTestCaseResultId}/body`,
      body: {
        testCaseBody: { input: 'test' },
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results/${mockTestCaseResultId}/output`,
      body: {
        testCaseOutput: JSON.stringify({ output: 'test' }),
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results/${mockTestCaseResultId}/human-review-fields`,
      body: {
        testCaseHumanReviewInputFields: [
          {
            type: HumanReviewFieldContentType.TEXT,
            value: 'test',
            name: 'input',
          },
        ],
        testCaseHumanReviewOutputFields: [
          {
            type: HumanReviewFieldContentType.TEXT,
            value: 'test',
            name: 'output',
          },
        ],
      },
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/results/${mockTestCaseResultId}/evaluations`,
      body: {
        evaluatorExternalId: 'evaluator-external-id',
        score: 1,
        passed: true,
        threshold: {
          gte: 0.5,
        },
      },
    });

    await testRun.end();
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/end`,
      body: {},
    });

    await testRun.createHumanReviewJob({
      assigneeEmailAddress: 'test@test.com',
    });
    expectPublicAPIPostRequest({
      path: `/runs/${mockRunId}/human-review-job`,
      body: {
        assigneeEmailAddress: 'test@test.com',
      },
    });
  });
});
