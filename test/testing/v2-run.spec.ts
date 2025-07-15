import { runTestSuite } from '../../src/testing/v2';
import { AutoblocksEnvVar } from '../../src/util';

interface MyTestCase {
  x: number;
  y: number;
}

describe('Testing SDK V2', () => {
  const mockAPIKey = 'mock-v2-api-key';

  beforeEach(() => {
    process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY] = mockAPIKey;
  });

  afterEach(() => {
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY];
    jest.clearAllMocks();
  });

  it('should retry failed test cases when retryCount is specified', async () => {
    let callCount = 0;
    const testFunction = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        // Simulate a retryable error for the first 2 calls
        const error = new Error('Connection timeout') as Error & {
          code: string;
        };
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'success';
    });

    await runTestSuite<MyTestCase, string>({
      id: 'retry-test-v2',
      appSlug: 'test-app',
      testCases: [{ x: 1, y: 2 }],
      testCaseHash: ['x', 'y'],
      fn: testFunction,
      retryCount: 3,
    });

    // Should have been called 3 times (initial + 2 retries)
    expect(testFunction).toHaveBeenCalledTimes(3);
    expect(callCount).toBe(3);
  });
});
