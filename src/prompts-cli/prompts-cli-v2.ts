import fs from 'fs/promises';
import {
  readEnv,
  AutoblocksEnvVar,
  RevisionSpecialVersionsEnum,
  AUTOBLOCKS_HEADERS,
  V2_API_ENDPOINT,
} from '../util';

interface ParsedTemplate {
  id: string;
  content: string;
  placeholders: string[];
}

interface ParsedPromptV2 {
  id: string;
  appId: string;
  majorVersions: {
    majorVersion: string;
    minorVersions: string[];
    templates: ParsedTemplate[];
    params?: Record<string, unknown>;
    tools: { name: string; placeholders: string[] }[];
  }[];
}

type SymbolType = 'interface' | 'variable';

interface AutogenerationConfigV2 {
  symbolName: string;
  symbolType: SymbolType;
  filesToModify: string[];
  generate: (args: { symbolName: string; prompts: ParsedPromptV2[] }) => string;
}

export const autogenerationConfigsV2: AutogenerationConfigV2[] = [
  {
    symbolName: '__Autogenerated__PromptsV2Types',
    symbolType: 'interface',
    filesToModify: ['../prompts/index.d.ts', '../prompts/index.d.mts'],
    generate: (args) => {
      // Group prompts by appId
      const promptsByApp: Record<string, ParsedPromptV2[]> = {};
      args.prompts.forEach((prompt) => {
        if (!promptsByApp[prompt.appId]) {
          promptsByApp[prompt.appId] = [];
        }
        promptsByApp[prompt.appId].push(prompt);
      });

      let generated = `interface ${args.symbolName} {`;

      // Generate app IDs
      Object.keys(promptsByApp).forEach((appId) => {
        generated += `\n  '${appId}': {`;

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
          prompt.majorVersions.forEach((version) => {
            generated += `\n      '${version.majorVersion}': {`;

            // Generate templates
            generated += `\n        templates: {`;
            version.templates.forEach((template) => {
              if (template.placeholders.length > 0) {
                generated += `\n          '${template.id}': {`;
                template.placeholders.forEach((placeholder) => {
                  if (placeholder.endsWith('?')) {
                    generated += `\n            '${placeholder.slice(
                      0,
                      -1,
                    )}'?: string;`;
                  } else {
                    generated += `\n            '${placeholder}': string;`;
                  }
                });
                generated += '\n          };';
              } else {
                generated += `\n          '${template.id}': Record<PropertyKey, never>;`;
              }
            });
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
              version.tools.forEach((tool) => {
                if (tool.placeholders.length > 0) {
                  generated += `\n          '${tool.name}': {`;
                  tool.placeholders.forEach((placeholder) => {
                    if (placeholder.endsWith('?')) {
                      generated += `\n            '${placeholder.slice(
                        0,
                        -1,
                      )}'?: string;`;
                    } else {
                      generated += `\n            '${placeholder}': string;`;
                    }
                  });
                  generated += '\n          };';
                } else {
                  generated += `\n          '${tool.name}': Record<PropertyKey, never>;`;
                }
              });
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
          });

          generated += '\n    };';
        });

        generated += '\n  };';
      });

      return generated + `\n}`;
    },
  },
];

/**
 * This is not exhaustive but should handle all of the possible types
 * for the model params.
 */
function makeTypeScriptTypeFromValue(val: unknown): string | undefined {
  if (typeof val === 'string') {
    return 'string';
  } else if (typeof val === 'number') {
    return 'number';
  } else if (typeof val === 'boolean') {
    return 'boolean';
  } else if (Array.isArray(val)) {
    if (val.length === 0) {
      return 'Array<never>';
    }
    const item = val[0];
    return `Array<${makeTypeScriptTypeFromValue(item)}>`;
  } else if (typeof val === 'object' && val !== null) {
    let result = '{';
    for (const [key, value] of Object.entries(val)) {
      const type = makeTypeScriptTypeFromValue(value);
      if (type) {
        result += `\n          '${key}': ${type};`;
      }
    }
    result += '\n        }';
    return result;
  }

  return undefined;
}

function sortBy<T, V extends string | number>(
  array: T[],
  getVal: (item: T) => V,
): T[] {
  return [...array].sort((a, b) => (getVal(a) < getVal(b) ? -1 : 1));
}

function parseTemplate(args: { id: string; content: string }): ParsedTemplate {
  // Find all placeholder names in the template. They look like: {{ placeholder }}
  // They can have arbitrary whitespace between the leading {{ and trailing }},
  // so e.g. {{placeholder}} is also valid.
  const placeholders = args.content.match(/\{\{\s*[\w-]+\s*\}\}/g);

  // Get the placeholder names, e.g. `placeholder` from `{{ placeholder }}`
  // by removing the `{{` and `}}` on each side and trimming off the whitespace.
  const placeholderNames = (placeholders ?? []).map((placeholder) => {
    return placeholder.slice(2, -2).trim();
  });
  const uniquePlaceholderNames = Array.from(new Set(placeholderNames)).sort();

  return {
    id: args.id,
    content: args.content,
    placeholders: uniquePlaceholderNames,
  };
}

/**
 * These comments are added by our autogeneration script before
 * and after the autogenerated segment so that we can find
 * the start and end indexes of the segment in the file later
 * on subsequent runs.
 */
