import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';
import { AutoblocksEnvVar, readEnv } from '../util';
import { BaseTestEvaluator, BaseEvaluator } from './models';
import { Semaphore, makeTestCaseHash, isPrimitive } from './util';
import { flush } from '../tracer';

const DEFAULT_MAX_TEST_CASE_CONCURRENCY = 10;

const testCaseSemaphoreRegistry: Record<string, Semaphore> = {}; // testId -> Semaphore
const evaluatorSemaphoreRegistry: Record<
  string,
  Record<string, Semaphore>
> = {}; // testId -> evaluatorId -> Semaphore

const client = {
  post: async (args: {
    path: string;
    body: unknown;
  }): Promise<Pick<Response, 'ok'>> => {
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
      return await fetch(serverAddress + args.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.body),
      });
    } catch {
      // Ignore, any errors for these requests are displayed by the CLI server
      return {
        ok: false,
      };
    }
  },
};

async function sendError(args: {
  testId: string;
  testCaseHash: string | null;
  evaluatorId: string | null;
  error: unknown;
}): Promise<void> {
  const { errorName, errorMessage, errorStack } =
    args.error instanceof Error
      ? {
          errorName: args.error.name,
          errorMessage: args.error.message,
          errorStack: args.error.stack,
        }
      : {
          errorName: 'UnknownError',
          errorMessage: `${args.error}`,
          errorStack: '',
        };

  await client.post({
    path: '/errors',
    body: {
      testExternalId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorExternalId: args.evaluatorId,
      error: {
        name: errorName,
        message: errorMessage,
        stacktrace: errorStack,
      },
    },
  });
}

/**
 * This is suffixed with "Unsafe" because it doesn't handle errors.
 * Its caller will catch and handle all errors.
 */
async function runEvaluatorUnsafe<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<void> {
  const semaphore = evaluatorSemaphoreRegistry[args.testId][args.evaluator.id];
  if (!semaphore) {
    throw new Error(
      `[${args.testId}] Evaluator semaphore not found for '${args.evaluator.id}'.`,
    );
  }

  const evaluation = await semaphore.run(async () => {
    return await args.evaluator.evaluateTestCase({
      testCase: args.testCase,
      output: args.output,
    });
  });

  await client.post({
    path: '/evals',
    body: {
      testExternalId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorExternalId: args.evaluator.id,
      score: evaluation.score,
      threshold: evaluation.threshold,
      metadata: evaluation.metadata,
    },
  });
}

async function runEvaluator<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<void> {
  try {
    await runEvaluatorUnsafe({
      testId: args.testId,
      testCase: args.testCase,
      testCaseHash: args.testCaseHash,
      output: args.output,
      evaluator: args.evaluator,
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

/**
 * This is suffixed with "Unsafe" because it doesn't handle errors.
 * Its caller will catch and handle all errors.
 */
async function runTestCaseUnsafe<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
}): Promise<OutputType> {
  const semaphore = testCaseSemaphoreRegistry[args.testId];
  if (!semaphore) {
    throw new Error(`[${args.testId}] Test case semaphore not found.`);
  }

  const output = await testCaseRunAsyncLocalStorage.run(
    {
      testCaseHash: args.testCaseHash,
      testId: args.testId,
    },
    async () => {
      return await semaphore.run(async () => {
        return await args.fn({ testCase: args.testCase });
      });
    },
  );

  // Flush the logs before we send the result, since the CLI
  // accumulates the events and sends them as a batch along
  // with the result.
  await flush();

  await client.post({
    path: '/results',
    body: {
      testExternalId: args.testId,
      testCaseHash: args.testCaseHash,
      testCaseBody: args.testCase,
      testCaseOutput: isPrimitive(output) ? output : JSON.stringify(output),
    },
  });

  return output;
}

async function runTestCase<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
}): Promise<void> {
  let output: OutputType | undefined = undefined;

  try {
    output = await runTestCaseUnsafe({
      testId: args.testId,
      testCase: args.testCase,
      testCaseHash: args.testCaseHash,
      fn: args.fn,
    });
  } catch (err) {
    await sendError({
      testId: args.testId,
      testCaseHash: args.testCaseHash,
      evaluatorId: null,
      error: err,
    });
    return;
  }

  if (output === undefined) return;

  try {
    await Promise.allSettled(
      args.evaluators.map((evaluator) =>
        runEvaluator({
          testId: args.testId,
          testCase: args.testCase,
          testCaseHash: args.testCaseHash,
          output,
          evaluator,
        }),
      ),
    );
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
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  // How many test cases to run concurrently
  maxTestCaseConcurrency?: number;
  // Deprecated arguments, but left for backwards compatibility
  maxEvaluatorConcurrency?: number;
}): Promise<void> {
  try {
    if (!args.testCases.length) {
      throw new Error(`[${args.id}] No test cases provided.`);
    }
    args.evaluators.forEach((evaluator) => {
      if (evaluator instanceof BaseEvaluator) {
        return;
      }
      if (evaluator instanceof BaseTestEvaluator) {
        return;
      }
      throw new Error(
        `[${args.id}] Evaluators must be instances of ${BaseTestEvaluator.name} or ${BaseEvaluator.name}.`,
      );
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

  if (args.maxEvaluatorConcurrency !== undefined) {
    console.warn(
      '`maxEvaluatorConcurrency` is deprecated and will be removed in a future release.\n' +
        'Its value is being ignored.\n' +
        'Set the `maxConcurrency` attribute on the evaluator class instead.\n' +
        'See https://docs.autoblocks.ai/testing/sdks for more information.',
    );
  }

  testCaseSemaphoreRegistry[args.id] = new Semaphore(
    args.maxTestCaseConcurrency ?? DEFAULT_MAX_TEST_CASE_CONCURRENCY,
  );
  evaluatorSemaphoreRegistry[args.id] = Object.fromEntries(
    args.evaluators.map((evaluator) => [
      evaluator.id,
      new Semaphore(evaluator.maxConcurrency),
    ]),
  );

  const startResp = await client.post({
    path: '/start',
    body: { testExternalId: args.id },
  });
  if (!startResp.ok) {
    // Don't allow the run to continue if /start failed, since all subsequent
    // requests will fail if the CLI was not able to start the run.
    // Also note we don't need to sendError here, since the CLI will
    // have reported the HTTP error itself.
    return;
  }

  try {
    await Promise.allSettled(
      args.testCases.map((testCase) =>
        runTestCase({
          testId: args.id,
          testCase,
          testCaseHash: makeTestCaseHash(testCase, args.testCaseHash),
          evaluators: args.evaluators,
          fn: args.fn,
        }),
      ),
    );
  } catch (err) {
    await sendError({
      testId: args.id,
      testCaseHash: null,
      evaluatorId: null,
      error: err,
    });
  }

  await client.post({ path: '/end', body: { testExternalId: args.id } });
}
