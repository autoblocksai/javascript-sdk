import { z } from 'zod';

enum Provider {
  LOCAL = 'local',
  GITHUB = 'github',
}

interface ReplayRun {
  provider: Provider;
  runId: string;
  runUrl: string | null;
  repo: string | null;
  repoUrl: string | null;
  branchName: string | null;
  defaultBranchName: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitCommitterName: string | null;
  commitCommitterEmail: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
  commitCommittedDate: string | null;
  pullRequestNumber: string | null;
  pullRequestTitle: string | null;
}

const zCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  committerName: z.string(),
  committerEmail: z.string(),
  committedDate: z.string(),
});

type Commit = z.infer<typeof zCommitSchema>;

const zEnvSchema = z.object({
  AUTOBLOCKS_REPLAY_ID: z.string().optional(),
  GITHUB_ACTIONS: z.string().optional(),
});

const gitHubEnvSchema = z.object({
  GITHUB_EVENT_PATH: z.string(),
  GITHUB_REF_NAME: z.string(),
  GITHUB_REPOSITORY: z.string(),
  GITHUB_RUN_ID: z.string(),
  GITHUB_RUN_ATTEMPT: z.string(),
  GITHUB_SERVER_URL: z.string(),
  GITHUB_SHA: z.string(),
});

/**
 * Convert a camelCaseString to a Kebab-Case-String
 */
const camelToKebab = (s: string): string => {
  return s
    .split(/(?=[A-Z])/)
    .map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase())
    .join('-');
};

const replayRunToHttpHeaders = (run: ReplayRun): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(run)) {
    if (value === null) {
      continue;
    }
    headers[`X-Autoblocks-Replay-${camelToKebab(key)}`] = encodeURIComponent(
      `${value}`,
    );
  }

  return headers;
};

/**
 * Parses the org and repo name from the origin URL.
 *
 * Examples:
 *
 * https://github.com/autoblocksai/javascript-sdk.git -> autoblocksai/javascript-sdk
 * git@gitlab.com:gitlab-com/www-gitlab-com.git -> gitlab-com/www-gitlab-com
 */
export const parseRepoNameFromOriginUrl = (url: string): string => {
  return url.replace('.git', '').split(':')[1].split('/').slice(-2).join('/');
};

export class HeadersBuilder {
  private fs: typeof import('fs');
  private cp: typeof import('child_process');
  private env: z.infer<typeof zEnvSchema>;

  constructor() {
    this.fs = require('fs');
    this.cp = require('child_process');
    this.env = zEnvSchema.parse(process.env);
  }

  private run(cmd: string): string {
    try {
      return this.cp
        .execSync(cmd, {
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf-8',
        })
        .trim();
    } catch (e) {
      return '';
    }
  }

  private makeLocalReplayRun(replayId: string): ReplayRun {
    let commitSha = null;
    let commitMessage = null;
    let commitCommitterName = null;
    let commitCommitterEmail = null;
    let commitAuthorName = null;
    let commitAuthorEmail = null;
    let commitCommittedDate = null;

    let branchName = null;
    let repoName = null;

    try {
      const commit = this.getLocalCommitData({ sha: null });
      commitSha = commit.sha;
      commitMessage = commit.message;
      commitCommitterName = commit.committerName;
      commitCommitterEmail = commit.committerEmail;
      commitAuthorName = commit.authorName;
      commitAuthorEmail = commit.authorEmail;
      commitCommittedDate = commit.committedDate;
    } catch {
      // Ignore
    }

    try {
      branchName = this.getLocalBranchName();
    } catch {
      // Ignore
    }

    try {
      repoName = this.getLocalRepoName();
    } catch {
      // Ignore
    }

    return {
      provider: Provider.LOCAL,
      runId: replayId,
      runUrl: null,
      repo: repoName,
      repoUrl: null,
      branchName,
      defaultBranchName: null,
      commitSha,
      commitMessage,
      commitCommitterName,
      commitCommitterEmail,
      commitAuthorName,
      commitAuthorEmail,
      commitCommittedDate,
      pullRequestNumber: null,
      pullRequestTitle: null,
    };
  }

