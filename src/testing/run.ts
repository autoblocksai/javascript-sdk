import {
  gridSearchAsyncLocalStorage,
  testCaseRunAsyncLocalStorage,
} from '../asyncLocalStorage';
import { AutoblocksEnvVar, isCI, isCLIRunning, readEnv } from '../util';
import {
  BaseTestEvaluator,
  BaseEvaluator,
  type HumanReviewField,
  CreateHumanReviewJob,
} from './models';
import { Semaphore, makeTestCaseHash, makeGridSearchParamCombos } from './util';
import {
  sendCreateHumanReviewJob,
  sendEndRun,
  sendError,
  sendEvaluation,
  sendGitHubComment,
  sendSlackNotification,
  sendStartGridSearchRun,
  sendStartRun,
  sendTestCaseResult,
} from './api';

const DEFAULT_MAX_TEST_CASE_CONCURRENCY = 10;

const testCaseSemaphoreRegistry: Record<string, Semaphore> = {}; // testId -> Semaphore
const evaluatorSemaphoreRegistry: Record<
  string,
  Record<string, Semaphore>
> = {}; // testId -> evaluatorId -> Semaphore

/**
 * AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES environment variable is a JSON string
 * that maps test suite IDs to a list of test case hashes.
 * This is set when a user triggers a test run from the UI so that we only run the given test suite, and,
 * if applicable, only the given test cases.
 */
function testsAndHashesOverridesMap(): Record<string, string[]> | undefined {
  const testsAndHashesRaw = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES,
  );
  if (!testsAndHashesRaw) {
    return undefined;
  }

  return JSON.parse(testsAndHashesRaw);
}

/**
 * AUTOBLOCKS_FILTERS_TEST_SUITES environment variable is a list of test suite IDs that should be run.
 * This is set from the CLI, and we fuzzy match the test suite IDs to determine which test suites to run.
 */
function filtersTestSuitesList(): string[] {
  const filtersTestSuitesRaw = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_FILTERS_TEST_SUITES,
  );
  if (!filtersTestSuitesRaw) {
    return [];
  }

  return JSON.parse(filtersTestSuitesRaw);
}

/**
 * This is suffixed with "Unsafe" because it doesn't handle errors.
 * Its caller will catch and handle all errors.
 */
