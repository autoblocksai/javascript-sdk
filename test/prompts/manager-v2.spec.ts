// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  AutoblocksEnvVar,
  RevisionSpecialVersionsEnum,
  V2_API_ENDPOINT,
} from '../../src/util';
import { AutoblocksPromptManagerV2 } from '../../src/prompts';

describe('Prompt Manager V2', () => {
  let mockFetch;

  beforeEach(() => {
    process.env.AUTOBLOCKS_V2_API_KEY = 'test-api-key';
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    delete process.env.AUTOBLOCKS_V2_API_KEY;
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS];
    mockFetch.mockRestore();
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
    const expectNumRequests = (num) => {
      expect(mockFetch).toHaveBeenCalledTimes(num);
    };

    it('uses the configured version if the revision is for a different prompt manager', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS] =
        JSON.stringify({
          'some-other-prompt-id': 'rev-1',
        });

      const mockPrompt = {
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
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockPrompt),
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
        expect(
          prompt.renderTemplate({
            template: 'template-1',
            params: {
              name: 'world',
            },
          }),
        ).toEqual('Hello, world!');
      });

      expectNumRequests(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${V2_API_ENDPOINT}/apps/app-1/prompts/prompt-1/major/1/minor/0`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('raises if the prompt is incompatible', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
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
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
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
  });
});
