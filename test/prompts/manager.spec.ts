// The prompt managers require autogenerated types that don't
// exist in our local test environment, so just disabling
// type checking altogether since we'd need to ignore almost
// every line.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { API_ENDPOINT, AutoblocksEnvVar } from '../../src/util';
import { AutoblocksPromptManager } from '../../src/prompts';

describe('Prompt Manager', () => {
  describe('Revision Overrides', () => {
    let mockFetch: jest.SpyInstance;

    const expectNumRequests = (num: number) => {
      expect(mockFetch).toHaveBeenCalledTimes(num);
    };

    afterEach(() => {
      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS];
      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS];
    });

    it('overrides with the prompt revisions when the minor version is hardcoded', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS] =
        JSON.stringify({
          'my-prompt-id': 'my-revision-id',
        });

      const mockRevision = {
        id: 'my-prompt-id',
        version: 'revision:my-revision-id',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello, {{ name }}!',
          },
        ],
      };

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockRevision),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: '1',
          minor: '0',
        },
        apiKey: 'mock-api-key',
      });

      await mgr.init();

      mgr.exec(({ prompt }) => {
        expect(
          prompt.render({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/prompts/my-prompt-id/revisions/my-revision-id/validate`,
        {
          method: 'POST',
          body: JSON.stringify({
            majorVersion: 1,
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-api-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    });

    it('overrides with the prompt revision when the minor version is latest', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS] =
        JSON.stringify({
          'my-prompt-id': 'my-revision-id',
        });

      const mockRevision = {
        id: 'my-prompt-id',
        version: 'revision:my-revision-id',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello, {{ name }}!',
          },
        ],
      };

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockRevision),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: '1',
          minor: 'latest',
        },
        apiKey: 'mock-api-key',
      });

      await mgr.init();

      mgr.exec(({ prompt }) => {
        expect(
          prompt.render({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/prompts/my-prompt-id/revisions/my-revision-id/validate`,
        {
          method: 'POST',
          body: JSON.stringify({
            majorVersion: 1,
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-api-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    });

    it('uses the configured version if the revision is for a different prompt manager', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS] =
        JSON.stringify({
          'some-other-prompt-id': 'my-revision-id',
        });

      const mockPrompt = {
        id: 'my-prompt-id',
        version: '1.0',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello, {{ name }}!',
          },
        ],
      };

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockPrompt),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: '1',
          minor: '0',
        },
        apiKey: 'mock-api-key',
      });

      await mgr.init();

      mgr.exec(({ prompt }) => {
        expect(
          prompt.render({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/prompts/my-prompt-id/major/1/minor/0`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-api-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    });

    it('raises if the prompt is incompatible', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS] =
        JSON.stringify({
          'my-prompt-id': 'my-revision-id',
        });

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 409,
        ok: false,
        json: () => Promise.resolve({}),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: '1',
          minor: '0',
        },
        apiKey: 'mock-api-key',
      });

      expect(mgr.init()).rejects.toThrow(
        "Can't override prompt 'my-prompt-id' with revision 'my-revision-id' because it is not compatible with major version '1'.",
      );
    });

    it('uses the configured version if not in a testing context', async () => {
      // CLI server address is not set, so we're not in a testing context
      // process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] = 'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_PROMPT_REVISIONS] =
        JSON.stringify({
          'my-prompt-id': 'my-revision-id',
        });

      const mockPrompt = {
        id: 'my-prompt-id',
        version: '1.0',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello, {{ name }}!',
          },
        ],
      };

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockPrompt),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: '1',
          minor: '0',
        },
        apiKey: 'mock-api-key',
      });

      await mgr.init();

      mgr.exec(({ prompt }) => {
        expect(
          prompt.render({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/prompts/my-prompt-id/major/1/minor/0`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-api-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    });

    it('requests the given minor version when major version is dangerously-use-undeployed', async () => {
      const mockPrompt = {
        id: 'my-prompt-id',
        version: 'revision:mock-revision-id',
        revisionId: 'mock-revision-id',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello, {{ name }}!',
          },
        ],
      };

      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockPrompt),
      });

      const mgr = new AutoblocksPromptManager({
        id: 'my-prompt-id',
        version: {
          major: 'dangerously-use-undeployed',
          minor: 'mock-revision-id',
        },
        apiKey: 'mock-api-key',
      });

      await mgr.init();

      mgr.exec(({ prompt }) => {
        expect(
          prompt.render({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/prompts/my-prompt-id/major/undeployed/minor/mock-revision-id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-api-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    });
  });
});