async function runEvaluatorUnsafe<TestCaseType, OutputType>(args: {
  testId: string;
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  testCaseResultId: string;
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

  if (!evaluation) {
    return;
  }

  await sendEvaluation({
    testExternalId: args.testId,
    runId: args.runId,
    testCaseHash: args.testCaseHash,
    testCaseResultId: args.testCaseResultId,
    evaluatorExternalId: args.evaluator.id,
    evaluation,
  });
}

async function runEvaluator<TestCaseType, OutputType>(args: {
  testId: string;
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  testCaseResultId: string;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<void> {
  try {
    await runEvaluatorUnsafe({
      testId: args.testId,
      runId: args.runId,
      testCase: args.testCase,
      testCaseHash: args.testCaseHash,
      testCaseResultId: args.testCaseResultId,
      output: args.output,
      evaluator: args.evaluator,
    });
  } catch (err) {
    await sendError({
      testId: args.testId,
      runId: args.runId,
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
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  serializeDatasetItemId?: (testCase: TestCaseType) => string;
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];
}): Promise<{ output: OutputType; testCaseResultId: string }> {
  const semaphore = testCaseSemaphoreRegistry[args.testId];
  if (!semaphore) {
    throw new Error(`[${args.testId}] Test case semaphore not found.`);
  }

  const { output, durationMs } = await semaphore.run(async () => {
    const startTime = performance.now();
    const output = await args.fn({ testCase: args.testCase });
    const durationMs = performance.now() - startTime;
    return { output, durationMs };
  });

  const testCaseResultId = await sendTestCaseResult({
    testExternalId: args.testId,
    runId: args.runId,
    testCase: args.testCase,
    testCaseHash: args.testCaseHash,
    testCaseOutput: output,
    testCaseDurationMs: durationMs,
    datasetItemId: args.serializeDatasetItemId?.(args.testCase),
    serializeTestCaseForHumanReview: args.serializeTestCaseForHumanReview,
    serializeOutputForHumanReview: args.serializeOutputForHumanReview,
  });

  return {
    output,
    testCaseResultId,
  };
}

async function runTestCase<TestCaseType, OutputType>(args: {
  testId: string;
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  serializeDatasetItemId?: (testCase: TestCaseType) => string;
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];
}): Promise<void> {
  let output: OutputType | undefined = undefined;
  let testCaseResultId: string;
  try {
    const res = await runTestCaseUnsafe({
      testId: args.testId,
      runId: args.runId,
      testCase: args.testCase,
      testCaseHash: args.testCaseHash,
      fn: args.fn,
      serializeDatasetItemId: args.serializeDatasetItemId,
      serializeTestCaseForHumanReview: args.serializeTestCaseForHumanReview,
      serializeOutputForHumanReview: args.serializeOutputForHumanReview,
    });
    output = res.output;
    testCaseResultId = res.testCaseResultId;
  } catch (err) {
    await sendError({
      testId: args.testId,
      runId: args.runId,
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
          runId: args.runId,
          testCase: args.testCase,
          testCaseHash: args.testCaseHash,
          testCaseResultId,
          output,
          evaluator,
        }),
      ),
    );
  } catch (err) {
    await sendError({
      testId: args.testId,
      runId: args.runId,
      testCaseHash: args.testCaseHash,
      evaluatorId: null,
      error: err,
    });
  }
}

async function runTestSuiteForGridCombo<TestCaseType, OutputType>(args: {
  testId: string;
  testCases: TestCaseType[];
  testCaseHash:
    | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
    | ((testCase: TestCaseType) => string);
  evaluators?: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  serializeDatasetItemId?: (testCase: TestCaseType) => string;
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];
  gridSearchRunGroupId?: string;
  gridSearchParamsCombo?: Record<string, string>;
  humanReviewJob?: CreateHumanReviewJob;
}): Promise<void> {
  if (!isCLIRunning()) {
    console.log(`Running test suite '${args.testId}'`);
    if (args.gridSearchParamsCombo) {
      console.log(
        `Grid search params: ${JSON.stringify(args.gridSearchParamsCombo, null, 2)}`,
      );
    }
  }
  let runId: string;
  try {
    runId = await sendStartRun({
      testExternalId: args.testId,
      gridSearchRunGroupId: args.gridSearchRunGroupId,
      gridSearchParamsCombo: args.gridSearchParamsCombo,
      message: readEnv(AutoblocksEnvVar.AUTOBLOCKS_TEST_RUN_MESSAGE),
    });
  } catch (err) {
    // Don't allow the run to continue if /start failed, since all subsequent
    // requests will fail if the CLI was not able to start the run.
    // Also note we don't need to sendError here, since the CLI will
    // have reported the HTTP error itself.
    if (!isCLIRunning()) {
      await sendError({
        testId: args.testId,
        testCaseHash: null,
        evaluatorId: null,
        error: err,
      });
    }
    return;
  }

  try {
    // Run each test case and set async local storage appropriately
    await Promise.allSettled(
      args.testCases.map(async (testCase) => {
        const testCaseHash = makeTestCaseHash(testCase, args.testCaseHash);
        // testCaseRunAsyncLocalStorage is only used internally in our SDK
        return testCaseRunAsyncLocalStorage.run(
          {
            testCaseHash,
            testId: args.testId,
            runId,
            testEvents: [],
            revisionUsage: [],
          },
          async () => {
            // gridSearchAsyncLocalStorage is exported and used in the consuming app
            return gridSearchAsyncLocalStorage.run(
              args.gridSearchParamsCombo,
              async () => {
                return runTestCase({
                  testId: args.testId,
                  runId,
                  testCase,
                  testCaseHash,
                  evaluators: args.evaluators || [],
                  fn: args.fn,
                  serializeDatasetItemId: args.serializeDatasetItemId,
                  serializeTestCaseForHumanReview:
                    args.serializeTestCaseForHumanReview,
                  serializeOutputForHumanReview:
                    args.serializeOutputForHumanReview,
                });
              },
            );
          },
        );
      }),
    );
  } catch (err) {
    await sendError({
      testId: args.testId,
      runId,
      testCaseHash: null,
      evaluatorId: null,
      error: err,
    });
  }

  await sendEndRun({
    testExternalId: args.testId,
    runId,
  });

  if (args.humanReviewJob) {
    const assigneeEmailAddresses = Array.isArray(
      args.humanReviewJob.assigneeEmailAddress,
    )
      ? args.humanReviewJob.assigneeEmailAddress
      : [args.humanReviewJob.assigneeEmailAddress];
    const results = await Promise.allSettled(
      assigneeEmailAddresses.map((assigneeEmailAddress) =>
        sendCreateHumanReviewJob({
          runId,
          name: args.humanReviewJob!.name,
          assigneeEmailAddress,
        }),
      ),
    );
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to create human review job: ${result.reason}`);
      }
    });
  }
  await Promise.allSettled([
    sendSlackNotification({ runId }),
    sendGitHubComment(),
  ]);

  if (!isCLIRunning()) {
    console.log(`Finished running test suite '${args.testId}'.`);
    if (!isCI()) {
      console.log(
        'View the results at https://app.autoblocks.ai/testing/local/test/${args.id}',
      );
    }
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
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  evaluators?: BaseTestEvaluator<TestCaseType, OutputType>[];
  // How many test cases to run concurrently
  maxTestCaseConcurrency?: number;
  serializeDatasetItemId?: (testCase: TestCaseType) => string; // Get the dataset item id from the test case
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];
  gridSearchParams?: Record<string, string[]>;
  humanReviewJob?: CreateHumanReviewJob;
}): Promise<void> {
  if (!isCLIRunning()) {
    console.log(`Running test suite '${args.id}'`);
    const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
  }
  // This will be set if the user passed filters to the CLI
  // we do a substring match to allow for fuzzy matching
  // For example a filter of "ell" would match a test suite of "hello"
  const filtersTestSuites = filtersTestSuitesList();
  if (
    filtersTestSuites.length &&
    !filtersTestSuites.some((filterId) =>
      args.id.toLowerCase().includes(filterId.toLowerCase()),
    )
  ) {
    console.log(
      `Skipping test suite '${args.id}' because it is not in the list of test suites to run.`,
    );
    return;
  }

  // This will be set if a user has triggered a run from the UI for a particular test suite.
  // If it is not this test suite, then we skip it.
  let filteredTestCases = args.testCases;
  const testsAndHashes = testsAndHashesOverridesMap();
  if (testsAndHashes !== undefined) {
    if (testsAndHashes[args.id] === undefined) {
      console.log(
        `Skipping test suite '${args.id}' because it is not in the list of test suites to run.`,
      );
      return;
    }
    // If the value for this test suite is non-empty, then it is a list of test case
    // hashes to run. We filter the test cases to only run those.
    const hashesToRun = new Set(testsAndHashes[args.id] || []);
    if (hashesToRun.size > 0) {
      filteredTestCases = args.testCases.filter((tc) =>
        hashesToRun.has(makeTestCaseHash(tc, args.testCaseHash)),
      );
    }
  }

  try {
    if (!filteredTestCases.length) {
      throw new Error(`[${args.id}] No test cases provided.`);
    }

    // Check for unique test case hashes
    const testCaseHashes = new Set<string>();
    filteredTestCases.forEach((testCase) => {
      const hash = makeTestCaseHash(testCase, args.testCaseHash);
      if (testCaseHashes.has(hash)) {
        throw new Error(
          `[${args.id}] Duplicate test case hash: '${hash}'. See https://docs.autoblocks.ai/testing/sdk-reference#test-case-hashing`,
        );
      }
      testCaseHashes.add(hash);
    });

    // Check for unique evaluator ids
    const evaluatorIds = new Set<string>();
    args.evaluators?.forEach((evaluator) => {
      if (
        !(evaluator instanceof BaseEvaluator) &&
        !(evaluator instanceof BaseTestEvaluator)
      ) {
        throw new Error(
          `[${args.id}] Evaluators must be instances of ${BaseTestEvaluator.name} or ${BaseEvaluator.name}.`,
        );
      }
      if (evaluatorIds.has(evaluator.id)) {
        throw new Error(
          `[${args.id}] Duplicate evaluator id: '${evaluator.id}'. Each evaluator id must be unique.`,
        );
      }
      evaluatorIds.add(evaluator.id);
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

  testCaseSemaphoreRegistry[args.id] = new Semaphore(
    args.maxTestCaseConcurrency ?? DEFAULT_MAX_TEST_CASE_CONCURRENCY,
  );
  evaluatorSemaphoreRegistry[args.id] = Object.fromEntries(
    (args.evaluators || []).map((evaluator) => [
      evaluator.id,
      new Semaphore(evaluator.maxConcurrency),
    ]),
  );

  if (args.gridSearchParams === undefined) {
    try {
      await runTestSuiteForGridCombo({
        testId: args.id,
        testCases: filteredTestCases,
        testCaseHash: args.testCaseHash,
        evaluators: args.evaluators,
        fn: args.fn,
        serializeDatasetItemId: args.serializeDatasetItemId,
        serializeTestCaseForHumanReview: args.serializeTestCaseForHumanReview,
        serializeOutputForHumanReview: args.serializeOutputForHumanReview,
        humanReviewJob: args.humanReviewJob,
      });
    } catch (err) {
      await sendError({
        testId: args.id,
        testCaseHash: null,
        evaluatorId: null,
        error: err,
      });
    }
    return;
  }

  let gridSearchRunGroupId: string;
  try {
    gridSearchRunGroupId = await sendStartGridSearchRun({
      gridSearchParams: args.gridSearchParams,
    });
  } catch (err) {
    // Don't allow the run to continue if /grids failed, since all subsequent
    // requests will fail if the CLI was not able to create the grid.
    // Also note we don't need to send_error here, since the CLI will
    // have reported the HTTP error itself.
    if (!isCLIRunning()) {
      await sendError({
        testId: args.id,
        testCaseHash: null,
        evaluatorId: null,
        error: err,
      });
    }
    return;
  }

  try {
    await Promise.all(
      makeGridSearchParamCombos(args.gridSearchParams).map((gridParamsCombo) =>
        runTestSuiteForGridCombo({
          testId: args.id,
          testCases: filteredTestCases,
          testCaseHash: args.testCaseHash,
          evaluators: args.evaluators,
          fn: args.fn,
          serializeDatasetItemId: args.serializeDatasetItemId,
          serializeTestCaseForHumanReview: args.serializeTestCaseForHumanReview,
          serializeOutputForHumanReview: args.serializeOutputForHumanReview,
          gridSearchRunGroupId,
          gridSearchParamsCombo: gridParamsCombo,
          humanReviewJob: args.humanReviewJob,
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
}