  private makeGitHubReplayRun(): ReplayRun {
    const g = gitHubEnvSchema.parse(process.env);

    // GitHub Actions are triggered by webhook events, and the event payload is
    // stored in a JSON file at $GITHUB_EVENT_PATH.
    // You can see the schema of the various webhook payloads at:
    // https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads
    const event = JSON.parse(
      this.fs.readFileSync(g.GITHUB_EVENT_PATH, 'utf-8'),
    );

    const pullRequestNumber = event.pull_request?.number || null;
    const pullRequestTitle = event.pull_request?.title || null;
    // When it's a `push` event, the branch name is in `GITHUB_REF_NAME`, but on the `pull_request`
    // event we want to use event.pull_request.head.ref, since `GITHUB_REF_NAME` will contain the
    // name of the merge commit for the PR, like 5/merge.
    const branchName = event.pull_request?.head?.ref || g.GITHUB_REF_NAME;

    const commit = this.getLocalCommitData({ sha: g.GITHUB_SHA });

    return {
      provider: Provider.GITHUB,
      runId: `${g.GITHUB_REPOSITORY}-${g.GITHUB_RUN_ID}-${g.GITHUB_RUN_ATTEMPT}`,
      runUrl: [
        g.GITHUB_SERVER_URL,
        g.GITHUB_REPOSITORY,
        'actions',
        'runs',
        g.GITHUB_RUN_ID,
        'attempts',
        g.GITHUB_RUN_ATTEMPT,
      ].join('/'),
      repo: g.GITHUB_REPOSITORY,
      repoUrl: [g.GITHUB_SERVER_URL, g.GITHUB_REPOSITORY].join('/'),
      branchName,
      defaultBranchName: event.repository?.default_branch || null,
      commitSha: commit.sha,
      commitMessage: commit.message,
      commitCommitterName: commit.committerName,
      commitCommitterEmail: commit.committerEmail,
      commitAuthorName: commit.authorName,
      commitAuthorEmail: commit.authorEmail,
      commitCommittedDate: commit.committedDate,
      pullRequestNumber,
      pullRequestTitle,
    };
  }

  // Made public for testing
  public getLocalCommitData(args: { sha: string | null }): Commit {
    const commitMessageKey = 'message';

    const logFormat = [
      'sha=%H',
      'authorName=%an',
      'authorEmail=%ae',
      'committerName=%cn',
      'committerEmail=%ce',
      'committedDate=%aI',
      // This should be last because it can contain multiple lines
      `${commitMessageKey}=%B`,
    ].join('%n');

    const out = this.run(
      `git show ${args.sha || 'HEAD'} --quiet --format="${logFormat}"`,
    );
    const lines = out.split('\n');

    const data: Record<string, string> = {};

    while (lines.length) {
      const line = lines.shift();
      if (!line) {
        break;
      }

      // Split on the first =
      const idx = line.indexOf('=');
      const [key, value] = [line.slice(0, idx), line.slice(idx + 1)];

      if (key === commitMessageKey) {
        // Once we've reached the commit message key, the remaining lines are the commit message
        data[commitMessageKey] = [value, ...lines].join('\n');
        break;
      }

      data[key] = value;
    }

    return zCommitSchema.parse(data);
  }

  public getLocalBranchName(): string | null {
    return this.run('git rev-parse --abbrev-ref HEAD') || null;
  }

  public getLocalRepoName(): string {
    const originUrl = this.run('git remote get-url origin');
    return parseRepoNameFromOriginUrl(originUrl);
  }

  private makeReplayRun(): ReplayRun | null {
    if (this.env.GITHUB_ACTIONS) {
      return this.makeGitHubReplayRun();
    } else if (this.env.AUTOBLOCKS_REPLAY_ID) {
      return this.makeLocalReplayRun(this.env.AUTOBLOCKS_REPLAY_ID);
    }

    return null;
  }

  public makeReplayHeaders(): Record<string, string> | undefined {
    const run = this.makeReplayRun();
    if (!run) {
      return undefined;
    }

    return replayRunToHttpHeaders(run);
  }
}

export const makeReplayHeaders = (): Record<string, string> | undefined => {
  if (typeof window !== 'undefined') {
    // We're in a browser environment, so we can't use fs or child_process.
    return undefined;
  }
  const builder = new HeadersBuilder();
  return builder.makeReplayHeaders();
};

export const AUTOBLOCKS_INGESTION_KEY = 'AUTOBLOCKS_INGESTION_KEY';

export const readEnv = (key: string): string | undefined => {
  return process.env[key];
};
