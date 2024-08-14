import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';
import {
  API_ENDPOINT,
  AutoblocksEnvVar,
  readEnv,
  isCLIRunning,
  isCI,
} from '../util';
import { Evaluation, HumanReviewField } from './models';
import { determineIfEvaluationPassed, isPrimitive } from './util';

const client = {
  postToCLI: async <T>(args: {
    path: string;
    body: unknown;
  }): Promise<{ ok: boolean; data?: T }> => {
    const serverAddress = readEnv(
      AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS,
    );
    if (!serverAddress) {
      throw new Error('CLI server address is not set.');
    }

    try {
      const resp = await fetch(serverAddress + args.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.body),
      });
      return {
        ok: resp.ok,
        data: await resp.json(),
      };
    } catch {
      // Ignore, any errors for these requests are displayed by the CLI server
      return {
        ok: false,
      };
    }
  },
  postToAPI: async <T>(args: {
    path: string;
    body: unknown;
  }): Promise<{ data: T }> => {
    const subPath = isCI() ? '/testing/ci' : '/testing/local';
    const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
    const url = `${API_ENDPOINT}${subPath}${args.path}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(args.body),
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: POST ${url} "${resp.status} ${resp.statusText}"`,
      );
    }
    return {
      data: await resp.json(),
    };
  },
};

export async function sendError(args: {
  testId: string;
  runId?: string;
  testCaseHash: string | null;
  evaluatorId: string | null;
  error: unknown;
}): Promise<void> {
  if (isCLIRunning()) {
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
    await client.postToCLI({
      path: '/errors',
      body: {
        testExternalId: args.testId,
        runId: args.runId,
        testCaseHash: args.testCaseHash,
        evaluatorExternalId: args.evaluatorId,
        error: {
          name: errorName,
          message: errorMessage,
          stacktrace: errorStack,
        },
      },
    });
  } else {
    console.error(args.error);
  }
}

export async function sendStartGridSearchRun(args: {
  gridSearchParams: Record<string, string[]>;
}): Promise<string> {
  if (isCLIRunning()) {
    const gridResp = await client.postToCLI<{ id: string }>({
      path: '/grids',
      body: {
        gridSearchParams: args.gridSearchParams,
      },
    });
    if (!gridResp.ok || !gridResp.data) {
      throw new Error(
        `Failed to start grid search run: ${JSON.stringify(gridResp)}`,
      );
    }

    return gridResp.data.id;
  }
  const gridResp = await client.postToAPI<{ id: string }>({
    path: '/grids',
    body: {
      gridSearchParams: args.gridSearchParams,
    },
  });
  return gridResp.data.id;
}

export async function sendStartRun(args: {
  testExternalId: string;
  gridSearchRunGroupId?: string;
  gridSearchParamsCombo?: Record<string, string>;
}): Promise<string> {
  if (isCLIRunning()) {
    const startResp = await client.postToCLI<{ id: string }>({
      path: '/start',
      body: {
        testExternalId: args.testExternalId,
        gridSearchRunGroupId: args.gridSearchRunGroupId,
        gridSearchParamsCombo: args.gridSearchParamsCombo,
      },
    });

    if (!startResp.ok || !startResp.data) {
      throw new Error(
        `Failed to start run for test ${args.testExternalId}: ${JSON.stringify(
          startResp,
        )}`,
      );
    }
    return startResp.data.id;
  }
  const startResp = await client.postToAPI<{ id: string }>({
    path: '/runs',
    body: {
      testExternalId: args.testExternalId,
      message: undefined,
      buildId: readEnv(AutoblocksEnvVar.AUTOBLOCKS_CI_TEST_RUN_BUILD_ID),
      gridSearchRunGroupId: args.gridSearchRunGroupId,
      gridSearchParamsCombo: args.gridSearchParamsCombo,
    },
  });
  return startResp.data.id;
}

async function sendEvents(args: {
  testExternalId: string;
  runId: string;
  testCaseHash: string;
  testCaseResultId: string;
}): Promise<void> {
  const store = testCaseRunAsyncLocalStorage.getStore();
  if (!store) {
    throw new Error('No test case run store found');
  }
  if (
    store.testId !== args.testExternalId ||
    store.testCaseHash !== args.testCaseHash
  ) {
    throw new Error('Test case run store does not match the test case result');
  }
  if (store.testEvents.length === 0) {
    return;
  }
  await client.postToAPI({
    path: `/runs/${args.runId}/results/${args.testCaseResultId}/events`,
    body: {
      testCaseEvents: store.testEvents,
    },
  });
}

