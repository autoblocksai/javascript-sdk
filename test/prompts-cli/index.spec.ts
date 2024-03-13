import { zHeadlessPromptSchema } from '../../src/common/models';
import {
  parseAndSortHeadlessPrompts,
  autogenerationConfigs,
} from '../../src/server/prompts-cli';
import { z } from 'zod';

describe('Prompts CLI', () => {
  describe('__Autogenerated__HeadlessPromptsTypes', () => {
    it('should autogenerate types', () => {
      const mockHeadlessPrompts = [
        {
          id: 'prompt-a',
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
            version: '1.0',
          },
          templates: [
            {
              id: 'template-a',
              template:
                'Hello, {{ name }}! The weather is {{ weather }} today.',
              version: '1.0',
            },
            {
              id: 'template-b',
              template: 'Hello, {{ optional? }}! My name is {{ name }}.',
              version: '1.0',
            },
          ],
          version: '1.0',
        },
        {
          id: 'prompt-b',
          templates: [
            {
              id: 'template-a',
              template:
                'Hello, {{ name }}! The weather is {{ weather }} today.',
              version: '1.0',
            },
            {
              id: 'template-b',
              template: 'Hello, {{ optional? }}! My name is {{ name }}.',
              version: '1.0',
            },
            {
              id: 'template-c',
              template: 'I am template c and I have no params',
              version: '1.0',
            },
          ],
          version: '2.0',
        },
        {
          id: 'prompt-b',
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
            version: '1.1',
          },
          templates: [
            {
              id: 'template-a',
              template:
                'Hello, {{ name }}! The weather is {{ weather }} today.',
              version: '1.0',
            },
            {
              id: 'template-b',
              template: 'Hello, {{ optional? }}! My name is {{ name }}.',
              version: '1.0',
            },
          ],
          version: '1.1',
        },
        {
          id: 'prompt-b',
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
            version: '1.0',
          },
          templates: [
            {
              id: 'template-a',
              template:
                'Hello, {{ name }}! The weather is {{ weather }} today.',
              version: '1.0',
            },
            {
              id: 'template-b',
              template: 'Hello, {{ optional? }}! My name is {{ name }}.',
              version: '1.0',
            },
          ],
          version: '1.0',
        },
      ];

      const symbolName = '__Autogenerated__HeadlessPromptsTypes';
      const config = autogenerationConfigs.find(
        (config) => config.symbolName === symbolName,
      );
      const headlessPrompts = parseAndSortHeadlessPrompts(
        z.array(zHeadlessPromptSchema).parse(mockHeadlessPrompts),
      );
      const autogenerated = config?.generate({
        symbolName,
        localPrompts: [],
        headlessPrompts,
      });

      expect(autogenerated).toEqual(
        `interface __Autogenerated__HeadlessPromptsTypes {
  'prompt-a': {
    'dangerously-use-undeployed': {
      templates: any;
      modelParams: any;
      minorVersions: any;
    };
    '1': {
      templates: {
        'template-a': {
          'name': string;
          'weather': string;
        };
        'template-b': {
          'name': string;
          'optional'?: string;
        };
      };
      modelParams: {
        'frequencyPenalty': number;
        'maxTokens': number;
        'model': string;
        'presencePenalty': number;
        'temperature': number;
        'topP': number;
      };
      minorVersions: '0' | 'latest';
    };
  };
  'prompt-b': {
    'dangerously-use-undeployed': {
      templates: any;
      modelParams: any;
      minorVersions: any;
    };
    '1': {
      templates: {
        'template-a': {
          'name': string;
          'weather': string;
        };
        'template-b': {
          'name': string;
          'optional'?: string;
        };
      };
      modelParams: {
        'frequencyPenalty': number;
        'maxTokens': number;
        'model': string;
        'presencePenalty': number;
        'temperature': number;
        'topP': number;
      };
      minorVersions: '0' | '1' | 'latest';
    };
    '2': {
      templates: {
        'template-a': {
          'name': string;
          'weather': string;
        };
        'template-b': {
          'name': string;
          'optional'?: string;
        };
        'template-c': Record<PropertyKey, never>;
      };
      modelParams: never;
      minorVersions: '0' | 'latest';
    };
  };
}`,
      );
    });
  });
});
