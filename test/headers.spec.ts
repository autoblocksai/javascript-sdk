import axios from 'axios';
import { AutoblocksTracer } from '../src';
import { HeadersBuilder } from '../src/util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('axios');

const axiosCreateMock = axios.create as jest.Mock;

describe('Replay Headers', () => {
  let mockPost: jest.Mock;

  // Wanted to follow https://jestjs.io/docs/mock-function-api#jestreplacedsource but couldn't get the types to work
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let replacedEnv: any = undefined;

  beforeEach(() => {
    mockPost = jest
      .fn()
      .mockResolvedValueOnce({ data: { traceId: 'mock-trace-id' } });
    axiosCreateMock.mockReturnValueOnce({ post: mockPost });
  });

  afterEach(() => {
    replacedEnv?.restore();
  });

  it('local replay', async () => {
    replacedEnv = jest.replaceProperty(process, 'env', {
      AUTOBLOCKS_SIMULATION_ID: 'my-replay-id',
    });

    const builder = new HeadersBuilder();
    const commit = builder.getLocalCommitData({ sha: null });

    const ab = new AutoblocksTracer('mock-ingestion-token');
    const { traceId } = await ab.sendEvent('mock-message');

    expect(traceId).toEqual('mock-trace-id');
    expect(mockPost).toHaveBeenCalledWith(
      '/',
      {
        message: 'mock-message',
        traceId: undefined,
        timestamp: undefined,
        properties: {},
      },
      {
        headers: {
          'X-Autoblocks-Replay-Provider': encodeURIComponent('local'),
          'X-Autoblocks-Replay-Run-Id': encodeURIComponent('my-replay-id'),
          'X-Autoblocks-Replay-Repo': encodeURIComponent(
            'autoblocksai/javascript-sdk',
          ),
          'X-Autoblocks-Replay-Branch-Name': encodeURIComponent(
            builder.getLocalBranchName() || '',
          ),
          'X-Autoblocks-Replay-Commit-Sha': encodeURIComponent(commit.sha),
          'X-Autoblocks-Replay-Commit-Message': encodeURIComponent(
            commit.message,
          ),
          'X-Autoblocks-Replay-Commit-Author-Name': encodeURIComponent(
            commit.authorName,
          ),
          'X-Autoblocks-Replay-Commit-Author-Email': encodeURIComponent(
            commit.authorEmail,
          ),
          'X-Autoblocks-Replay-Commit-Committer-Name': encodeURIComponent(
            commit.committerName,
          ),
          'X-Autoblocks-Replay-Commit-Committer-Email': encodeURIComponent(
            commit.committerEmail,
          ),
          'X-Autoblocks-Replay-Commit-Committed-Date': encodeURIComponent(
            commit.committedDate,
          ),
        },
      },
    );
  });

  describe('GitHub Replays', () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a unique temp directory
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-'));
    });

    afterEach(() => {
      // Clean up: Remove the temp directory after test execution
      fs.rmSync(tempDir, { recursive: true });
    });

    it('Event Type: push', async () => {
      const eventPath = path.join(tempDir, 'event.json');
      fs.writeFileSync(
        eventPath,
        JSON.stringify({
          repository: { default_branch: 'main' },
        }),
      );

      const builder = new HeadersBuilder();
      const commit = builder.getLocalCommitData({ sha: null });

      replacedEnv = jest.replaceProperty(process, 'env', {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REF_NAME: 'feat/my-branch',
        GITHUB_REPOSITORY: 'myorg/myrepo',
        GITHUB_RUN_ID: 'my-run-id',
        GITHUB_RUN_ATTEMPT: 'my-run-attempt',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_SHA: commit.sha,
      });

      const ab = new AutoblocksTracer('mock-ingestion-token');
      const { traceId } = await ab.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp: undefined,
          properties: {},
        },
        {
          headers: {
            'X-Autoblocks-Replay-Provider': encodeURIComponent('github'),
            'X-Autoblocks-Replay-Run-Id': encodeURIComponent(
              'myorg/myrepo-my-run-id-my-run-attempt',
            ),
            'X-Autoblocks-Replay-Run-Url': encodeURIComponent(
              'https://github.com/myorg/myrepo/actions/runs/my-run-id/attempts/my-run-attempt',
            ),
            'X-Autoblocks-Replay-Repo': encodeURIComponent('myorg/myrepo'),
            'X-Autoblocks-Replay-Repo-Url': encodeURIComponent(
              'https://github.com/myorg/myrepo',
            ),
            'X-Autoblocks-Replay-Branch-Name':
              encodeURIComponent('feat/my-branch'),
            'X-Autoblocks-Replay-Default-Branch-Name':
              encodeURIComponent('main'),
            'X-Autoblocks-Replay-Commit-Sha': encodeURIComponent(commit.sha),
            'X-Autoblocks-Replay-Commit-Message': encodeURIComponent(
              commit.message,
            ),
            'X-Autoblocks-Replay-Commit-Author-Name': encodeURIComponent(
              commit.authorName,
            ),
            'X-Autoblocks-Replay-Commit-Author-Email': encodeURIComponent(
              commit.authorEmail,
            ),
            'X-Autoblocks-Replay-Commit-Committer-Name': encodeURIComponent(
              commit.committerName,
            ),
            'X-Autoblocks-Replay-Commit-Committer-Email': encodeURIComponent(
              commit.committerEmail,
            ),
            'X-Autoblocks-Replay-Commit-Committed-Date': encodeURIComponent(
              commit.committedDate,
            ),
          },
        },
      );
    });

    it('Event Type: pull_request', async () => {
      const eventPath = path.join(tempDir, 'event.json');
      fs.writeFileSync(
        eventPath,
        JSON.stringify({
          repository: { default_branch: 'main' },
          pull_request: {
            number: 5,
            title: 'My PR Title',
            head: {
              ref: 'feat/my-branch',
            },
          },
        }),
      );

      const builder = new HeadersBuilder();
      const commit = builder.getLocalCommitData({ sha: null });

      replacedEnv = jest.replaceProperty(process, 'env', {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REF_NAME: '5/merge',
        GITHUB_REPOSITORY: 'myorg/myrepo',
        GITHUB_RUN_ID: 'my-run-id',
        GITHUB_RUN_ATTEMPT: 'my-run-attempt',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_SHA: commit.sha,
      });

      const ab = new AutoblocksTracer('mock-ingestion-token');
      const { traceId } = await ab.sendEvent('mock-message');

      expect(traceId).toEqual('mock-trace-id');
      expect(mockPost).toHaveBeenCalledWith(
        '/',
        {
          message: 'mock-message',
          traceId: undefined,
          timestamp: undefined,
          properties: {},
        },
        {
          headers: {
            'X-Autoblocks-Replay-Provider': encodeURIComponent('github'),
            'X-Autoblocks-Replay-Run-Id': encodeURIComponent(
              'myorg/myrepo-my-run-id-my-run-attempt',
            ),
            'X-Autoblocks-Replay-Run-Url': encodeURIComponent(
              'https://github.com/myorg/myrepo/actions/runs/my-run-id/attempts/my-run-attempt',
            ),
            'X-Autoblocks-Replay-Repo': encodeURIComponent('myorg/myrepo'),
            'X-Autoblocks-Replay-Repo-Url': encodeURIComponent(
              'https://github.com/myorg/myrepo',
            ),
            'X-Autoblocks-Replay-Branch-Name':
              encodeURIComponent('feat/my-branch'),
            'X-Autoblocks-Replay-Default-Branch-Name':
              encodeURIComponent('main'),
            'X-Autoblocks-Replay-Commit-Sha': encodeURIComponent(commit.sha),
            'X-Autoblocks-Replay-Commit-Message': encodeURIComponent(
              commit.message,
            ),
            'X-Autoblocks-Replay-Commit-Author-Name': encodeURIComponent(
              commit.authorName,
            ),
            'X-Autoblocks-Replay-Commit-Author-Email': encodeURIComponent(
              commit.authorEmail,
            ),
            'X-Autoblocks-Replay-Commit-Committer-Name': encodeURIComponent(
              commit.committerName,
            ),
            'X-Autoblocks-Replay-Commit-Committer-Email': encodeURIComponent(
              commit.committerEmail,
            ),
            'X-Autoblocks-Replay-Commit-Committed-Date': encodeURIComponent(
              commit.committedDate,
            ),
            'X-Autoblocks-Replay-Pull-Request-Number': encodeURIComponent('5'),
            'X-Autoblocks-Replay-Pull-Request-Title':
              encodeURIComponent('My PR Title'),
          },
        },
      );
    });
  });
});