function makeCommentsFor(name: string): {
  startComment: string;
  endComment: string;
} {
  return {
    startComment: `// ${name} start`,
    endComment: `// ${name} end`,
  };
}

/**
 * Determine the start and end indexes of the autogenerated segment.
 */
function determineStartAndEndIdx(args: {
  symbolName: string;
  symbolType: SymbolType;
  startComment: string;
  endComment: string;
  content: string;
}): {
  startIdx: number;
  endIdx: number;
} {
  const startCommentIdx = args.content.indexOf(args.startComment);
  const endCommentIdx = args.content.indexOf(args.endComment);
  if (startCommentIdx !== -1 && endCommentIdx !== -1) {
    // The autogeneration CLI has been run before.
    return {
      startIdx: startCommentIdx,
      endIdx: endCommentIdx + args.endComment.length,
    };
  }

  // The autogeneration CLI is being run for the first time.
  // Search for what the symbol looks like before autogeneration;
  // that will be the start and end indexes of where we will insert
  // the autogenerated content.
  const symbolAppearanceBeforeAutogeneration =
    args.symbolType === 'interface'
      ? `interface ${args.symbolName} {\n}`
      : `var ${args.symbolName} = {};`;
  const firstTimeAppearance = args.content.indexOf(
    symbolAppearanceBeforeAutogeneration,
  );
  if (firstTimeAppearance !== -1) {
    return {
      startIdx: firstTimeAppearance,
      endIdx: firstTimeAppearance + symbolAppearanceBeforeAutogeneration.length,
    };
  }

  throw new Error(
    `Couldn't find ${symbolAppearanceBeforeAutogeneration} in ${args.content}`,
  );
}

export async function getAllPromptsFromV2API(args: {
  apiKey: string;
}): Promise<ParsedPromptV2[]> {
  const resp = await fetch(`${V2_API_ENDPOINT}/prompts/types`, {
    method: 'GET',
    headers: {
      ...AUTOBLOCKS_HEADERS,
      Authorization: `Bearer ${args.apiKey}`,
    },
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch from V2 API: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = await resp.json();
  return parseAndSortPromptsV2(data);
}

/**
 * Sorts and parses the placeholders out of the prompts retrieved from the V2 API.
 */
export function parseAndSortPromptsV2(
  promptTypes: {
    id: string;
    appId: string;
    majorVersions: {
      majorVersion: string;
      minorVersions: string[];
      templates: {
        id: string;
        template: string;
      }[];
      params?: { params: Record<string, unknown> };
      toolsParams: { name: string; params: string[] }[];
    }[];
  }[],
): ParsedPromptV2[] {
  return sortBy(
    promptTypes.map((prompt) => {
      return {
        id: prompt.id,
        appId: prompt.appId,
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

export async function handleConfigV2(args: {
  config: AutogenerationConfigV2;
  prompts: ParsedPromptV2[];
}): Promise<void> {
  const { startComment, endComment } = makeCommentsFor(args.config.symbolName);
  const generated = args.config.generate({
    symbolName: args.config.symbolName,
    prompts: args.prompts,
  });

  const contentToInsert = `${startComment}\n${generated}\n${endComment}\n`;

  await Promise.all(
    args.config.filesToModify.map(async (filename) => {
      const filepath = `${__dirname}/${filename}`;

      // Check if file exists, if not create it with empty interface
      try {
        await fs.access(filepath);
      } catch (error) {
        console.warn(`Error accessing file: ${error}`);

        // File doesn't exist, create it with empty interface
        const initialContent = `// This file is auto-generated by the prompts-cli
// DO NOT EDIT MANUALLY

interface ${args.config.symbolName} {}\n`;
        await fs.writeFile(filepath, initialContent);
      }

      const content = await fs.readFile(filepath, 'utf-8');

      try {
        const { startIdx, endIdx } = determineStartAndEndIdx({
          symbolName: args.config.symbolName,
          symbolType: args.config.symbolType,
          startComment,
          endComment,
          content,
        });

        const newContent =
          content.slice(0, startIdx) + contentToInsert + content.slice(endIdx);
        await fs.writeFile(filepath, newContent);
      } catch (error) {
        console.warn(`Error determining start and end indexes: ${error}`);
        // If we can't find the interface, append it to the file
        await fs.writeFile(filepath, content + '\n' + contentToInsert);
      }
    }),
  );
}

export async function runV2(): Promise<void> {
  const startTime = performance.now();

  const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);

  if (!apiKey) {
    throw new Error(
      `You must set the ${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY} environment variable to generate types for your prompts.`,
    );
  }

  console.log('Fetching prompts from V2 API...');
  // Fetch prompts from V2 API
  const promptsV2 = await getAllPromptsFromV2API({ apiKey });
  console.log(`Found ${promptsV2.length} prompts in V2 API`);

  if (promptsV2.length === 0) {
    console.warn('No prompts found in V2 API. Check your API key permissions.');
    return;
  }

  // Process V2 prompts
  for (const config of autogenerationConfigsV2) {
    await handleConfigV2({
      config,
      prompts: promptsV2,
    });
  }

  const duration = performance.now() - startTime;
  console.log(
    `✓ Compiled in ${duration.toFixed(2)}ms (${promptsV2.length} prompts from V2 API)`,
  );
}
