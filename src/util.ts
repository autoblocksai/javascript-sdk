import type { TimeDelta } from './types';
import packageJson from '../package.json';

export const INGESTION_ENDPOINT = 'https://ingest-event.autoblocks.ai';
export const API_ENDPOINT = 'https://api.autoblocks.ai';

export enum AutoblocksEnvVar {
  AUTOBLOCKS_API_KEY = 'AUTOBLOCKS_API_KEY',
  AUTOBLOCKS_INGESTION_KEY = 'AUTOBLOCKS_INGESTION_KEY',
  AUTOBLOCKS_TRACER_THROW_ON_ERROR = 'AUTOBLOCKS_TRACER_THROW_ON_ERROR',
  AUTOBLOCKS_CLI_SERVER_ADDRESS = 'AUTOBLOCKS_CLI_SERVER_ADDRESS',
  AUTOBLOCKS_FILTERS_TEST_SUITES = 'AUTOBLOCKS_FILTERS_TEST_SUITES',
  AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS = 'AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS',
  AUTOBLOCKS_OVERRIDES_CONFIG_REVISIONS = 'AUTOBLOCKS_OVERRIDES_CONFIG_REVISIONS',
  AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES = 'AUTOBLOCKS_OVERRIDES_TESTS_AND_HASHES',
}

export enum ThirdPartyEnvVar {
  OPENAI_API_KEY = 'OPENAI_API_KEY',
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
