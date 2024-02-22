import type { TimeDelta } from './types';

export enum AutoblocksEnvVar {
  AUTOBLOCKS_API_KEY = 'AUTOBLOCKS_API_KEY',
  AUTOBLOCKS_INGESTION_KEY = 'AUTOBLOCKS_INGESTION_KEY',
  AUTOBLOCKS_TRACER_THROW_ON_ERROR = 'AUTOBLOCKS_TRACER_THROW_ON_ERROR',
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

export enum HeadlessPromptSpecialVersion {
  LATEST = 'latest',
  DANGEROUSLY_USE_UNDEPLOYED = 'dangerously-use-undeployed',
}
