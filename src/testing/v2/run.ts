import { createId } from '@paralleldrive/cuid2';
import {
  gridSearchAsyncLocalStorage,
  testCaseRunAsyncLocalStorage,
} from '../../asyncLocalStorage';
import {
  AutoblocksEnvVar,
  readEnv,
  parseAutoblocksOverrides,
} from '../../util';
import {
  BaseTestEvaluator,
  BaseEvaluator,
  CreateHumanReviewJob,
  Evaluation,
} from '../models';
import {
  Semaphore,
  makeTestCaseHash,
  makeGridSearchParamCombos,
} from '../util';
import { trace, context, propagation } from '@opentelemetry/api';
import { SpanAttributesEnum, serialize } from '../../tracer/util';
import { sendCreateHumanReviewJob } from './api';

const DEFAULT_MAX_TEST_CASE_CONCURRENCY = 10;

const testCaseSemaphoreRegistry: Record<string, Semaphore> = {}; // testId -> Semaphore
const evaluatorSemaphoreRegistry: Record<
  string,
  Record<string, Semaphore>
> = {}; // testId -> evaluatorId -> Semaphore

/**
 * Gets the test run message from overrides, checking unified format first,
 * then falling back to legacy format.
 */
function getTestRunMessage(): string | undefined {
  // Try new unified format first
  const overrides = parseAutoblocksOverrides();

  if (overrides.testRunMessage) {
    return overrides.testRunMessage;
  }

  // Fallback to legacy format
  return readEnv(AutoblocksEnvVar.AUTOBLOCKS_TEST_RUN_MESSAGE);
}

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
  testCase: TestCaseType;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<Evaluation | undefined> {
  const semaphore = evaluatorSemaphoreRegistry[args.testId][args.evaluator.id];
  if (!semaphore) {
    throw new Error(
      `[${args.testId}] Evaluator semaphore not found for '${args.evaluator.id}'.`,
    );
  }

  return await semaphore.run(async () => {
    return await args.evaluator.evaluateTestCase({
      testCase: args.testCase,
      output: args.output,
    });
  });
}

async function runEvaluator<TestCaseType, OutputType>(args: {
  testId: string;
  testCase: TestCaseType;
  output: OutputType;
  evaluator: BaseTestEvaluator<TestCaseType, OutputType>;
}): Promise<(Evaluation & { id: string }) | undefined> {
  try {
    const evaluation = await runEvaluatorUnsafe({
      testId: args.testId,
      testCase: args.testCase,
      output: args.output,
      evaluator: args.evaluator,
    });
    if (evaluation === undefined) {
      return undefined;
    }
    return {
      id: args.evaluator.id,
      ...evaluation,
    };
  } catch (err) {
    console.log(err);
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
  appSlug: string;
  environment: string;
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
}): Promise<{ output: OutputType }> {
  const semaphore = testCaseSemaphoreRegistry[args.testId];
  if (!semaphore) {
    throw new Error(`[${args.testId}] Test case semaphore not found.`);
  }

  return await semaphore.run<{ output: OutputType }>(async () => {
    const executionId = createId();
    const activeContext = propagation.setBaggage(
      context.active(),
      propagation.createBaggage({
        [SpanAttributesEnum.EXECUTION_ID]: {
          value: executionId,
        },
        [SpanAttributesEnum.ENVIRONMENT]: {
          value: args.environment,
        },
        [SpanAttributesEnum.APP_SLUG]: {
          value: args.appSlug,
        },
      }),
    );
    const tracer = trace.getTracer('AUTOBLOCKS_TRACER');
    return context.with(activeContext, () =>
      tracer.startActiveSpan(args.appSlug, {}, activeContext, async (span) => {
        span.setAttributes({
          [SpanAttributesEnum.IS_ROOT]: true,
          [SpanAttributesEnum.EXECUTION_ID]: executionId,
          [SpanAttributesEnum.ENVIRONMENT]: args.environment,
          [SpanAttributesEnum.APP_SLUG]: args.appSlug,
          [SpanAttributesEnum.INPUT]: serialize(args.testCase),
        });
        const res = await args.fn({ testCase: args.testCase });
        if (res !== undefined) {
          try {
            const results = await Promise.allSettled(
              args.evaluators.map((evaluator) =>
                runEvaluator({
                  testId: args.testId,
                  testCase: args.testCase,
                  output: res,
                  evaluator,
                }),
              ),
            );
            const passedResults = results
              .filter((result) => result.status === 'fulfilled')
              .map((result) => result.value);
            span.setAttributes({
              [SpanAttributesEnum.EVALUATORS]: serialize(passedResults),
            });
          } catch (err) {
            console.log(err);
          }
        }
        if (res instanceof Promise) {
          return res.then((r) => {
            try {
              span.setAttributes({
                [SpanAttributesEnum.OUTPUT]: serialize(r),
              });
            } finally {
              span.end();
            }
            return r;
          });
        }
        try {
          span.setAttributes({
            [SpanAttributesEnum.OUTPUT]: serialize(res),
          });
        } finally {
          span.end();
        }
        return { output: res };
      }),
    );
  });
}

