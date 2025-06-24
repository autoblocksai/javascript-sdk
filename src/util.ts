import type { SymbolType, TimeDelta } from './types';
import packageJson from '../package.json';

export enum AutoblocksEnvVar {
  AUTOBLOCKS_API_KEY = 'AUTOBLOCKS_API_KEY',
  AUTOBLOCKS_V2_API_KEY = 'AUTOBLOCKS_V2_API_KEY',
  AUTOBLOCKS_V2_API_ENDPOINT = 'AUTOBLOCKS_V2_API_ENDPOINT',
  AUTOBLOCKS_INGESTION_KEY = 'AUTOBLOCKS_INGESTION_KEY',
  AUTOBLOCKS_TRACER_THROW_ON_ERROR = 'AUTOBLOCKS_TRACER_THROW_ON_ERROR',
  AUTOBLOCKS_CLI_SERVER_ADDRESS = 'AUTOBLOCKS_CLI_SERVER_ADDRESS',
  AUTOBLOCKS_FILTERS_TEST_SUITES = 'AUTOBLOCKS_FILTERS_TEST_SUITES',
  AUTOBLOCKS_OVERRIDES = 'AUTOBLOCKS_OVERRIDES',
  AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS = 'AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS',
  AUTOBLOCKS_OVERRIDES_CONFIG_REVISIONS = 'AUTOBLOCKS_OVERRIDES_CONFIG_REVISIONS',
  AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES = 'AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES',
  AUTOBLOCKS_CI_TEST_RUN_BUILD_ID = 'AUTOBLOCKS_CI_TEST_RUN_BUILD_ID',
  AUTOBLOCKS_SLACK_WEBHOOK_URL = 'AUTOBLOCKS_SLACK_WEBHOOK_URL',
  AUTOBLOCKS_TEST_RUN_MESSAGE = 'AUTOBLOCKS_TEST_RUN_MESSAGE',
  AUTOBLOCKS_DISABLE_GITHUB_COMMENT = 'AUTOBLOCKS_DISABLE_GITHUB_COMMENT',
}

export const INGESTION_ENDPOINT = 'https://ingest-event.autoblocks.ai';
export const API_ENDPOINT = 'https://api.autoblocks.ai';
export const V2_API_ENDPOINT =
  process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_ENDPOINT] ||
  'https://api-v2.autoblocks.ai';

export enum ThirdPartyEnvVar {
  OPENAI_API_KEY = 'OPENAI_API_KEY',
  GITHUB_TOKEN = 'GITHUB_TOKEN',
}

export const readEnv = (key: string): string | undefined => {
  return process.env[key];
};

export const convertTimeDeltaToMilliSeconds = (delta: TimeDelta): number => {
  const minutes = delta.minutes || 0;
  const seconds = delta.seconds || 0;
  const milliseconds = delta.milliseconds || 0;

  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds * 1000 + milliseconds;
};

export enum RevisionSpecialVersionsEnum {
  LATEST = 'latest',
  DANGEROUSLY_USE_UNDEPLOYED = 'dangerously-use-undeployed',
}

export const REVISION_UNDEPLOYED_VERSION = 'undeployed';

export const AUTOBLOCKS_HEADERS = {
  'Content-Type': 'application/json',
  'X-Autoblocks-SDK': `javascript-${packageJson.version}`,
};

/**
 * Removes leading whitespace from each line in a string.
 */
export const dedent = (text: string) => {
  return text.replace(/^\s+/gm, '');
};

export function isCI(): boolean {
  return readEnv('CI') === 'true';
}

export function isCLIRunning(): boolean {
  return readEnv(AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS) !== undefined;
}

export function isGitHubCommentDisabled(): boolean {
  return readEnv(AutoblocksEnvVar.AUTOBLOCKS_DISABLE_GITHUB_COMMENT) === '1';
}

export function makeCommentsFor(name: string) {
  return {
    startComment: `// ${name} start`,
    endComment: `// ${name} end`,
  };
}

export function determineStartAndEndIdx(args: {
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
    return {
      startIdx: startCommentIdx,
      endIdx: endCommentIdx + args.endComment.length,
    };
  }

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

  const interfaceDeclaration = args.content.indexOf(
    `interface ${args.symbolName}`,
  );

  if (interfaceDeclaration !== -1) {
    let currentPos = interfaceDeclaration;
    let braceCount = 0;
    let foundEnd = false;

    while (currentPos < args.content.length) {
      const char = args.content[currentPos];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          foundEnd = true;
          break;
        }
      }
      currentPos++;
    }

    if (foundEnd) {
      return {
        startIdx: interfaceDeclaration,
        endIdx: currentPos + 1,
      };
    }
  }

  throw new Error(
    `Couldn't find ${symbolAppearanceBeforeAutogeneration} or ${args.symbolType} ${args.symbolName} in ${args.content}`,
  );
}

export interface AutoblocksOverrides {
  promptRevisions?: Record<string, string>;
  testRunMessage?: string;
  testSelectedDatasets?: string[];
}

export const parseAutoblocksOverrides = (): AutoblocksOverrides => {
  const overrides = readEnv(AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES);

  if (!overrides) {
    return {};
  }

  try {
    return JSON.parse(overrides);
  } catch (err) {
    console.warn(`Failed to parse AUTOBLOCKS_OVERRIDES: ${err}`);
    return {};
  }
};
