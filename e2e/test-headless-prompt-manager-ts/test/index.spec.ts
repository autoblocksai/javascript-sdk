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
      const rendered = prompt.render({
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
      const rendered = prompt.render({
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
      const tracking = prompt.track();
      expect(tracking).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '1.0',
        templates: [
          {
            id: 'template-a',
            version: '1.0',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            version: '1.0',
            template: 'Hello, {{ optional? }}! My name is {{ name }}.',
          },
        ],
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
      const rendered = prompt.render({
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
      const tracking = prompt.track();
      expect(tracking).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '1.1',
        templates: [
          {
            id: 'template-a',
            version: '1.0',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            version: '1.0',
            template: 'Hello, {{ optional? }}! My name is {{ name }}.',
          },
        ],
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
      const rendered = prompt.render({
        template: 'template-a',
        params: {
          name: 'Alice',
          weather: 'sunny',
        },
      });
      expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
    });
  });

  it('renders templates when not providing optional template params', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.render({
        template: 'template-b',
        params: {
          name: 'Alice',
        },
      });
      expect(rendered).toEqual('Hello! My name is Alice.');
    });
  });

  it('renders templates when providing optional template params', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.render({
        template: 'template-b',
        params: {
          optional: 'Bob',
          name: 'Alice',
        },
      });
      expect(rendered).toEqual('Hello Bob! My name is Alice.');
    });
  });

  it('renders templates with no params', () => {
    manager.exec(({ prompt }) => {
      const rendered = prompt.render({
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
      const tracking = prompt.track();
      expect(tracking).toEqual({
        id: 'used-by-ci-dont-delete',
        version: '2.1',
        templates: [
          {
            id: 'template-a',
            version: '1.0',
            template: 'Hello, {{ name }}! The weather is {{ weather }} today.',
          },
          {
            id: 'template-b',
            version: '1.1',
            template: 'Hello {{ optional? }}! My name is {{ name }}.',
          },
          {
            id: 'template-c',
            version: '1.0',
            template: 'I am template c and I have no params',
          },
        ],
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

describe('Undeployed', () => {
  const manager = new AutoblocksPromptManager({
    id: 'used-by-ci-dont-delete',
    version: {
      major: 'dangerously-use-undeployed',
      minor: '',
    },
  });

  beforeAll(async () => {
    await manager.init();
  });

  afterAll(() => {
    manager.close();
  });

  it('works', () => {
    manager.exec(({ prompt }) => {
      expect(prompt.params).toBeDefined();
      expect(prompt.track().id).toEqual('used-by-ci-dont-delete');
      expect(prompt.track().version).toEqual('undeployed');

      try {
        // Just testing type checking here
        prompt.render({
          template: 'fdsa',
          params: {
            fdsa: 'fdsa',
          },
        });
      } catch {
        // expected
      }
    });
  });
});
