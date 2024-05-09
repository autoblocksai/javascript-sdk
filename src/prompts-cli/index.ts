import fs from 'fs/promises';
import { z } from 'zod';
import {
  readEnv,
  AutoblocksEnvVar,
  RevisionSpecialVersionsEnum,
  AUTOBLOCKS_HEADERS,
  API_ENDPOINT,
} from '../util';
import { zPromptSchema, type Prompt } from '../types';

interface ParsedTemplate {
  id: string;
  content: string;
  // TODO: this should be done in the API and returned in the
  // response instead of making each SDK's CLI do it
  placeholders: string[];
}

interface ParsedPrompt {
  id: string;
  majorVersion: string;
  minorVersion: string;
  templates: ParsedTemplate[];
  params?: Record<string, unknown>;
}

type SymbolType = 'interface' | 'variable';

interface AutogenerationConfig {
  // The name of the symbol we're autogenerating.
  symbolName: string;
  // Whether the symbol is a TS interface or a JS variable
  symbolType: SymbolType;
  // The files where the symbol lives and where we'll insert the autogenerated content.
  filesToModify: string[];
  // The function that generates the content to insert.
  generate: (args: { symbolName: string; prompts: ParsedPrompt[] }) => string;
}

export const autogenerationConfigs: AutogenerationConfig[] = [
  {
    symbolName: '__Autogenerated__PromptsTypes',
    symbolType: 'interface',
    filesToModify: ['../prompts/index.d.ts', '../prompts/index.d.mts'],
    generate: (args) => {
      // Make map of prompt ID -> major version -> { templates, params, minorVersions }
      let generated = `interface ${args.symbolName} {`;

      Object.entries(groupBy(args.prompts, (prompt) => prompt.id)).forEach(
        ([promptId, promptsById]) => {
          generated += `\n  '${promptId}': {`;

          // Use `any` for everything when version is set to `undeployed`.
          // Allows the user to use any template or model params while
          // working with an undeployed prompt in the UI
          generated += `\n    '${RevisionSpecialVersionsEnum.DANGEROUSLY_USE_UNDEPLOYED}': {`;
          generated += `\n      templates: any;`;
          generated += `\n      params: any;`;
          generated += `\n      minorVersions: any;`;
          generated += `\n    };`;

          Object.entries(
            groupBy(promptsById, (prompt) => prompt.majorVersion),
          ).forEach(([majorVersion, promptsByMajorVersion]) => {
            generated += `\n    '${majorVersion}': {`;

            // The templates and params should all be the same within a major version,
            // so just pick one to generate those types.
            const prompt = promptsByMajorVersion[0];

            if (!prompt) {
              return;
            }

            generated += `\n      templates: {`;
            prompt.templates.forEach((template) => {
              if (template.placeholders.length > 0) {
                generated += `\n        '${template.id}': {`;
                template.placeholders.forEach((placeholder) => {
                  if (placeholder.endsWith('?')) {
                    generated += `\n          '${placeholder.slice(
                      0,
                      -1,
                    )}'?: string;`;
                  } else {
                    generated += `\n          '${placeholder}': string;`;
                  }
                });
                generated += '\n        };';
              } else {
                generated += `\n        '${template.id}': Record<PropertyKey, never>;`;
              }
            });

            generated += '\n      };';

            if (prompt.params) {
              generated += `\n      params: {`;
              sortBy(Object.keys(prompt.params), (k) => k).forEach((key) => {
                const val = prompt.params ? prompt.params[key] : undefined;
                const valType = makeTypeScriptTypeFromValue(val);
                if (!valType) {
                  return;
                }
                generated += `\n        '${key}': ${valType};`;
              });
              generated += '\n      };';
            } else {
              generated += '\n      params: never;';
            }

            // Add type for minor versions
            const minorVersions = promptsByMajorVersion.map(
              (prompt) => prompt.minorVersion,
            );
            minorVersions.push(RevisionSpecialVersionsEnum.LATEST);

            generated += `\n      minorVersions: '${minorVersions
              .sort()
              .join(`' | '`)}';`;

            generated += '\n    };';
          });

          generated += '\n  };';
        },
      );

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
  } else if (Array.isArray(val) && val.length > 0) {
    const item = val[0];
    return `Array<${makeTypeScriptTypeFromValue(item)}>`;
  }

  return undefined;
}

function groupBy<T, V extends string | number | symbol>(
  array: T[],
  getVal: (item: T) => V,
): Record<V, T[]> {
  return array.reduce(
    (accumulator, currentValue) => {
      const key = getVal(currentValue);
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(currentValue);
      return accumulator;
    },
    {} as Record<V, T[]>,
  );
}

function sortBy<T, V extends string | number>(
  array: T[],
  getVal: (item: T) => V,
): T[] {
  return [...array].sort((a, b) => (getVal(a) < getVal(b) ? -1 : 1));
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

function parseTemplate(args: { id: string; content: string }): ParsedTemplate {
  // Find all placeholder names in the template. They look like: {{ placeholder }}
  // They can have arbitrary whitespace between the leading {{ and trailing }},
  // so e.g. {{placeholder}} is also valid.
  const placeholders = args.content.match(/\{\{\s*\S+\s*\}\}/g);

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

async function getAllPromptsFromAPI(args: {
  apiKey: string;
}): Promise<ParsedPrompt[]> {
  const resp = await fetch(`${API_ENDPOINT}/prompts`, {
    method: 'GET',
    headers: {
      ...AUTOBLOCKS_HEADERS,
      Authorization: `Bearer ${args.apiKey}`,
    },
  });
  const data = await resp.json();
  const prompts = z.array(zPromptSchema).parse(data);
  return parseAndSortPrompts(prompts);
}

/**
 * Sorts and parses the placeholders out of the prompts retrieved from the API.
 */
export function parseAndSortPrompts(prompts: Prompt[]): ParsedPrompt[] {
  return sortBy(
    prompts.map((prompt) => {
      const [majorVersion, minorVersion] = prompt.version.split('.');
      return {
        id: prompt.id,
        majorVersion,
        minorVersion,
        params: prompt.params?.params,
        templates: sortBy(
          prompt.templates.map((template) => {
            return parseTemplate({
              id: template.id,
              content: template.template,
            });
          }),
          (t) => t.id,
        ),
      };
    }),
    (p) => p.id,
  );
}

async function handleConfig(args: {
  config: AutogenerationConfig;
  prompts: ParsedPrompt[];
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
      const content = await fs.readFile(filepath, 'utf-8');
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
    }),
  );
}

export async function run(): Promise<void> {
  const startTime = performance.now();

  const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
  if (!apiKey) {
    throw new Error(
      `You must set the ${AutoblocksEnvVar.AUTOBLOCKS_API_KEY} environment variable to generate types for your prompts.`,
    );
  }

  const prompts = await getAllPromptsFromAPI({ apiKey });

  if (prompts.length === 0) {
    console.log('No prompts found.');
    return;
  }

  // NOTE: Do not run in Promise.all, these can't run
  // concurrently because they modify the same files.
  for (const config of autogenerationConfigs) {
    await handleConfig({
      config,
      prompts: prompts,
    });
  }

  const duration = performance.now() - startTime;
  console.log(`✓ Compiled in ${duration}ms (${prompts.length} prompts)`);
}
