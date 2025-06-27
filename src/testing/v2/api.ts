import { Semaphore } from '../util';
import { V2_API_ENDPOINT, AutoblocksEnvVar, readEnv } from '../../util';

// Limit the number of concurrent requests to the CLI and API
const apiSemaphore = new Semaphore(10);

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
