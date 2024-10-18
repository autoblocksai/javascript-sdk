import { AutoblocksAPIClient } from '../src/index';
import { API_ENDPOINT, AutoblocksEnvVar } from '../src/util';

describe('Autoblocks Client', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - TS wants me to fully mock a fetch response, but we only
      // need the json() method
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  describe('constructor', () => {
    it('accepts api key as first arg (deprecated constructor)', async () => {
      const client = new AutoblocksAPIClient('mock-api-key');
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });
    });

    it('accepts api key in args', async () => {
      const client = new AutoblocksAPIClient({ apiKey: 'mock-api-key' });
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });
    });

    it('accepts api key as environment variable', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = 'mock-api-key';

      const client = new AutoblocksAPIClient();
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });

      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      async (timeout, expected) => {
        const client = new AutoblocksAPIClient('mock-api-key', { timeout });
        await client.getViews();

        expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
            Authorization: 'Bearer mock-api-key',
          },
          signal: AbortSignal.timeout(expected),
        });
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", async (timeout, expected) => {
      const client = new AutoblocksAPIClient({
        apiKey: 'mock-api-key',
        timeout,
      });
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(expected),
      });
    });
  });

  describe('getTestCases', () => {
    it('Should fetch test cases', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              testCases: [{ id: '123', body: { input: 'test' } }],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const testCaseResult = await client.getTestCases<{ input: string }>({
        testSuiteId: 'something',
      });
      expect(testCaseResult.testCases[0].body.input).toEqual('test');
    });
  });

  describe('getLocalTestRuns', () => {
    it('Should fetch local Test runs', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              runs: [{ id: 'local-run-1' }, { id: 'local-run-2' }],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const localRunsResult = await client.getLocalTestRuns('test-external-id');
      expect(localRunsResult.runs).toHaveLength(2);
      expect(localRunsResult.runs[0].id).toEqual('local-run-1');
      expect(localRunsResult.runs[1].id).toEqual('local-run-2');
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/local/tests/test-external-id/runs`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });

  describe('getCITestRuns', () => {
    it('Should fetch CI Test runs', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              runs: [
                { id: 'ci-run-1' },
                { id: 'ci-run-2' },
                { id: 'ci-run-3' },
              ],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const ciRunsResult = await client.getCITestRuns('test-external-id');
      expect(ciRunsResult.runs).toHaveLength(3);
      expect(ciRunsResult.runs[0].id).toEqual('ci-run-1');
      expect(ciRunsResult.runs[1].id).toEqual('ci-run-2');
      expect(ciRunsResult.runs[2].id).toEqual('ci-run-3');
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/ci/tests/test-external-id/runs`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });

  describe('getLocalTestResults', () => {
    it('Should fetch local Test results', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: 'local-result-1' }, { id: 'local-result-2' }],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const localResultsResult =
        await client.getLocalTestResults('local-run-id');
      expect(localResultsResult.results).toHaveLength(2);
      expect(localResultsResult.results[0].id).toEqual('local-result-1');
      expect(localResultsResult.results[1].id).toEqual('local-result-2');
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/local/runs/local-run-id/results`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });

  describe('getCITestResults', () => {
    it('Should fetch CI Testresults', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                { id: 'ci-result-1' },
                { id: 'ci-result-2' },
                { id: 'ci-result-3' },
              ],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const ciResultsResult = await client.getCITestResults('ci-run-id');
      expect(ciResultsResult.results).toHaveLength(3);
      expect(ciResultsResult.results[0].id).toEqual('ci-result-1');
      expect(ciResultsResult.results[1].id).toEqual('ci-result-2');
      expect(ciResultsResult.results[2].id).toEqual('ci-result-3');
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/ci/runs/ci-run-id/results`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });

  describe('getLocalTestResult', () => {
    it('Should fetch local test result with evaluations', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'local-result-1',
              runId: 'local-run-1',
              hash: 'hash123',
              datasetItemId: 'dataset-item-1',
              durationMs: 1000,
              events: [{ id: 'event-1', message: 'Test event' }],
              body: { input: 'test input' },
              output: { result: 'test output' },
              evaluations: [
                {
                  evaluatorId: 'evaluator-1',
                  score: 0.95,
                  passed: true,
                  threshold: 0.8,
                  metadata: { key: 'value' },
                },
              ],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const result = await client.getLocalTestResult('local-result-1');

      expect(result).toEqual({
        id: 'local-result-1',
        runId: 'local-run-1',
        hash: 'hash123',
        datasetItemId: 'dataset-item-1',
        durationMs: 1000,
        events: [expect.any(Object)],
        body: { input: 'test input' },
        output: { result: 'test output' },
        evaluations: [
          {
            evaluatorId: 'evaluator-1',
            score: 0.95,
            passed: true,
            threshold: 0.8,
            metadata: { key: 'value' },
          },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/local/results/local-result-1`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });

  describe('getCITestResult', () => {
    it('Should fetch CI test result with evaluations', async () => {
      mockFetch = jest
        .spyOn(global, 'fetch')
        // @ts-expect-error - Only need json
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'ci-result-1',
              runId: 'ci-run-1',
              hash: 'hash456',
              datasetItemId: 'dataset-item-2',
              durationMs: 2000,
              events: [{ id: 'event-2', message: 'CI Test event' }],
              body: { input: 'ci test input' },
              output: { result: 'ci test output' },
              evaluations: [
                {
                  evaluatorId: 'evaluator-2',
                  score: 0.85,
                  passed: true,
                  threshold: 0.7,
                  metadata: { ci_key: 'ci_value' },
                },
              ],
            }),
        });
      const client = new AutoblocksAPIClient('mock-api-key');
      const result = await client.getCITestResult('ci-result-1');

      expect(result).toEqual({
        id: 'ci-result-1',
        runId: 'ci-run-1',
        hash: 'hash456',
        datasetItemId: 'dataset-item-2',
        durationMs: 2000,
        events: expect.arrayContaining([expect.any(Object)]),
        body: { input: 'ci test input' },
        output: { result: 'ci test output' },
        evaluations: [
          {
            evaluatorId: 'evaluator-2',
            score: 0.85,
            passed: true,
            threshold: 0.7,
            metadata: { ci_key: 'ci_value' },
          },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/testing/ci/results/ci-result-1`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-api-key',
          }),
        }),
      );
    });
  });
});
