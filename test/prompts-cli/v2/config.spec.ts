import { autogenerationConfigsV2 } from '../../../src/prompts-cli/v2/config';
import { ParsedPromptV2 } from '../../../src/prompts-cli/v2/types';
import { RevisionSpecialVersionsEnum } from '../../../src/util';

describe('Config', () => {
  describe('autogenerationConfigsV2', () => {
    it('should generate types with app name to ID mapping', () => {
      const mockPrompts: ParsedPromptV2[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          slug: 'customer-service',
          majorVersions: [
            {
              majorVersion: '1',
              minorVersions: ['0'],
              templates: [
                {
                  id: 'template-a',
                  content: 'Hello {{name}}! The weather is {{weather}} today.',
                  placeholders: ['name', 'weather'],
                },
              ],
              params: {
                frequencyPenalty: 0,
                maxCompletionTokens: 256,
                model: 'gpt-4',
              },
              tools: [
                {
                  name: 'myFunc',
                  placeholders: ['description'],
                },
              ],
            },
          ],
        },
      ];

      const config = autogenerationConfigsV2[0];
      const generated = config.generate({
        symbolName: config.symbolName,
        prompts: mockPrompts,
      });

      // Check for app name to ID mapping
      expect(generated).toContain('declare const APP_NAME_TO_ID: {');
      expect(generated).toContain('"customer-service": "app-1"');

      // Check for app names in the interface
      expect(generated).toContain("'customer-service':");

      // Check for prompt IDs
      expect(generated).toContain("'prompt-a':");

      // Check for major versions
      expect(generated).toContain("'1':");

      // Check for templates
      expect(generated).toContain("'template-a':");
      expect(generated).toContain("'name': string;");
      expect(generated).toContain("'weather': string;");

      // Check for tools
      expect(generated).toContain("'myFunc':");
      expect(generated).toContain("'description': string;");

      // Check for params
      expect(generated).toContain("'frequencyPenalty': number;");
      expect(generated).toContain("'maxCompletionTokens': number;");
      expect(generated).toContain("'model': string;");

      // Check for minorVersions
      expect(generated).toContain(
        `minorVersions: '0' | '${RevisionSpecialVersionsEnum.LATEST}';`,
      );
    });

    it('should handle empty major versions', () => {
      const mockPrompts: ParsedPromptV2[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          slug: 'test-app',
          majorVersions: [],
        },
      ];

      const config = autogenerationConfigsV2[0];
      const generated = config.generate({
        symbolName: config.symbolName,
        prompts: mockPrompts,
      });

      expect(generated).toContain("'test-app':");
      expect(generated).toContain("'prompt-a':");
    });

    it('should handle multiple prompts per app', () => {
      const mockPrompts: ParsedPromptV2[] = [
        {
          id: 'prompt-a',
          appId: 'app-1',
          slug: 'test-app',
          majorVersions: [],
        },
        {
          id: 'prompt-b',
          appId: 'app-1',
          slug: 'test-app',
          majorVersions: [],
        },
      ];

      const config = autogenerationConfigsV2[0];
      const generated = config.generate({
        symbolName: config.symbolName,
        prompts: mockPrompts,
      });

      expect(generated).toContain("'test-app':");
      expect(generated).toContain("'prompt-a':");
      expect(generated).toContain("'prompt-b':");
    });
  });
});