export async function sendTestCaseResult<TestCaseType, OutputType>(args: {
  testExternalId: string;
  runId: string;
  testCase: TestCaseType;
  testCaseHash: string;
  testCaseOutput: OutputType;
  testCaseDurationMs: number;
  serializeTestCaseForHumanReview?: (
    testCase: TestCaseType,
  ) => HumanReviewField[];
  serializeOutputForHumanReview?: (output: OutputType) => HumanReviewField[];
}): Promise<string> {
  const serializedOutput = isPrimitive(args.testCaseOutput)
    ? args.testCaseOutput
    : JSON.stringify(args.testCaseOutput);
  const serializedHumanReviewInputFields = args.serializeTestCaseForHumanReview
    ? args.serializeTestCaseForHumanReview(args.testCase)
    : null;
  const serializedHumanReviewOutputFields = args.serializeOutputForHumanReview
    ? args.serializeOutputForHumanReview(args.testCaseOutput)
    : null;

  if (isCLIRunning()) {
    const resp = await client.postToCLI<{ id: string }>({
      path: '/results',
      body: {
        testExternalId: args.testExternalId,
        runId: args.runId,
        testCaseHash: args.testCaseHash,
        testCaseBody: args.testCase,
        testCaseOutput: serializedOutput,
        testCaseDurationMs: args.testCaseDurationMs,
        testCaseHumanReviewInputFields: serializedHumanReviewInputFields,
        testCaseHumanReviewOutputFields: serializedHumanReviewOutputFields,
      },
    });

    if (!resp.ok || !resp.data) {
      throw new Error(
        `Failed to send test case result: ${JSON.stringify(resp)}`,
      );
    }
    const resultId = resp.data.id;

    await sendEvents({
      testExternalId: args.testExternalId,
      runId: args.runId,
      testCaseHash: args.testCaseHash,
      testCaseResultId: resultId,
    });

    return resultId;
  }

  const resp = await client.postToAPI<{ id: string }>({
    path: `/runs/${args.runId}/results`,
    body: {
      testCaseHash: args.testCaseHash,
      testCaseDurationMs: args.testCaseDurationMs,
    },
  });
  const resultId = resp.data.id;
  const results = await Promise.allSettled([
    client.postToAPI({
      path: `/runs/${args.runId}/results/${resultId}/body`,
      body: {
        testCaseBody: args.testCase,
      },
    }),
    client.postToAPI({
      path: `/runs/${args.runId}/results/${resultId}/output`,
      body: {
        testCaseOutput: serializedOutput,
      },
    }),
    sendEvents({
      testExternalId: args.testExternalId,
      runId: args.runId,
      testCaseHash: args.testCaseHash,
      testCaseResultId: resultId,
    }),
  ]);

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn(
        `Failed to send part of the test case results to Autoblocks for test case hash ${args.testCaseHash}: ${result.reason}`,
      );
    }
  });

  try {
    await client.postToAPI({
      path: `/runs/${args.runId}/results/${resultId}/human-review-fields`,
      body: {
        testCaseHumanReviewInputFields: serializedHumanReviewInputFields,
        testCaseHumanReviewOutputFields: serializedHumanReviewOutputFields,
      },
    });
  } catch (e) {
    console.warn(
      `Failed to send human review fields to Autoblocks for test case hash ${args.testCaseHash}: ${e}`,
    );
  }

  try {
    await client.postToAPI({
      path: `/runs/${args.runId}/results/${resultId}/ui-based-evaluations`,
      body: {},
    });
  } catch (e) {
    console.warn(
      `Failed to send ui-based-evaluations to Autoblocks for test case hash ${args.testCaseHash}: ${e}`,
    );
  }

  return resultId;
}

export async function sendEvaluation(args: {
  testExternalId: string;
  runId: string;
  testCaseHash: string;
  testCaseResultId: string;
  evaluatorExternalId: string;
  evaluation: Evaluation;
}): Promise<void> {
  if (isCLIRunning()) {
    await client.postToCLI({
      path: '/evals',
      body: {
        testExternalId: args.testExternalId,
        runId: args.runId,
        testCaseHash: args.testCaseHash,
        evaluatorExternalId: args.evaluatorExternalId,
        score: args.evaluation.score,
        threshold: args.evaluation.threshold,
        metadata: args.evaluation.metadata,
      },
    });
    return;
  }
  await client.postToAPI({
    path: `/runs/${args.runId}/results/${args.testCaseResultId}/evaluations`,
    body: {
      evaluatorExternalId: args.evaluatorExternalId,
      score: args.evaluation.score,
      passed: determineIfEvaluationPassed({ evaluation: args.evaluation }),
      threshold: args.evaluation.threshold,
      metadata: args.evaluation.metadata,
    },
  });
}

export async function sendEndRun(args: {
  testExternalId: string;
  runId: string;
}): Promise<void> {
  if (isCLIRunning()) {
    await client.postToCLI({
      path: '/end',
      body: { testExternalId: args.testExternalId, runId: args.runId },
    });
    return;
  }
  await client.postToAPI({
    path: `/runs/${args.runId}/end`,
    body: {},
  });
}

export async function sendSlackNotification(args: { runId: string }) {
  const slackWebhookUrl = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_SLACK_WEBHOOK_URL,
  );
  if (!slackWebhookUrl || isCLIRunning() || !isCI()) {
    return;
  }
  console.log(`Sending slack notification for run ${args.runId}`);
  try {
    await client.postToAPI({
      path: `/runs/${args.runId}/slack-notification`,
      body: {
        slackWebhookUrl,
      },
    });
  } catch (e) {
    console.warn(`Failed to send slack notification: ${e}`);
  }
}
