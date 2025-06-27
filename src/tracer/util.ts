export enum SpanAttributesEnum {
  IS_ROOT = 'autoblocksIsRoot',
  EXECUTION_ID = 'autoblocksExecutionId',
  ENVIRONMENT = 'autoblocksEnvironment',
  APP_SLUG = 'autoblocksAppSlug',
  INPUT = 'autoblocksInput',
  OUTPUT = 'autoblocksOutput',
  RUN_ID = 'autoblocksRunId',
  RUN_MESSAGE = 'autoblocksRunMessage',
  TEST_ID = 'autoblocksTestId',
  EVALUATORS = 'autoblocksEvaluators',
  BUILD_ID = 'autoblocksBuildId',
  REVISION_ID = 'autoblocksRevisionId',
}

export function serialize(input: unknown): string {
  try {
    if (input === undefined) {
      return '{}';
    }
    if (typeof input === 'string') {
      return JSON.stringify({ value: input });
    }
    return JSON.stringify(input);
  } catch {
    return '{}';
  }
}
