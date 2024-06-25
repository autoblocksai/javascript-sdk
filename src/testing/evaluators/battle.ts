import OpenAI from 'openai';
import { testCaseRunAsyncLocalStorage } from '../../asyncLocalStorage';
import { API_ENDPOINT, AUTOBLOCKS_HEADERS } from '../../util';
import { BaseTestEvaluator, Evaluation } from '../models';
import { z } from 'zod';
import { getAutoblocksApiKey, getOpenAIApiKey } from './util';

const zBaselineResponseSchema = z.object({
  baseline: z.string().optional(),
});

/*
 * We are using JSON mode from OpenAI, but they still always return a string that is a json object.
 * This converts the string to an object then parses it to our expected type
 * See: https://github.com/colinhacks/zod/discussions/2215#discussioncomment-5356286
 */
const zOpenAiResponseSchema = z
  .string()
  .transform((str, ctx): z.infer<ReturnType<typeof JSON.parse>> => {
    try {
      return JSON.parse(str);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
      return z.NEVER;
    }
  })
  .pipe(
    z.object({
      reason: z.string(),
      result: z.enum(['0', '1', '2']),
    }),
  );

const systemPrompt = `You are an expert in comparing responses to given criteria.
Pick which response is the best while taking the criteria into consideration.
Return 1 if the baseline is better, 2 if the challenger is better, and 0 if they are equal.
You must provide one answer based on your subjective view and provide a reason for your answer.

Always output in the following JSON format:

{
  "reason": "This is the reason.",
  "result": "0" | "1" | "2"
}`;

const makeUserPrompt = (args: {
  criteria: string;
  baseline: string;
  challenger: string;
}): string => {
  return `[Criteria]
${args.criteria}

[Baseline]
${args.baseline}

[Challenger]
${args.challenger}`;
};

const battle = async (args: {
  baseline: string;
  challenger: string;
  criteria: string;
  evaluatorId: string;
}): Promise<Evaluation> => {
  const openai = new OpenAI({
    apiKey: getOpenAIApiKey({
      evaluatorId: args.evaluatorId,
    }),
  });
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    temperature: 0.0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: makeUserPrompt({
          criteria: args.criteria,
          baseline: args.baseline,
          challenger: args.challenger,
        }),
      },
    ],
  });

  const parsedResponse = zOpenAiResponseSchema.parse(
    response.choices[0]?.message.content,
  );
  let score = 0;
  if (parsedResponse.result === '2') {
    score = 1;
  } else if (parsedResponse.result === '0') {
    // tie
    score = 0.5;
  }

  return {
    score,
    threshold: { gte: 0.5 },
    metadata: {
      reason: parsedResponse.reason,
      baseline: args.baseline,
      challenger: args.challenger,
      criteria: args.criteria,
    },
  };
};

/**
 * The ManualBattle evaluator compares two responses based on a given criteria.
 * If you would like to Autoblocks to automatically manage the baseline, use the AutomaticBattle evaluator.
 */
export abstract class BaseManualBattle<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Criteria to be used in the battle
   */
  abstract get criteria(): string;

  /**
   * Map your output to a string for comparison to the baseline.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  /**
   * Map the baseline ground truth from your test case for comparison.
   */
  abstract baselineMapper(args: { testCase: TestCaseType }): string;

  async evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Promise<Evaluation> {
    return battle({
      baseline: this.baselineMapper({
        testCase: args.testCase,
      }),
      challenger: this.outputMapper({
        output: args.output,
      }),
      criteria: this.criteria,
      evaluatorId: this.id,
    });
  }
}

/**
 * The AutomaticBattle evaluator compares two responses based on a given criteria.
 * If the challenger wins, the challenger becomes the new baseline automatically.
 * If you would like to provide your own baseline, use the ManualBattle evaluator.
 */
export abstract class BaseAutomaticBattle<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Criteria to be used in the battle
   */
  abstract get criteria(): string;

  /**
   * Map your output to a string for comparison to the baseline.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  private async getBaseline(args: {
    testId: string;
    testCase: TestCaseType;
    testCaseHash: string;
  }): Promise<string | undefined> {
    const resp = await fetch(
      `${API_ENDPOINT}/test-suites/${args.testId}/test-cases/${args.testCaseHash}/baseline`,
      {
        method: 'GET',
        headers: {
          ...AUTOBLOCKS_HEADERS,
          Authorization: `Bearer ${getAutoblocksApiKey({
            evaluatorId: this.id,
          })}`,
        },
      },
    );

    const data = await resp.json();
    return zBaselineResponseSchema.parse(data).baseline;
  }

  private async saveBaseline(args: {
    testId: string;
    baseline: string;
    testCaseHash: string;
  }): Promise<void> {
    await fetch(
      `${API_ENDPOINT}/test-suites/${args.testId}/test-cases/${args.testCaseHash}/baseline`,
      {
        method: 'POST',
        headers: {
          ...AUTOBLOCKS_HEADERS,
          Authorization: `Bearer ${getAutoblocksApiKey({
            evaluatorId: this.id,
          })}`,
        },
        body: JSON.stringify({ baseline: args.baseline }),
      },
    );
  }

  async evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Promise<Evaluation | undefined> {
    const store = testCaseRunAsyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Tried to evaluate test case outside of test run');
    }
    const mappedOutput = this.outputMapper({
      output: args.output,
    });
    const baseline = await this.getBaseline({
      testId: store.testId,
      testCase: args.testCase,
      testCaseHash: store.testCaseHash,
    });

    if (!baseline) {
      await this.saveBaseline({
        testId: store.testId,
        baseline: mappedOutput,
        testCaseHash: store.testCaseHash,
      });
      // Nothing to compare so we return
      return undefined;
    }

    const battleResult = await battle({
      baseline,
      challenger: mappedOutput,
      criteria: this.criteria,
      evaluatorId: this.id,
    });

    if (battleResult.score === 1) {
      // Challenger wins so save new baseline
      await this.saveBaseline({
        testId: store.testId,
        baseline: mappedOutput,
        testCaseHash: store.testCaseHash,
      });
    }

    return battleResult;
  }
}
