import OpenAI from 'openai';
import { testCaseRunAsyncLocalStorage } from '../../asyncLocalStorage';
import {
  API_ENDPOINT,
  AUTOBLOCKS_HEADERS,
  AutoblocksEnvVar,
  ThirdPartyEnvVar,
  readEnv,
} from '../../util';
import { BaseTestEvaluator, Evaluation } from '../models';
import { z } from 'zod';

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

interface BattleResponse {
  result: string;
  reason: string;
}

const API_TIMEOUT = 10_000;

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

/**
 * The Battle evaluator compares two responses based on a given criteria.
 * If the challenger wins, the challenger becomes the new baseline automatically.
 * You can override this behavior by passing in a baselineMapper and handling the baseline yourself.
 */
export class Battle<TestCaseType, OutputType> extends BaseTestEvaluator<
  TestCaseType,
  OutputType
> {
  id = 'battle';
  criteria: string;
  outputMapper: (output: OutputType) => string;
  baselineMapper?: (testCase: TestCaseType) => string;

  constructor(args: {
    /**
     * Criteria to be used in the battle
     */
    criteria: string;
    /**
     * Maps your output to the format the evaluator expects.
     */
    outputMapper: (output: OutputType) => string;
    /**
     * Optional baselineMapper allows you to store a baseline on your test case
     * Instead of having Autoblocks automatically track it from the output
     */
    baselineMapper?: (testCase: TestCaseType) => string;
  }) {
    super();
    this.criteria = args.criteria;
    this.outputMapper = args.outputMapper;
    this.baselineMapper = args.baselineMapper;
  }

  private getApiKey(): string {
    const apiKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable to use the Battle evaluator.`,
      );
    }
    return apiKey;
  }

  private getOpenAIApiKey(): string {
    const apiKey = readEnv(ThirdPartyEnvVar.OPENAI_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must set the '${ThirdPartyEnvVar.OPENAI_API_KEY}' environment variable to use the Battle evaluator.`,
      );
    }
    return apiKey;
  }

  private async getBaseline(args: {
    testId: string;
    testCase: TestCaseType;
    testCaseHash: string;
  }): Promise<string | undefined> {
    if (this.baselineMapper) {
      return this.baselineMapper(args.testCase);
    }
    const resp = await fetch(
      `${API_ENDPOINT}/test-suites/${args.testId}/test-cases/${args.testCaseHash}/baseline`,
      {
        method: 'GET',
        headers: {
          ...AUTOBLOCKS_HEADERS,
          Authorization: `Bearer ${this.getApiKey()}`,
        },
        signal: AbortSignal.timeout(API_TIMEOUT),
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
          Authorization: `Bearer ${this.getApiKey()}`,
        },
        signal: AbortSignal.timeout(API_TIMEOUT),
        body: JSON.stringify({ baseline: args.baseline }),
      },
    );
  }

  private async battle(
    baseline: string,
    challenger: string,
  ): Promise<BattleResponse> {
    const openai = new OpenAI({
      apiKey: this.getOpenAIApiKey(),
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
            criteria: this.criteria,
            baseline,
            challenger,
          }),
        },
      ],
    });

    const parsedResponse = zOpenAiResponseSchema.parse(
      response.choices[0]?.message.content,
    );
    return parsedResponse;
  }

  async evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Promise<Evaluation> {
    const store = testCaseRunAsyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Tried to evaluate test case outside of test run');
    }
    const mappedOutput = this.outputMapper(args.output);
    const baseline = await this.getBaseline({
      testId: store.testId,
      testCase: args.testCase,
      testCaseHash: store.testCaseHash,
    });

    if (!baseline) {
      console.log('saving....');
      await this.saveBaseline({
        testId: store.testId,
        baseline: mappedOutput,
        testCaseHash: store.testCaseHash,
      });
      // Nothing to compare so we return
      return {
        score: 1,
        threshold: { gte: 0.5 },
      };
    }

    const battleResult = await this.battle(baseline, mappedOutput);
    let score = 0;
    if (battleResult.result === '2') {
      // Challenger wins so save new baseline
      await this.saveBaseline({
        testId: store.testId,
        baseline: mappedOutput,
        testCaseHash: store.testCaseHash,
      });
      score = 1;
    } else if (battleResult.result === '0') {
      // tie
      score = 0.5;
    }

    return {
      score,
      threshold: { gte: 0.5 },
      metadata: {
        reason: battleResult.reason,
        baseline,
        challenger: mappedOutput,
      },
    };
  }
}