async function runTestCase<TestCaseType, OutputType>(args: {
  testId: string;
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  appSlug: string;
  environment: string;
  evaluators: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
}): Promise<void> {
  let output: OutputType | undefined = undefined;
  try {
    const res = await runTestCaseUnsafe({
      testId: args.testId,
      runId: args.runId,
      testCase: args.testCase,
      testCaseHash: args.testCaseHash,
      appSlug: args.appSlug,
      environment: args.environment,
      evaluators: args.evaluators,
      fn: args.fn,
    });
    output = res.output;
  } catch (err) {
    console.log(err);
    return;
  }

  if (output === undefined) return;
}

async function runTestSuiteForGridCombo<TestCaseType, OutputType>(args: {
  testId: string;
  testCases: TestCaseType[];
  testCaseHash:
    | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
    | ((testCase: TestCaseType) => string);
  evaluators?: BaseTestEvaluator<TestCaseType, OutputType>[];
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  appSlug: string;
  environment: string;
  gridSearchRunGroupId?: string;
  gridSearchParamsCombo?: Record<string, string>;
  humanReviewJob?: CreateHumanReviewJob;
}): Promise<void> {
  if (args.gridSearchParamsCombo) {
    console.log(
      `Grid search params: ${JSON.stringify(args.gridSearchParamsCombo, null, 2)}`,
    );
  }
  const runId = createId();
  const startTimestamp = new Date().toISOString();

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
            runMessage: getTestRunMessage(),
            buildId: readEnv(AutoblocksEnvVar.AUTOBLOCKS_CI_TEST_RUN_BUILD_ID),
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
                  appSlug: args.appSlug,
                  environment: args.environment,
                  fn: args.fn,
                });
              },
            );
          },
        );
      }),
    );
  } catch (err) {
    console.log(err);
  }

  if (args.humanReviewJob) {
    const assigneeEmailAddresses = Array.isArray(
      args.humanReviewJob.assigneeEmailAddress,
    )
      ? args.humanReviewJob.assigneeEmailAddress
      : [args.humanReviewJob.assigneeEmailAddress];
    try {
      await sendCreateHumanReviewJob({
        appSlug: args.appSlug,
        runId,
        name: args.humanReviewJob!.name,
        assigneeEmailAddresses,
        rubricId: args.humanReviewJob.rubricId,
        startTimestamp,
        endTimestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.log(`Failed to create human review job: ${err}`);
    }
  }

  console.log(`Finished running test suite '${args.testId}'.`);
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
  appSlug: string;
  testCases: TestCaseType[];
  testCaseHash: // This type requires that the test case hash array has at least one element
  | [keyof TestCaseType & string, ...(keyof TestCaseType & string)[]]
    // Or, the user can define their own function to compute the hash
    | ((testCase: TestCaseType) => string);
  fn: (args: { testCase: TestCaseType }) => OutputType | Promise<OutputType>;
  evaluators?: BaseTestEvaluator<TestCaseType, OutputType>[];
  // How many test cases to run concurrently
  maxTestCaseConcurrency?: number;
  gridSearchParams?: Record<string, string[]>;
  humanReviewJob?: CreateHumanReviewJob;
  environment?: string;
}): Promise<void> {
  console.log(`Running test suite '${args.id}'`);
  const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);
  if (!apiKey) {
    throw new Error(
      `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY}' environment variable.`,
    );
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
    console.log(err);
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
  const environment = args.environment ?? 'test';

  if (args.gridSearchParams === undefined) {
    try {
      await runTestSuiteForGridCombo({
        testId: args.id,
        testCases: filteredTestCases,
        testCaseHash: args.testCaseHash,
        evaluators: args.evaluators,
        fn: args.fn,
        humanReviewJob: args.humanReviewJob,
        appSlug: args.appSlug,
        environment,
      });
    } catch (err) {
      console.log(err);
    }
    return;
  }

  const gridSearchRunGroupId = createId();

  try {
    await Promise.all(
      makeGridSearchParamCombos(args.gridSearchParams).map((gridParamsCombo) =>
        runTestSuiteForGridCombo({
          testId: args.id,
          testCases: filteredTestCases,
          testCaseHash: args.testCaseHash,
          evaluators: args.evaluators,
          fn: args.fn,
          gridSearchRunGroupId,
          gridSearchParamsCombo: gridParamsCombo,
          humanReviewJob: args.humanReviewJob,
          appSlug: args.appSlug,
          environment,
        }),
      ),
    );
  } catch (err) {
    console.log(err);
  }
}
