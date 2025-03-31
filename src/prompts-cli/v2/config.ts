import { AutogenerationConfigV2, ParsedPromptV2 } from './types';
import { RevisionSpecialVersionsEnum } from '../../util';
import { makeTypeScriptTypeFromValue, sortBy } from '../util';

export const autogenerationConfigsV2: AutogenerationConfigV2[] = [
  {
    symbolName: '__Autogenerated__PromptsV2Types',
    symbolType: 'interface',
    filesToModify: ['../prompts/index.d.ts', '../prompts/index.d.mts'],
    generate: (args) => {
      // Group prompts by appId and get app names
      const promptsByApp: Record<string, ParsedPromptV2[]> = {};
      const appNameToId: Record<string, string> = {};

      args.prompts.forEach((prompt) => {
        if (!promptsByApp[prompt.appId]) {
          promptsByApp[prompt.appId] = [];
        }
        promptsByApp[prompt.appId].push(prompt);

        // Map app name to ID
        appNameToId[prompt.slug] = prompt.appId;
      });

      let generated = `// App name to ID mapping
declare const APP_NAME_TO_ID: {
  readonly ${Object.entries(appNameToId)
    .map(([name, id]) => `"${name}": "${id}"`)
    .join(';\n  readonly ')};
};

// Type for app names
export type AppName = keyof typeof APP_NAME_TO_ID;

// Main prompts interface using app names
interface ${args.symbolName} {
`;

      // Generate using app names instead of IDs
      Object.entries(appNameToId).forEach(([appName, appId]) => {
        generated += `\n  '${appName}': {`;

        // Generate prompt IDs for this app
        promptsByApp[appId].forEach((prompt) => {
          generated += `\n    '${prompt.id}': {`;

          // Use `any` for undeployed version
          generated += `\n      '${RevisionSpecialVersionsEnum.DANGEROUSLY_USE_UNDEPLOYED}': {`;
          generated += `\n        templates: any;`;
          generated += `\n        params: any;`;
          generated += `\n        tools: any;`;
          generated += `\n        minorVersions: any;`;
          generated += `\n      };`;

          // Generate major versions
          prompt.majorVersions.forEach(
            (version: ParsedPromptV2['majorVersions'][0]) => {
              generated += `\n      '${version.majorVersion}': {`;

              // Generate templates
              generated += `\n        templates: {`;
              version.templates.forEach(
                (
                  template: ParsedPromptV2['majorVersions'][0]['templates'][0],
                ) => {
                  if (template.placeholders.length > 0) {
                    generated += `\n          '${template.id}': {`;
                    template.placeholders.forEach((placeholder: string) => {
                      if (placeholder.endsWith('?')) {
                        generated += `\n            '${placeholder.slice(0, -1)}'?: string;`;
                      } else {
                        generated += `\n            '${placeholder}': string;`;
                      }
                    });
                    generated += '\n          };';
                  } else {
                    generated += `\n          '${template.id}': Record<PropertyKey, never>;`;
                  }
                },
              );
              generated += '\n        };';

              // Generate params
              if (version.params) {
                generated += `\n        params: {`;
                sortBy(Object.keys(version.params), (k) => k).forEach((key) => {
                  const val = version.params ? version.params[key] : undefined;
                  const valType = makeTypeScriptTypeFromValue(val);
                  if (!valType) {
                    return;
                  }
                  generated += `\n          '${key}': ${valType};`;
                });
                generated += '\n        };';
              } else {
                generated += '\n        params: never;';
              }

              // Generate tools
              if (version.tools.length > 0) {
                generated += `\n        tools: {`;
                version.tools.forEach(
                  (tool: ParsedPromptV2['majorVersions'][0]['tools'][0]) => {
                    if (tool.placeholders.length > 0) {
                      generated += `\n          '${tool.name}': {`;
                      tool.placeholders.forEach((placeholder: string) => {
                        if (placeholder.endsWith('?')) {
                          generated += `\n            '${placeholder.slice(0, -1)}'?: string;`;
                        } else {
                          generated += `\n            '${placeholder}': string;`;
                        }
                      });
                      generated += '\n          };';
                    } else {
                      generated += `\n          '${tool.name}': Record<PropertyKey, never>;`;
                    }
                  },
                );
                generated += '\n        };';
              } else {
                generated += '\n        tools: never;';
              }

              // Add minor versions
              generated += `\n        minorVersions: '${[
                ...version.minorVersions,
                RevisionSpecialVersionsEnum.LATEST,
              ].join(`' | '`)}';`;

              generated += '\n      };';
            },
          );

          generated += '\n    };';
        });

        generated += '\n  };';
      });

      return generated + `\n}`;
    },
  },
];
