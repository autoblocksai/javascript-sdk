import { ParsedPromptV2, PromptTypeFromAPI } from './types';
import { parseTemplate, sortBy, normalizeAppName } from './utils';

export function parseAndSortPromptsV2(
  promptTypes: PromptTypeFromAPI[],
): ParsedPromptV2[] {
  return sortBy(
    promptTypes.map((prompt) => {
      return {
        id: prompt.id,
        appId: prompt.appId,
        appName: normalizeAppName(prompt.appName),
        majorVersions: prompt.majorVersions.map((version) => {
          return {
            majorVersion: version.majorVersion,
            minorVersions: version.minorVersions,
            templates: sortBy(
              version.templates.map((template) => {
                return parseTemplate({
                  id: template.id,
                  content: template.template,
                });
              }),
              (t) => t.id,
            ),
            params: version.params?.params,
            tools: version.toolsParams.map((tool) => ({
              name: tool.name,
              placeholders: tool.params,
            })),
          };
        }),
      };
    }),
    (p) => p.id,
  );
}
