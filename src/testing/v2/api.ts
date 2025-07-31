import { Semaphore } from '../util';
import {
  V2_API_ENDPOINT,
  AutoblocksEnvVar,
  ThirdPartyEnvVar,
  readEnv,
  isV2CI,
  isV2GitHubCommentDisabled,
} from '../../util';

// Limit the number of concurrent requests to the CLI and API
const apiSemaphore = new Semaphore(10);

// We want to try to avoid race conditions with creating the comment if multiple tests are running in parallel
const githubSemaphore = new Semaphore(1);

const client = {
  postToAPI: async <T>(args: {
    path: string;
    body: unknown;
  }): Promise<{ data: T }> => {
    const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY}' environment variable.`,
      );
    }
    const url = `${V2_API_ENDPOINT}${args.path}`;
    return await apiSemaphore.run(async () => {
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
    });
  },
};

export async function sendCreateHumanReviewJob(args: {
  appSlug: string;
  runId: string;
  assigneeEmailAddresses: string[];
  name: string;
  startTimestamp: string;
  endTimestamp: string;
  rubricId?: string;
}) {
  await client.postToAPI({
    path: `/apps/${args.appSlug}/human-review/jobs`,
    body: {
      runId: args.runId,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
      rubricId: args.rubricId,
      assigneeEmailAddresses: args.assigneeEmailAddresses,
      name: args.name,
    },
  });
}

export async function sendV2SlackNotification(args: {
  runId: string;
  appSlug: string;
  buildId: string;
  useSimpleFormat?: boolean;
}) {
  const slackWebhookUrl = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_V2_SLACK_WEBHOOK_URL,
  );

  if (!slackWebhookUrl || !isV2CI()) {
    return;
  }

  console.log(`Sending Slack notification for run ${args.runId}`);
  try {
    const queryParams = new URLSearchParams({ buildId: args.buildId });
    if (args.useSimpleFormat) {
      queryParams.append('useSimpleFormat', 'true');
    }

    await client.postToAPI({
      path: `/runs/${args.runId}/slack-notification?${queryParams.toString()}`,
      body: {
        webhookUrl: slackWebhookUrl,
        appSlug: args.appSlug,
      },
    });
  } catch (e) {
    console.warn(`Failed to send Slack notification: ${e}`);
  }
}

export async function sendV2GitHubComment(args: {
  runId: string;
  appSlug: string;
  buildId: string;
}) {
  const githubToken = readEnv(ThirdPartyEnvVar.GITHUB_TOKEN);

  if (!githubToken || !isV2CI() || isV2GitHubCommentDisabled()) {
    return;
  }

  console.log(`Creating GitHub comment for build ${args.buildId}`);
  try {
    await githubSemaphore.run(async () => {
      const queryParams = new URLSearchParams({ buildId: args.buildId });
      await client.postToAPI({
        path: `/runs/${args.runId}/github-comment?${queryParams.toString()}`,
        body: {
          githubToken,
          appSlug: args.appSlug,
        },
      });
    });
  } catch (e) {
    console.warn(`Failed to create GitHub comment: ${e}`);
  }
}
