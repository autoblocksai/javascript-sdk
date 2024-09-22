import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';
import {
  sendEndRun,
  sendEvaluation,
  sendStartRun,
  sendTestCaseResult,
  sendCreateHumanReviewJob,
} from './api';
import { Evaluation, HumanReviewField } from './models';
import { makeTestCaseHash } from './util';

/**
 * The TestRun class can be used to manually manage the lifecycle of a test suite.
 *
 * You can also use `runTestSuite` for a more feature rich, managed experience.
 */
export class TestRun<
  // A workaround for making the type parameters required
  // See https://stackoverflow.com/a/76821931
  T = 'A test case type is required.',
  O = 'An output type is required.',
  TestCaseType extends T = T,
  OutputType extends O = O,
> {
  testExternalId: string;
  message?: string;
  runId?: string;
  ended: boolean = false;
  testCaseHash:
    | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
    | ((testCase: TestCaseType) => string);
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];

  constructor(args: {
    message?: string; // Optional message for the run
    testId: string; // Unique identifier for the test
    testCaseHash: // Creates a unique identifier for each test case that is used to identify it across runs. See https://docs.autoblocks.ai/testing/sdk-reference#test-case-hashing
    | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
      | ((testCase: TestCaseType) => string);
    serializeTestCaseForHumanReview?: (
      testCase: TestCaseType,
    ) => HumanReviewField[]; // Optional function to manage how the test case is displayed in the human review UI
    serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[]; // Optional function to manage how the output is displayed in the human review UI
  }) {
    this.message = args.message;
    this.testExternalId = args.testId;
    this.testCaseHash = args.testCaseHash;
    this.serializeTestCaseForHumanReview = args.serializeTestCaseForHumanReview;
    this.serializeOutputForHumanReview = args.serializeOutputForHumanReview;
  }

  /**
   * Starts the run. This must be called before any test case results are added to the run.
   */
  public async start() {
    const runId = await sendStartRun({
      testExternalId: this.testExternalId,
      message: this.message,
    });
    this.runId = runId;
  }

  private async sendTestCaseResult(args: {
    testCase: TestCaseType;
    testCaseHash: string;
    testCaseDurationMs?: number;
    output: OutputType;
    evaluations?: (Evaluation & { id: string })[];
  }) {
    if (!this.runId) {
      throw new Error(
        'You must start the run with `start()` before adding results.',
      );
    }

    let testCaseResultId: string;
    try {
      testCaseResultId = await sendTestCaseResult<TestCaseType, OutputType>({
        testExternalId: this.testExternalId,
        runId: this.runId,
        testCase: args.testCase,
        testCaseOutput: args.output,
        testCaseHash: args.testCaseHash,
        testCaseDurationMs: args.testCaseDurationMs,
        serializeTestCaseForHumanReview: this.serializeTestCaseForHumanReview,
        serializeOutputForHumanReview: this.serializeOutputForHumanReview,
      });
    } catch (e) {
      console.warn(
        `Failed to send test case result to Autoblocks for test case hash ${args.testCaseHash}: ${e}`,
      );
      return;
    }

    if (!args.evaluations) {
      return;
    }

    await Promise.all(
      args.evaluations.map(async (evaluation) => {
        try {
          await sendEvaluation({
            testExternalId: this.testExternalId,
            runId: this.runId!,
            testCaseHash: args.testCaseHash,
            testCaseResultId,
            evaluatorExternalId: evaluation.id,
            evaluation,
          });
        } catch (e) {
          console.warn(
            `Failed to send evaluation to Autoblocks for test case hash ${args.testCaseHash}: ${e}`,
          );
        }
      }),
    );
  }

  /**
   * Adds a test case, it's output, and evaluations to the run.
   */
  public async addResult(args: {
    testCase: TestCaseType;
    testCaseDurationMs?: number;
    output: OutputType;
    // Automated evaluations for the test case
    evaluations?: (Evaluation & { id: string })[];
  }) {
    if (!this.runId) {
      throw new Error(
        'You must start the run with `start()` before adding results.',
      );
    }
    if (this.ended) {
      throw new Error('You cannot add results to an ended run.');
    }
    const testCaseHash = makeTestCaseHash(args.testCase, this.testCaseHash);
    await testCaseRunAsyncLocalStorage.run(
      {
        testCaseHash,
        testId: this.testExternalId,
        runId: this.runId,
        testEvents: [],
      },
      async () => {
        await this.sendTestCaseResult({
          testCase: args.testCase,
          testCaseHash,
          testCaseDurationMs: args.testCaseDurationMs,
          output: args.output,
          evaluations: args.evaluations,
        });
      },
    );
  }

  /**
   * Creates a new human review job that includes the test case results that have been added to the run.
   */
  public async createHumanReviewJob(args: {
    assigneeEmailAddress: string; // Who to assign the job to
    name: string; // Name of the job
  }) {
    if (!this.runId) {
      throw new Error(
        'You must start the run with `start()` before creating a human review job.',
      );
    }

    await sendCreateHumanReviewJob({
      runId: this.runId,
      assigneeEmailAddress: args.assigneeEmailAddress,
      name: args.name,
    });
  }

  /**
   * Ends the run.
   */
  public async end() {
    if (!this.runId) {
      throw new Error(
        'You must start the run with `start()` before ending it.',
      );
    }

    await sendEndRun({
      testExternalId: this.testExternalId,
      runId: this.runId,
    });
    this.ended = true;
  }
}
