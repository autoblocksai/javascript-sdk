import fs from 'fs/promises';
import {
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
  API_ENDPOINT,
  RevisionSpecialVersionsEnum,
} from '../util';
import { ParsedDataset, PropertySchema, PropertyTypesEnum } from './types';

type SymbolType = 'interface' | 'variable';

interface AutogenerationConfig {
  // The name of the symbol we're autogenerating.
  symbolName: string;
  // Whether the symbol is a TS interface or a JS variable
  symbolType: SymbolType;
  // The files where the symbol lives and where we'll insert the autogenerated content.
  filesToModify: string[];
  // The function that generates the content to insert.
  generate: (args: { symbolName: string; datasets: ParsedDataset[] }) => string;
}

export const autogenerationConfigs: AutogenerationConfig[] = [
  {
    symbolName: '__Autogenerated__DatasetsTypes',
    symbolType: 'interface',
    filesToModify: ['../datasets/index.d.ts', '../datasets/index.d.mts'],
    generate: (args) => {
      let generated = `interface ${args.symbolName} {`;

      args.datasets.forEach((dataset) => {
        generated += `\n  '${dataset.id}': {`; // start of dataset definition

        generated += `\n    '${RevisionSpecialVersionsEnum.LATEST}': object;`;

        dataset.schemaVersions.forEach((schemaVersion) => {
          generated += `\n    '${schemaVersion.version}': {`; // start of schema version definition
          schemaVersion.schema.forEach((property) => {
            generated += `\n      '${property.name}'${property.required ? '' : '?'}: ${makeTypeForProperty({ property })};`;
          });
          generated += '\n    };'; // end of schema version definition
        });

        generated += '\n  };'; // end of dataset definition
      });

      generated += '\n}';
      return generated;
    },
  },
];

function makeTypeForProperty(args: { property: PropertySchema }): string {
  switch (args.property.type) {
    case PropertyTypesEnum.String:
      return 'string';
    case PropertyTypesEnum.Number:
      return 'number';
    case PropertyTypesEnum.Boolean:
      return 'boolean';
    case PropertyTypesEnum.Select:
      return args.property.options.map((option) => `'${option}'`).join(' | ');
    case PropertyTypesEnum.MultiSelect:
      return `(${args.property.options.map((option) => `'${option}'`).join(' | ')})[]`;
    case PropertyTypesEnum.ValidJSON:
      return 'Record<string, unknown>';
  }
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

async function getAllDatasetSchemasFromAPI(args: {
  apiKey: string;
}): Promise<ParsedDataset[]> {
  const resp = await fetch(`${API_ENDPOINT}/datasets/schemas`, {
    method: 'GET',
    headers: {
      ...AUTOBLOCKS_HEADERS,
      Authorization: `Bearer ${args.apiKey}`,
    },
  });
  return await resp.json();
}

async function handleConfig(args: {
  config: AutogenerationConfig;
  datasets: ParsedDataset[];
}): Promise<void> {
  const { startComment, endComment } = makeCommentsFor(args.config.symbolName);
  const generated = args.config.generate({
    symbolName: args.config.symbolName,
    datasets: args.datasets,
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
      `You must set the ${AutoblocksEnvVar.AUTOBLOCKS_API_KEY} environment variable to generate types for your datasets.`,
    );
  }

  const datasets = await getAllDatasetSchemasFromAPI({ apiKey });

  if (datasets.length === 0) {
    console.log('No dataset schemas found.');
    return;
  }

  // NOTE: Do not run in Promise.all, these can't run
  // concurrently because they modify the same files.
  for (const config of autogenerationConfigs) {
    await handleConfig({
      config,
      datasets,
    });
  }

  const duration = performance.now() - startTime;
  console.log(
    `✓ Compiled in ${duration.toFixed(2)}ms (${datasets.length} datasets)`,
  );
}
