import {
  type BaseTestCaseType,
  BaseTestEvaluator,
  type Evaluation,
} from './models';
import { AutoblocksEnvVar, readEnv } from '../util';
import crypto from 'crypto';

const DEFAULT_MAX_TEST_CASE_CONCURRENCY = 10;
const DEFAULT_MAX_EVALUATOR_CONCURRENCY = 5;

const client = {
  post: async (path: string, data: unknown): Promise<void> => {
    const serverAddress = readEnv(
      AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS,
    );
    if (!serverAddress) {
      throw new Error(
        `\n
Autoblocks tests must be run within the context of the testing CLI.
Make sure you are running your test command with:
$ npx autoblocks testing exec -- <your test command>
`,
      );
    }

    try {
      console.log(`POST ${serverAddress}${path}`, data);
      await fetch(serverAddress + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error(err);
      // Ignore, any errors for these requests are displayed by the CLI server
    }
  },
};

function makeTestCaseHash<TestCaseType extends BaseTestCaseType>(
  testCase: TestCaseType,
  testCaseHash:
    | (keyof TestCaseType & string)
    | ((testCase: TestCaseType) => string),
): string {
  if (typeof testCaseHash === 'string') {
    return crypto
      .createHash('md5')
      .update(`${testCase[testCaseHash]}`)
      .digest('hex');
  } else {
    return testCaseHash(testCase);
  }
}

async function sendError(args: {
  testId: string;
  testCaseHash: string | null;
  evaluatorId: string | null;
  error: unknown;
}): Promise<void> {
  if (args.error instanceof Error) {
    await client.post('/errors', {
      testExternalId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorExternalId: args.evaluatorId,
      error: {
        name: args.error.name,
        message: args.error.message,
        stacktrace: args.error.stack,
      },
    });
  }
}

async function gatherWithMaxConcurrency(args: {
  maxConcurrency: number;
  tasks: (() => Promise<void>)[];
}): Promise<void> {
  const promises: {
    id: string;
    promise: Promise<{ id: string }>;
  }[] = [];

  for (const task of args.tasks) {
    const id = crypto.randomUUID();
    const promise: Promise<{ id: string }> = (async () => {
      try {
        await Promise.resolve(task());
      } catch (err) {
        console.error(err);
        // Ignore, errors are handled in the tasks themselves
      }
      return { id };
    })();

    promises.push({
      id,
      promise,
    });

    if (promises.length >= args.maxConcurrency) {
      // Remove the first promise that resolves
      await Promise.race(promises.map((p) => p.promise)).then((winner) => {
        const toRemove = promises.find((p) => p.id === winner.id);
        if (toRemove) {
          promises.splice(promises.indexOf(toRemove), 1);
        }
      });
    }
  }

  await Promise.allSettled(promises.map((p) => p.promise)); // Ensure all remaining promises are finished
}

async function evaluateOutput<
  TestCaseType extends BaseTestCaseType,
  OutputType,
>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<void> {
  let evaluation: Evaluation | undefined = undefined;

  try {
    evaluation = await args.evaluator.evaluateTestCase(
      args.testCase,
      args.output,
    );
  } catch (err) {
    await sendError({
      testId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorId: args.evaluator.id,
      error: err,
    });
  }

  if (evaluation === undefined) return;

  await client.post('/evals', {
    testExternalId: args.testId,
    testCaseHash: args.testCaseHash,
    evaluatorExternalId: args.evaluator.id,
    score: evaluation.score,
    threshold: evaluation.threshold,
  });
}

async function runTestCase<
  TestCaseType extends BaseTestCaseType,
  OutputType,
>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (testCase: TestCaseType) => OutputType | Promise<OutputType>;
  maxEvaluatorConcurrency: number;
}): Promise<void> {
  let output: OutputType | undefined = undefined;

  try {
    output = await args.fn(args.testCase);
  } catch (err) {
    await sendError({
      testId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorId: null,
      error: err,
    });
  }

  if (output === undefined) return;

  await client.post('/results', {
    testExternalId: args.testId,
    testCaseHash: args.testCaseHash,
    testCaseBody: JSON.stringify(args.testCase),
    testCaseOutput: output === 'string' ? output : JSON.stringify(output),
  });

  try {
    await gatherWithMaxConcurrency({
      maxConcurrency: args.maxEvaluatorConcurrency,
      tasks: args.evaluators.map(
        (evaluator) => () =>
          evaluateOutput({
            testId: args.testId,
            testCase: args.testCase,
            testCaseHash: args.testCaseHash,
            output,
            evaluator,
          }),
      ),
    });
  } catch (err) {
    await sendError({
      testId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorId: null,
      error: err,
    });
  }
}

export async function runTestSuite<
  TestCaseType extends BaseTestCaseType,
  OutputType,
>(args: {
  id: string;
  testCases: TestCaseType[];
  testCaseHash:
    | (keyof TestCaseType & string)
    | ((testCase: TestCaseType) => string);
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (testCase: TestCaseType) => OutputType | Promise<OutputType>;
  // How many test cases to run concurrently
  maxTestCaseConcurrency?: number;
  // How many evaluators to run concurrently on the result of a test case
  maxEvaluatorConcurrency?: number;
}): Promise<void> {
  try {
    if (!args.testCases.length) {
      throw new Error(`[${args.id}] No test cases provided.`);
    }
    args.evaluators.forEach((evaluator) => {
      if (!(evaluator instanceof BaseTestEvaluator)) {
        throw new Error(
          `[${args.id}] Evaluator ${evaluator} does not implement ${BaseTestEvaluator.name}.`,
        );
      }
    });
  } catch (err) {
    await sendError({
      testId: args.id,
      testCaseHash: null,
      evaluatorId: null,
      error: err,
    });
    return;
  }

  const maxTestCaseConcurrency =
    args.maxTestCaseConcurrency ?? DEFAULT_MAX_TEST_CASE_CONCURRENCY;
  const maxEvaluatorConcurrency =
    args.maxEvaluatorConcurrency ?? DEFAULT_MAX_EVALUATOR_CONCURRENCY;

  await client.post('/start', { testExternalId: args.id });

  try {
    await gatherWithMaxConcurrency({
      maxConcurrency: maxTestCaseConcurrency,
      tasks: args.testCases.map(
        (testCase) => () =>
          runTestCase({
            testId: args.id,
            testCase,
            testCaseHash: makeTestCaseHash(testCase, args.testCaseHash),
            evaluators: args.evaluators,
            fn: args.fn,
            maxEvaluatorConcurrency,
          }),
      ),
    });
  } catch (err) {
    await sendError({
      testId: args.id,
      testCaseHash: null,
      evaluatorId: null,
      error: err,
    });
  }

  await client.post('/end', { testExternalId: args.id });
}
