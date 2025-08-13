import { createId } from '@paralleldrive/cuid2';
import { BaseTestEvaluator, Evaluation } from '../models';
import { Semaphore, determineIfEvaluationPassed } from '../util';
import { sendCreateHumanReviewJob, sendCreateResult } from './api';

type EvaluationWithId = Evaluation & { id: string };

const evaluatorSemaphoreRegistry: Record<
  string,
  Record<string, Semaphore>
> = {};

function nowRfc3339(): string {
  return new Date().toISOString();
}

function ensureEvaluatorSemaphores(
  appSlug: string,
  evaluators: Array<BaseTestEvaluator<unknown, unknown>>,
): void {
  if (!evaluatorSemaphoreRegistry[appSlug]) {
    evaluatorSemaphoreRegistry[appSlug] = {};
  }
  const registry = evaluatorSemaphoreRegistry[appSlug];
  for (const evaluator of evaluators) {
    if (!registry[evaluator.id]) {
      registry[evaluator.id] = new Semaphore(evaluator.maxConcurrency);
    }
  }
}

async function runEvaluator<TestCaseType, OutputType>(args: {
  appSlug: string;
  testCase: TestCaseType;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<EvaluationWithId | undefined> {
  const semaphore =
    evaluatorSemaphoreRegistry[args.appSlug]?.[args.evaluator.id];
  if (!semaphore) {
    throw new Error(
      `[${args.appSlug}] Evaluator semaphore not found for '${args.evaluator.id}'.`,
    );
  }

  return await semaphore.run(async () => {
    const evaluation = await args.evaluator.evaluateTestCase({
      testCase: args.testCase,
      output: args.output,
    });
    if (evaluation === undefined) {
      return undefined;
    }
    return { id: args.evaluator.id, ...evaluation };
  });
}

function makeEvaluatorMaps(evals: EvaluationWithId[]): {
  result: Record<string, boolean>;
  reason: Record<string, string>;
  score: Record<string, number>;
} {
  const idToResult: Record<string, boolean> = {};
  const idToReason: Record<string, string> = {};
  const idToScore: Record<string, number> = {};

  for (const e of evals) {
    const passed = determineIfEvaluationPassed({ evaluation: e });
    idToResult[e.id] = Boolean(passed);

    let reason = '';
    const metadataReason =
      typeof e.metadata === 'object' && e.metadata !== null
        ? (e.metadata as Record<string, unknown>).reason
        : undefined;
    if (typeof metadataReason === 'string' && metadataReason) {
      reason = metadataReason;
    }

    if (!reason && Array.isArray(e.assertions)) {
      for (const assertion of e.assertions) {
        if (!assertion.passed) {
          const aMeta = assertion.metadata as
            | Record<string, unknown>
            | undefined;
          const msg = aMeta?.message ?? aMeta?.reason;
          if (typeof msg === 'string' && msg) {
            reason = msg;
            break;
          }
        }
      }
    }

    idToReason[e.id] = reason;
    idToScore[e.id] = e.score;
  }

  return { result: idToResult, reason: idToReason, score: idToScore };
}

export class RunManager<TestCaseType, OutputType> {
  appSlug: string;
  environment: string;
  runMessage?: string;
  runId: string;
  startedAt?: string;
  endedAt?: string;
  canCreateHumanReview: boolean = false;

  constructor(args: {
    appSlug: string;
    environment?: string;
    runMessage?: string;
  }) {
    this.appSlug = args.appSlug;
    this.environment = args.environment ?? 'test';
    this.runMessage = args.runMessage;
    this.runId = createId();
  }

  public async start(): Promise<void> {
    this.startedAt = nowRfc3339();
  }

  public async addResult(args: {
    testCase: TestCaseType;
    output: OutputType;
    durationMs: number;
    evaluators?: Array<BaseTestEvaluator<TestCaseType, OutputType>>;
    status?: 'SUCCESS' | 'FAILED';
    startedAt?: string;
  }): Promise<string> {
    if (this.endedAt) {
      throw new Error('You cannot add results to an ended run.');
    }

    const inputRaw = JSON.stringify(args.testCase);
    const outputRaw = JSON.stringify(args.output);

    const evaluators = args.evaluators || [];
    ensureEvaluatorSemaphores(
      this.appSlug,
      evaluators as Array<BaseTestEvaluator<unknown, unknown>>,
    );

    const results = await Promise.allSettled(
      evaluators.map((e) =>
        runEvaluator<TestCaseType, OutputType>({
          appSlug: this.appSlug,
          testCase: args.testCase,
          output: args.output,
          evaluator: e,
        }),
      ),
    );

    const fulfilled: EvaluationWithId[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        fulfilled.push(r.value);
      }
    }
    const { result, reason, score } = makeEvaluatorMaps(fulfilled);

    const startedAt = args.startedAt ?? nowRfc3339();
    const resp = await sendCreateResult({
      appSlug: this.appSlug,
      runId: this.runId,
      environment: this.environment,
      runMessage: this.runMessage,
      startedAt,
      durationMS: args.durationMs,
      status: args.status ?? 'SUCCESS',
      inputRaw,
      outputRaw,
      input: args.testCase as unknown,
      output: args.output as unknown,
      evaluatorIdToResult: result,
      evaluatorIdToReason: reason,
      evaluatorIdToScore: score,
    });

    return resp.executionId;
  }

  public async end(): Promise<void> {
    if (!this.startedAt) {
      throw new Error('Cannot end run before starting it; call start() first.');
    }
    this.endedAt = nowRfc3339();
    this.canCreateHumanReview = true;
  }

  public async createHumanReview(args: {
    name: string;
    assigneeEmailAddresses: string[];
    rubricId?: string;
  }): Promise<void> {
    if (!this.canCreateHumanReview || !this.startedAt || !this.endedAt) {
      throw new Error(
        'Run must be started and ended before creating human review; call start() then end().',
      );
    }

    await sendCreateHumanReviewJob({
      appSlug: this.appSlug,
      runId: this.runId,
      name: args.name,
      assigneeEmailAddresses: args.assigneeEmailAddresses,
      rubricId: args.rubricId,
      startTimestamp: this.startedAt,
      endTimestamp: this.endedAt,
    });
  }
}
