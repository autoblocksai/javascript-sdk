import { parseAndSortPromptsV2 } from '../../../src/prompts-cli/v2/parsers';
import { PromptTypeFromAPI } from '../../../src/prompts-cli/v2/types';

describe('Parsers', () => {
  describe('parseAndSortPromptsV2', () => {
    it('should normalize app names correctly', () => {
      const mockPromptTypesV2Response: PromptTypeFromAPI[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          appName: 'My App!',
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [],
              toolsParams: [],
            },
          ],
        },
        {
          id: 'prompt-b',
          appId: 'app-2',
          appName: "Her's App!!!",
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [],
              toolsParams: [],
            },
          ],
        },
      ];

      const prompts = parseAndSortPromptsV2(mockPromptTypesV2Response);

      expect(prompts[0].appName).toBe('my-app');
      expect(prompts[1].appName).toBe('hers-app');
    });

    it('should parse templates correctly', () => {
      const mockPromptTypesV2Response: PromptTypeFromAPI[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          appName: 'test-app',
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [
                {
                  id: 'template-a',
                  template: 'Hello {{name}}! The weather is {{weather}} today.',
                },
              ],
              toolsParams: [],
            },
          ],
        },
      ];

      const prompts = parseAndSortPromptsV2(mockPromptTypesV2Response);

      expect(prompts[0].majorVersions[0].templates[0].placeholders).toEqual([
        'name',
        'weather',
      ]);
    });

    it('should parse tools correctly', () => {
      const mockPromptTypesV2Response: PromptTypeFromAPI[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          appName: 'test-app',
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [],
              toolsParams: [
                {
                  name: 'myFunc',
                  params: ['description', 'type?'],
                },
              ],
            },
          ],
        },
      ];

      const prompts = parseAndSortPromptsV2(mockPromptTypesV2Response);

      expect(prompts[0].majorVersions[0].tools[0]).toEqual({
        name: 'myFunc',
        placeholders: ['description', 'type?'],
      });
    });

    it('should parse params correctly', () => {
      const mockPromptTypesV2Response: PromptTypeFromAPI[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          appName: 'test-app',
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [],
              toolsParams: [],
              params: {
                params: {
                  frequencyPenalty: 0,
                  maxTokens: 256,
                  model: 'gpt-4',
                },
              },
            },
          ],
        },
      ];

      const prompts = parseAndSortPromptsV2(mockPromptTypesV2Response);

      expect(prompts[0].majorVersions[0].params).toEqual({
        frequencyPenalty: 0,
        maxTokens: 256,
        model: 'gpt-4',
      });
    });

    it('should sort prompts by ID', () => {
      const mockPromptTypesV2Response: PromptTypeFromAPI[] = [
        {
          id: 'prompt-b',
          appId: 'app-1',
          appName: 'test-app',
          majorVersions: [],
        },
        {
          id: 'prompt-a',
          appId: 'app-1',
          appName: 'test-app',
          majorVersions: [],
        },
      ];

      const prompts = parseAndSortPromptsV2(mockPromptTypesV2Response);

      expect(prompts[0].id).toBe('prompt-a');
      expect(prompts[1].id).toBe('prompt-b');
    });
  });
});
