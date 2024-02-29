import { BaseTestEvaluator } from './models';
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
      await fetch(serverAddress + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      // Ignore, any errors for these requests are displayed by the CLI server
    }
  },
};

function isPrimitive(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function makeTestCaseHash<TestCaseType>(
  testCase: TestCaseType,
  testCaseHash:
    | (keyof TestCaseType & string)[]
    | ((testCase: TestCaseType) => string),
): string {
  if (Array.isArray(testCaseHash)) {
    const concatenated = testCaseHash
      .map((key) => JSON.stringify(testCase[key]))
      .join('');
    return crypto.createHash('md5').update(concatenated).digest('hex');
  } else {
    return testCaseHash(testCase);
  }
}

async function gatherWithMaxConcurrency(args: {
  maxConcurrency: number;
  tasks: (() => Promise<void>)[];
}): Promise<void> {
  const promises = new Map<string, Promise<{ id: string }>>();

  for (const task of args.tasks) {
    const id = crypto.randomUUID();
    const promise: Promise<{ id: string }> = (async () => {
      try {
        await Promise.resolve(task());
      } catch (err) {
        // Ignore, errors are handled in the tasks themselves
      }
      return { id };
    })();

    promises.set(id, promise);

    if (promises.size >= args.maxConcurrency) {
      // Remove the first promise that resolves
      await Promise.race(promises.values()).then((winner) => {
        promises.delete(winner.id);
      });
    }
  }

  await Promise.allSettled(promises.values()); // Ensure all remaining promises are finished
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

async function evaluateOutput<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<void> {
  try {
    const evaluation = await args.evaluator.evaluateTestCase({
      testCase: args.testCase,
      output: args.output,
    });
    await client.post('/evals', {
      testExternalId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorExternalId: args.evaluator.id,
      score: evaluation.score,
      threshold: evaluation.threshold,
    });
  } catch (err) {
    await sendError({
      testId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorId: args.evaluator.id,
      error: err,
    });
  }
}

async function runTestCase<TestCaseType, OutputType>(args: {
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
    testCaseBody: args.testCase,
    testCaseOutput: isPrimitive(output) ? output : JSON.stringify(output),
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
  // A workaround for making the type parameters required
  // See https://stackoverflow.com/a/76821931
  T = 'A test case type is required.',
  O = 'An output type is required.',
  TestCaseType extends T = T,
  OutputType extends O = O,
>(args: {
  id: string;
  testCases: TestCaseType[];
  testCaseHash: // This type requires that the test case hash array has at least one element
  | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
    // Or, the user can define their own function to compute the hash
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
          `[${args.id}] Evaluators must be instances of ${BaseTestEvaluator.name}.`,
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
