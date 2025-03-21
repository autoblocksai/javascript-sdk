import { AutoblocksPromptManager } from '@autoblocks/client/prompts';

describe('AutoblocksPromptManager v1.0', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: '1',
      minor: '0',
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('renders prompts', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'template-a',
        params: {
          name: 'Alice',
          weather: 'sunny',
        },
      });
      expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
    });
  });

  it('handles async exec functions', async () => {
    const rendered = await manager.exec(async ({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'template-a',
        params: {
          name: 'Alice',
          weather: 'sunny',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      return rendered;
    });

    expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
  });

  it('provides params', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.params).toEqual({
        frequencyPenalty: 0,
        maxTokens: 256,
        model: 'gpt-4',
        presencePenalty: 0.3,
        stopSequences: [],
        temperature: 0.7,
        topP: 1,
      });
    });
  });

  it('provides tracking info', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track()).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '1.0',
        templates: [
          {
            id: 'template-a',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            template: 'Hello, {{ optional? }}! My name is {{ name }}.',
          },
        ],
        params: {
          params: {
            frequencyPenalty: 0,
            maxTokens: 256,
            model: 'gpt-4',
            presencePenalty: 0.3,
            stopSequences: [],
            temperature: 0.7,
            topP: 1,
          },
        },
        tools: undefined,
      });
    });
  });
});

describe('AutoblocksPromptManager v1 latest', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: '1',
      minor: 'latest',
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('renders prompts', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'template-a',
        params: {
          name: 'Alice',
          weather: 'sunny',
        },
      });
      expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
    });
  });

  it('provides params', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.params).toEqual({
        frequencyPenalty: 0,
        maxTokens: 256,
        model: 'gpt-4',
        presencePenalty: -0.3,
        stopSequences: [],
        temperature: 0.7,
        topP: 1,
      });
    });
  });

  it('provides tracking info', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track()).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '1.1',
        templates: [
          {
            id: 'template-a',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            template: 'Hello, {{ optional? }}! My name is {{ name }}.',
          },
        ],
        params: {
          params: {
            frequencyPenalty: 0,
            maxTokens: 256,
            model: 'gpt-4',
            presencePenalty: -0.3,
            stopSequences: [],
            temperature: 0.7,
            topP: 1,
          },
        },
        tools: undefined,
      });
    });
  });
});

describe('AutoblocksPromptManager v2.1', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: '2',
      minor: '1',
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('renders prompts', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'template-a',
        params: {
          name: 'Alice',
          weather: 'sunny',
        },
      });
      expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
    });
  });

  it('renders templates with no params', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'template-c',
        params: {},
      });
      expect(rendered).toEqual('I am template c and I have no params');
    });
  });

  it('provides params', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.params).toEqual({
        frequencyPenalty: 0,
        maxTokens: 256,
        model: 'gpt-4',
        presencePenalty: -0.3,
        stopSequences: [],
        temperature: 0.7,
        topP: 1,
      });
    });
  });

  it('provides tracking info', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track()).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '2.1',
        templates: [
          {
            id: 'template-a',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            template: 'Hello {{ optional? }}! My name is {{ name }}.',
          },
          {
            id: 'template-c',
            template: 'I am template c and I have no params',
          },
        ],
        params: {
          params: {
            frequencyPenalty: 0,
            maxTokens: 256,
            model: 'gpt-4',
            presencePenalty: -0.3,
            stopSequences: [],
            temperature: 0.7,
            topP: 1,
          },
        },
        tools: undefined,
      });
    });
  });
});

describe('AutoblocksPromptManager v1 weighted', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: '1',
      minor: [
        {
          version: 'latest',
          weight: 10,
        },
        {
          version: '0',
          weight: 90,
        },
      ],
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('provides tracking info', () => {
    manager.exec(({ prompt }) => {
      const tracking = prompt.track();
      // Either 1.0 or 1.1 should be chosen based on their weights
      expect(['1.0', '1.1'].includes(tracking.version)).toBe(true);
    });
  });
});

describe('Latest Undeployed', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: 'dangerously-use-undeployed',
      minor: 'latest',
    },
    apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('works', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track().id).toEqual('used-by-ci-dont-delete');
      expect(prompt.track().version.startsWith('revision:')).toBe(true);
    });
  });
});

describe('Pinned Undeployed', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: 'dangerously-use-undeployed',
      minor: 'cm6grg7lk0003rc2qzr9okfcd',
    },
    apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('works', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track()).toEqual({
        id: 'used-by-ci-dont-delete',
        version: 'revision:cm6grg7lk0003rc2qzr9okfcd',
        templates: [
          {
            id: 'template-a',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today!',
          },
          {
            id: 'template-b',
            template: 'Hello {{ optional? }}! My name is {{ name }}.',
          },
          {
            id: 'template-c',
            template: 'I am template c and I have no params',
          },
        ],
        params: {
          params: {
            model: 'llama7b-v2-chat',
            topK: 0,
            maxTokens: 256,
            temperature: 0.3,
            topP: 1,
            stopSequences: [],
            seed: 4096,
            responseFormat: {
              type: 'json_object',
            },
          },
        },
        tools: [],
      });
    });
  });
});

describe('Renders {{ }}', () => {
  const manager = new AutoblocksPromptManager({
    id: 'nicole-test',
    version: {
      major: '1',
      minor: '1',
    },
    apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('works', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'nicole-test',
        params: {},
      });
      expect(rendered).toEqual(`Hello! Please respond in the following format:

{{
  "x": {{
    "y": 1
  }}
}}`);
    });
  });
});

describe('Renders Inline {{ }}', () => {
  const manager = new AutoblocksPromptManager({
    id: 'nicole-test',
    version: {
      major: '1',
      minor: '2',
    },
    apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('works', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTemplate({
        template: 'nicole-test',
        params: {},
      });
      expect(rendered).toEqual(`Hello! Please respond in the following format:

{{"x": {{"y": 1}}}}`);
    });
  });
});

describe('AutoblocksPromptManager with tools', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete-with-tools',
    version: {
      major: '1',
      minor: '0',
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('renders tools', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.renderTool({
        tool: 'MyTool',
        params: {
          description: 'my description',
        },
      });
      expect(rendered).toEqual({
        type: 'function',
        function: {
          name: 'MyTool',
          description: 'This is the description',
          parameters: {
            type: 'object',
            properties: {
              myParam: {
                type: 'string',
                description: 'my description',
              },
            },
            required: ['myParam'],
          },
        },
      });
    });
  });

  it('provides tracking info', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.track()).toEqual({
        id: 'used-by-ci-dont-delete-with-tools',
        version: '1.0',
        templates: [
          {
            id: 'system',
            template: 'System Template',
          },
        ],
        params: undefined,
        tools: [
          {
            type: 'function',
            function: {
              name: 'MyTool',
              description: 'This is the description',
              parameters: {
                type: 'object',
                properties: {
                  myParam: {
                    type: 'string',
                    description: '{{ description }}',
                  },
                },
                required: ['myParam'],
              },
            },
          },
        ],
      });
    });
  });
});
