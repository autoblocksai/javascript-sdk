import { flush } from '../tracer';
import { AutoblocksEnvVar, readEnv } from '../util';
import { Evaluation, HumanReviewField } from './models';
import { isPrimitive } from './util';

const client = {
  post: async <T>(args: {
    path: string;
    body: unknown;
  }): Promise<{ ok: boolean; data?: T }> => {
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
};

export async function sendError(args: {
  testId: string;
  runId?: string;
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
}

export async function sendStartGridSearchRun(args: {
  testExternalId: string;
  gridSearchParams: Record<string, string[]>;
}): Promise<string> {
  const gridResp = await client.post<{ id: string }>({
    path: '/grids',
    body: {
      testExternalId: args.testExternalId,
      gridSearchParams: args.gridSearchParams,
    },
  });
  if (!gridResp.ok || !gridResp.data) {
    throw new Error(
      `Failed to start grid for test ${args.testExternalId}: ${JSON.stringify(
        gridResp,
      )}`,
    );
  }

  return gridResp.data.id;
}

export async function sendStartRun(args: {
  testExternalId: string;
  gridSearchRunGroupId?: string;
  gridSearchParamsCombo?: Record<string, string>;
}): Promise<string> {
  const startResp = await client.post<{ id: string }>({
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
  // Flush the logs before we send the result, since the CLI
  // accumulates the events and sends them as a batch along
  // with the result.
  await flush();

  const resp = await client.post<{ id: string }>({
    path: '/results',
    body: {
      testExternalId: args.testExternalId,
      runId: args.runId,
      testCaseHash: args.testCaseHash,
      testCaseBody: args.testCase,
      testCaseOutput: isPrimitive(args.testCaseOutput)
        ? args.testCaseOutput
        : JSON.stringify(args.testCaseOutput),
      testCaseDurationMs: args.testCaseDurationMs,
      testCaseHumanReviewInputFields: args.serializeTestCaseForHumanReview
        ? args.serializeTestCaseForHumanReview(args.testCase)
        : null,
      testCaseHumanReviewOutputFields: args.serializeOutputForHumanReview
        ? args.serializeOutputForHumanReview(args.testCaseOutput)
        : null,
    },
  });

  if (!resp.ok || !resp.data) {
    throw new Error(`Failed to send test case result: ${JSON.stringify(resp)}`);
  }

  return resp.data.id;
}

export async function sendEvaluation(args: {
  testExternalId: string;
  runId: string;
  testCaseHash: string;
  testCaseResultId: string;
  evaluatorExternalId: string;
  evaluation: Evaluation;
}): Promise<void> {
  await client.post({
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
}

export async function sendEndRun(args: {
  testExternalId: string;
  runId: string;
}): Promise<void> {
  await client.post({
    path: '/end',
    body: { testExternalId: args.testExternalId, runId: args.runId },
  });
}
