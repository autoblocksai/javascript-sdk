// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  AutoblocksEnvVar,
  RevisionSpecialVersionsEnum,
  V2_API_ENDPOINT,
} from '../../src/util';
import { AutoblocksPromptManagerV2 } from '../../src/prompts';

// Mock fs to provide app mapping for test-app
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn((path, encoding) => {
    if (path.includes('app-mapping.json')) {
      return JSON.stringify({ 'test-app': 'test-app-id' });
    }
    return jest.requireActual('fs').readFileSync(path, encoding);
  }),
}));

describe('Prompt Manager V2', () => {
  let mockFetch;

  beforeEach(() => {
    process.env.AUTOBLOCKS_V2_API_KEY = 'test-api-key';
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    if (mockFetch) {
      mockFetch.mockRestore();
    }
    delete process.env[AutoblocksEnvVar.V2_CI_TEST_RUN_BUILD_ID];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS];
  });

  it('should construct with appName, id, and version', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: 'my-app',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    expect(manager).toBeDefined();
  });

  it('should throw if no API key is provided', () => {
    delete process.env.AUTOBLOCKS_V2_API_KEY;

    expect(() => {
      new AutoblocksPromptManagerV2({
        appName: 'my-app',
        id: 'prompt-1',
        version: {
          major: '1',
          minor: '0',
        },
      });
    }).toThrow(/AUTOBLOCKS_V2_API_KEY/);
  });

  it('should render templates correctly', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      const result = prompt.renderTemplate({
        template: 'template-1',
        params: {
          name: 'world',
        },
      });
      expect(result).toEqual('Hello, world!');
    });
  });

  it('should support the deprecated render method', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      const result = prompt.render({
        template: 'template-1',
        params: {
          name: 'world',
        },
      });
      expect(result).toEqual('Hello, world!');
    });
  });

  it('should throw when template is not found', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      expect(() => {
        prompt.renderTemplate({
          template: 'non-existent-template',
          params: {
            name: 'world',
          },
        });
      }).toThrow(/Template 'non-existent-template' not found/);
    });
  });

  it('should support tools', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                param1: {
                  type: 'string',
                  description: 'Parameter 1',
                },
              },
              required: ['param1'],
            },
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      const tool = prompt.renderTool({
        tool: 'test-tool',
        params: {
          param1: 'test-value',
        },
      });

      expect(tool).toEqual({
        type: 'function',
        function: {
          name: 'test-tool',
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              param1: {
                type: 'string',
                description: 'Parameter 1',
              },
            },
            required: ['param1'],
          },
        },
      });
    });
  });

  it('should throw when tool is not found', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                param1: {
                  type: 'string',
                  description: 'Parameter 1',
                },
              },
              required: ['param1'],
            },
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      expect(() => {
        prompt.renderTool({
          tool: 'non-existent-tool',
          params: {
            param1: 'test-value',
          },
        });
      }).toThrow(/Tool 'non-existent-tool' not found/);
    });
  });

  it('should throw when no tools are defined', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
      // No tools defined
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      expect(() => {
        prompt.renderTool({
          tool: 'test-tool',
          params: {
            param1: 'test-value',
          },
        });
      }).toThrow(/No tools defined/);
    });
  });

  it('should support tracking', async () => {
    const mockResponse = {
      id: 'prompt-1',
      revisionId: 'rev-1',
      version: '1.0',
      templates: [
        {
          id: 'template-1',
          template: 'Hello, {{ name }}!',
        },
      ],
      params: {
        params: {
          defaultName: 'world',
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const manager = new AutoblocksPromptManagerV2({
      appId: 'app-1',
      id: 'prompt-1',
      version: {
        major: '1',
        minor: '0',
      },
    });

    await manager.init();

    manager.exec(({ prompt }) => {
      const tracking = prompt.track();
      expect(tracking).toEqual({
        id: 'prompt-1',
        version: '1.0',
        templates: [
          {
            id: 'template-1',
            template: 'Hello, {{ name }}!',
          },
        ],
        params: {
          params: {
            defaultName: 'world',
          },
        },
      });
    });
  });

  describe('Revision Overrides', () => {
    it('raises if the prompt is incompatible', async () => {
      process.env[AutoblocksEnvVar.V2_CI_TEST_RUN_BUILD_ID] = 'test-build-id';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS] =
        JSON.stringify({
          'prompt-1': 'rev-1',
        });

      mockFetch.mockResolvedValueOnce({
        status: 409,
        ok: false,
        json: () => Promise.resolve({}),
      });

      const manager = new AutoblocksPromptManagerV2({
        appId: 'app-1',
        id: 'prompt-1',
        version: {
          major: '1',
          minor: '0',
        },
      });

      await expect(manager.init()).rejects.toThrow(
        "Can't override prompt 'prompt-1' with revision 'rev-1' because it is not compatible with major version '1'.",
      );
    });

    it('throws when trying to override with a revision when using dangerously-use-undeployed', async () => {
      process.env[AutoblocksEnvVar.V2_CI_TEST_RUN_BUILD_ID] = 'test-build-id';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS] =
        JSON.stringify({
          'prompt-1': 'rev-1',
        });

      const manager = new AutoblocksPromptManagerV2({
        appId: 'app-1',
        id: 'prompt-1',
        version: {
          major: RevisionSpecialVersionsEnum.DANGEROUSLY_USE_UNDEPLOYED,
          minor: '0',
        },
      });

      await expect(manager.init()).rejects.toThrow(
        /Prompt revision overrides are not yet supported for prompt managers using 'dangerously-use-undeployed'/,
      );
    });

    it('uses unified AUTOBLOCKS_OVERRIDES format and takes precedence over legacy format', async () => {
      process.env[AutoblocksEnvVar.V2_CI_TEST_RUN_BUILD_ID] = 'test-build-id';
      // Set both new and legacy formats - new should take precedence
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        promptRevisions: {
          'my-prompt-id': 'unified-revision-id',
        },
      });
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS] =
        JSON.stringify({
          'my-prompt-id': 'legacy-revision-id',
        });

      const mockRevision = {
        id: 'my-prompt-id',
        revisionId: 'unified-revision-id',
        version: 'revision:unified-revision-id',
        templates: [
          {
            id: 'my-template-id',
            template: 'Hello from unified v2, {{ name }}!',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockRevision),
      });

      const mgr = new AutoblocksPromptManagerV2({
        appName: 'test-app',
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
          prompt.renderTemplate({
            template: 'my-template-id',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello from unified v2, world!');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${V2_API_ENDPOINT}/apps/test-app-id/prompts/my-prompt-id/revisions/unified-revision-id/validate`,
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
  });
});
