import { AutoblocksEnvVar, ThirdPartyEnvVar, readEnv } from '../../util';

export function getOpenAIApiKey(args: { evaluatorId: string }): string {
  const apiKey = readEnv(ThirdPartyEnvVar.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error(
      `You must set the '${ThirdPartyEnvVar.OPENAI_API_KEY}' environment variable to use the ${args.evaluatorId} evaluator.`,
    );
  }
  return apiKey;
}

export function getAutoblocksApiKey(args: { evaluatorId: string }): string {
  const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
  if (!apiKey) {
    throw new Error(
      `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable to use the ${args.evaluatorId} evaluator.`,
    );
  }
  return apiKey;
}
