import { RunManager } from '../../src/testing/v2';
import { AutoblocksEnvVar } from '../../src/util';
import { BaseTestEvaluator } from '../../src/testing/models';

interface MyTestCase {
  input: string;
}
interface MyOutput {
  output: string;
}

class MyEvaluator extends BaseTestEvaluator<MyTestCase, MyOutput> {
  get id() {
    return 'evaluator-external-id';
  }
  evaluateTestCase() {
    return { score: 1, threshold: { gte: 0.5 }, metadata: { reason: 'ok' } };
  }
}

describe('RunManager V2', () => {
  const mockAPIKey = 'mock-v2-api-key';

  beforeEach(() => {
    process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY] = mockAPIKey;
    // @ts-expect-error set fetch mock
    global.fetch = jest.fn(async (url: string) => {
      if (url.toString().endsWith('/testing/results')) {
        return {
          ok: true,
          json: async () => ({ executionId: 'mock-exec-id' }),
          status: 200,
          statusText: 'OK',
        } as unknown as Response;
      }
      if (url.toString().includes('/human-review/jobs')) {
        return {
          ok: true,
          json: async () => ({}),
          status: 200,
          statusText: 'OK',
        } as unknown as Response;
      }
      throw new Error(`Unknown URL: ${url}`);
    });
  });

  afterEach(() => {
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY];
    jest.clearAllMocks();
  });

  it('does not allow adding result after run has ended', async () => {
    const rm = new RunManager<MyTestCase, MyOutput>({
      appSlug: 'my-app',
      runMessage: 'Test run',
    });
    await rm.start();
    await rm.end();
    await expect(
      rm.addResult({
        testCase: { input: 'test' },
        output: { output: 'test' },
        durationMs: 100,
      }),
    ).rejects.toThrow(/ended run/i);
  });

  it('full lifecycle v2', async () => {
    const rm = new RunManager<MyTestCase, MyOutput>({
      appSlug: 'my-app',
      runMessage: 'Test run',
    });
    await rm.start();
    const execId = await rm.addResult({
      testCase: { input: 'test' },
      output: { output: 'test' },
      durationMs: 100,
      evaluators: [new MyEvaluator()],
      startedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(execId).toBe('mock-exec-id');

    const fetchCalls = (global.fetch as unknown as jest.Mock).mock.calls;
    const createResultCall = fetchCalls.find((c) =>
      c[0].toString().endsWith('/testing/results'),
    )!;
    const body = JSON.parse(createResultCall[1].body);
    expect(body).toMatchObject({
      appSlug: 'my-app',
      environment: 'test',
      runMessage: 'Test run',
      startedAt: '2025-01-01T00:00:00.000Z',
      durationMS: 100,
      status: 'SUCCESS',
      inputRaw: JSON.stringify({ input: 'test' }),
      outputRaw: JSON.stringify({ output: 'test' }),
      input: { input: 'test' },
      output: { output: 'test' },
      evaluatorIdToResult: { 'evaluator-external-id': true },
      evaluatorIdToReason: { 'evaluator-external-id': 'ok' },
      evaluatorIdToScore: { 'evaluator-external-id': 1 },
    });

    await rm.end();
    await rm.createHumanReview({
      name: 'Test human review job',
      assigneeEmailAddresses: ['test@test.com'],
    });
    const hrCall = fetchCalls.find((c) =>
      c[0].toString().includes('/human-review/jobs'),
    )!;
    const hrBody = JSON.parse(hrCall[1].body);
    expect(hrBody).toMatchObject({
      runId: rm.runId,
      assigneeEmailAddresses: ['test@test.com'],
      name: 'Test human review job',
    });
    expect(typeof hrBody.startTimestamp).toBe('string');
    expect(typeof hrBody.endTimestamp).toBe('string');
  });

  it('end without start sets timestamps and allows human review', async () => {
    const rm = new RunManager<MyTestCase, MyOutput>({ appSlug: 'my-app' });
    await rm.end();
    expect(rm.canCreateHumanReview).toBe(true);
    expect(rm.startedAt).toBeDefined();
    expect(rm.endedAt).toBeDefined();

    await rm.createHumanReview({
      name: 'HR job',
      assigneeEmailAddresses: ['a@test.com'],
    });
    const fetchCalls = (global.fetch as unknown as jest.Mock).mock.calls;
    const hrCall = fetchCalls.find((c) =>
      c[0].toString().includes('/human-review/jobs'),
    )!;
    const hrBody = JSON.parse(hrCall[1].body);
    expect(hrBody).toMatchObject({
      runId: rm.runId,
      assigneeEmailAddresses: ['a@test.com'],
      name: 'HR job',
    });
    expect(typeof hrBody.startTimestamp).toBe('string');
    expect(typeof hrBody.endTimestamp).toBe('string');
  });

  it('addResult without evaluators sends empty maps', async () => {
    const rm = new RunManager<MyTestCase, MyOutput>({ appSlug: 'my-app' });
    await rm.start();
    const execId = await rm.addResult({
      testCase: { input: 'test' },
      output: { output: 'test' },
      durationMs: 250,
    });
    expect(execId).toBe('mock-exec-id');
    const fetchCalls = (global.fetch as unknown as jest.Mock).mock.calls;
    const createResultCall = fetchCalls.find((c) =>
      c[0].toString().endsWith('/testing/results'),
    )!;
    const body = JSON.parse(createResultCall[1].body);
    expect(body.evaluatorIdToResult).toEqual({});
    expect(body.evaluatorIdToReason).toEqual({});
    expect(body.evaluatorIdToScore).toEqual({});
  });
});
