import { AutoblocksPromptManagerV2 } from '@autoblocks/client/prompts';

// Use a single app ID across all tests
const APP_SLUG = 'ci-app';

describe('AutoblocksPromptManagerV2', () => {
  describe('AutoblocksPromptManagerV2 v1.0', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: APP_SLUG,
      id: 'prompt-basic',
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
          model: 'gpt-4o',
        });
      });
    });

    it('provides tracking info', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.track()).toEqual({
          id: 'prompt-basic',
          version: '1.0',
          templates: [
            {
              id: 'template-a',
              template: 'Hello, {{name}}! The weather is {{ weather }} today.',
            },
          ],
          params: {
            params: {
              model: 'gpt-4o',
            },
          },
          tools: [],
        });
      });
    });
  });

  describe('AutoblocksPromptManagerV2 v1.latest', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: APP_SLUG,
      id: 'prompt-basic',
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
        expect(rendered).toEqual('Hey, Alice! The weather is sunny today.');
      });
    });

    it('provides params', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.params).toEqual({
          model: 'gpt-4o',
        });
      });
    });

    it('provides tracking info', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.track()).toEqual({
          id: 'prompt-basic',
          version: '1.1',
          templates: [
            {
              id: 'template-a',
              template: 'Hey, {{name}}! The weather is {{ weather }} today.',
            },
          ],
          params: {
            params: {
              model: 'gpt-4o',
            },
          },
          tools: [],
        });
      });
    });
  });

  describe('AutoblocksPromptManagerV2 v4.0', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: APP_SLUG,
      id: 'prompt-basic',
      version: {
        major: '4',
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
          template: 'template-c',
          params: {
            first_name: 'Alice',
          },
        });
        expect(rendered).toEqual('Hello, Alice!');
      });
    });

    it('provides params', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.params).toEqual({
          model: 'gpt-4o',
          maxCompletionTokens: 256,
        });
      });
    });

    it('provides tracking info', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.track()).toEqual({
          id: 'prompt-basic',
          version: '4.0',
          templates: [
            {
              id: 'template-c',
              template: 'Hello, {{first_name}}!',
            },
          ],
          params: {
            params: {
              model: 'gpt-4o',
              maxCompletionTokens: 256,
            },
          },
          tools: [],
        });
      });
    });
  });

  describe('Latest Undeployed V2', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: APP_SLUG,
      id: 'prompt-basic',
      version: {
        major: 'dangerously-use-undeployed',
        minor: 'latest',
      },
      initTimeout: { seconds: 5 },
    });

    beforeAll(async () => {
      await manager.init();
    });

    afterAll(() => {
      manager.close();
    });

    it('works', () => {
      manager.exec(({ prompt }) => {
        expect(prompt.track().id).toEqual('prompt-basic');
        expect(prompt.track().version.startsWith('revision:')).toBe(true);
      });
    });
  });

  describe('Pinned Undeployed V2', () => {
    const manager = new AutoblocksPromptManagerV2({
      appName: APP_SLUG,
      id: 'prompt-basic',
      version: {
        major: 'dangerously-use-undeployed',
        minor: 'uovqyxlvbmlkk4jypeusptcd',
      },
      initTimeout: { seconds: 5 },
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
          id: 'prompt-basic',
          version: 'revision:kaqp7i3mnq5ra21km8cs8two',
          templates: [
            {
              id: 'template-c',
              template: 'New Revision!',
            },
          ],
          params: {
            params: {
              maxCompletionTokens: 256,
              model: 'gpt-4o',
            },
          },
          tools: [],
        });
      });
    });
  });
});
