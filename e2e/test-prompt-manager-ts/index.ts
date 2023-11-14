import { AutoblocksTracer } from '@autoblocks/client';
import { PromptTemplateManager } from '@autoblocks/client/prompts';
import { OpenAI } from 'openai';

const openai = new OpenAI();
const tracer = new AutoblocksTracer(
  process.env.AUTOBLOCKS_INGESTION_KEY as string,
);
export const promptManager = new PromptTemplateManager();

export enum PromptTrackingId {
  A = 'tracking-id-a',
  B = 'tracking-id-b',
}

export async function main() {
  // Build prompt(s) for task A
  const builderA = promptManager.makeBuilder(PromptTrackingId.A);

  const responseA = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: builderA.build('feature-a/system', {
          languageRequirement: builderA.build('common/language', {
            language: 'Spanish',
          }),
        }),
      },
      {
        role: 'user',
        content: builderA.build('feature-a/user', {
          name: 'Nicole',
        }),
      },
    ],
    model: 'gpt-3.5-turbo',
  });

  // Record response to Autoblocks
  await tracer.sendEvent('ai.response', {
    properties: { response: responseA },
    promptTracking: builderA.usage(),
  });

  // Build prompt(s) for task B
  const builderB = promptManager.makeBuilder(PromptTrackingId.B);

  const responseB = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: builderB.build('feature-b/system', {
          languageRequirement: builderB.build('common/language', {
            language: 'Portuguese',
          }),
        }),
      },
      {
        role: 'user',
        content: builderB.build('feature-b/user', {
          age: '32',
        }),
      },
    ],
    model: 'gpt-3.5-turbo',
  });

  // Record response to Autoblocks
  await tracer.sendEvent('ai.response', {
    properties: { response: responseB },
    promptTracking: builderB.usage(),
  });
}

main();
