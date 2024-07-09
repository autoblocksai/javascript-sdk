import OpenAI from 'openai';
import z from 'zod';
import { API_ENDPOINT, AUTOBLOCKS_HEADERS } from '../../util';
import {
  BaseTestEvaluator,
  type Threshold,
  type Evaluation,
  type EvaluationOverride,
  type ScoreChoice,
} from '../models';
import { getAutoblocksApiKey, getOpenAIApiKey } from './util';
import { testCaseRunAsyncLocalStorage } from '../../asyncLocalStorage';

const FUNCTION_NAME = 'select_answer';

const SYSTEM_PROMPT = `Answer the following question by selecting an answer.
Always provide a reason for your answer.`;

const zToolCallSchema = z.object({
  reason: z.string().min(1),
  answer: z.string().min(1),
});

const zHumanReviewResults = z.array(
  z.object({
    originalScore: z.number(),
    overrideScore: z.number(),
    inputFields: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        value: z.string(),
      }),
    ),
    outputFields: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        value: z.string(),
      }),
    ),
    comments: z.array(
      z.object({
        fieldId: z.string(),
        quotedText: z.string(),
        commentText: z.string(),
      }),
    ),
  }),
);

/**
 * Base evaluator for creating an LLM judge.
 */
export abstract class BaseLLMJudge<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * The model to use for the evaluator.
   * It must be an OpenAI model that supports tools.
   *
   * @default "gpt-4-turbo".
   */
  model = 'gpt-4-turbo';
  /**
   * The number of recent evaluation overrides to fetch for the evaluator and pass to make_prompt.
   *
   * @default 0
   */
  numOverrides = 0;
  /**
   * The threshold for the evaluator.
   *
   * @default undefined
   */
  threshold?: Threshold;
  /**
   * The choices for the LLM judge to use when answering.
   */
  abstract get scoreChoices(): ScoreChoice[];

  /**
   *  The prompt passed to the LLM judge. Should be poised as a question.
   */
  abstract makePrompt(args: {
    testCase: TestCaseType;
    output: OutputType;
    recentOverrides: EvaluationOverride[];
  }): string;

  private findScoreChoiceFromValue(value: number): ScoreChoice | undefined {
    const scoreChoice = this.scoreChoices.find(
      (choice) => choice.value === value,
    );
    return scoreChoice;
  }

  private makeRecentOverridesUrl(): string {
    const store = testCaseRunAsyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Tried to evaluate test case outside of test run');
    }
    return `${API_ENDPOINT}/test-suites/${encodeURIComponent(store.testId)}/evaluators/${encodeURIComponent(this.id)}/human-reviews?n=${this.numOverrides}`;
  }

  private async getRecentOverrides(): Promise<EvaluationOverride[]> {
    if (this.numOverrides === 0) {
      // No need to fetch overrides if the user doesn't request any
      return [];
    }

    const resp = await fetch(this.makeRecentOverridesUrl(), {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${getAutoblocksApiKey({
          evaluatorId: this.id,
        })}`,
      },
    });
    const data = await resp.json();
    const parsedData = zHumanReviewResults.parse(data);
    return parsedData
      .map((override) => {
        const overrideScore = this.findScoreChoiceFromValue(
          override.overrideScore,
        );
        const originalScore = this.findScoreChoiceFromValue(
          override.originalScore,
        );
        if (overrideScore === undefined || originalScore === undefined) {
          // Score choice may not be found if they have changed since the override was created
          return undefined;
        }
        return {
          originalScore,
          overrideScore,
          inputFields: override.inputFields,
          outputFields: override.outputFields,
          comments: override.comments,
        };
      })
      .filter(
        (override): override is EvaluationOverride => override !== undefined,
      );
  }

  private makeTool(): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: FUNCTION_NAME,
        description: 'Call this function to select an answer',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'The reason for the answer',
            },
            answer: {
              type: 'string',
              description: 'The answer to select',
              enum: this.scoreChoices.map((choice) => choice.name),
            },
          },
          required: ['reason', 'answer'],
        },
      },
    };
  }

  private async executePrompt(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Promise<Evaluation> {
    // We do this first so that an error is thrown early if the OpenAI API key is missing.
    const openai = new OpenAI({
      apiKey: getOpenAIApiKey({
        evaluatorId: this.id,
      }),
    });
    const recentOverrides = await this.getRecentOverrides();
    const prompt = this.makePrompt({
      testCase: args.testCase,
      output: args.output,
      recentOverrides,
    });
    const response = await openai.chat.completions.create({
      model: this.model,
      temperature: 0.0,
      tool_choice: {
        type: 'function',
        function: {
          name: FUNCTION_NAME,
        },
      },
      tools: [this.makeTool()],
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (toolCall === undefined || toolCall.function.name !== FUNCTION_NAME) {
      throw new Error(`Expected tool call: ${toolCall}`);
    }
    const parsedToolCall = zToolCallSchema.parse(
      JSON.parse(toolCall.function.arguments),
    );
    const score = this.scoreChoices.find(
      (choice) => choice.name === parsedToolCall.answer,
    );
    if (score === undefined) {
      throw new Error(`Invalid answer: ${parsedToolCall.answer}`);
    }

    return {
      score: score.value,
      threshold: this.threshold,
      metadata: {
        reason: parsedToolCall.reason,
        prompt,
      },
    };
  }

  async evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Promise<Evaluation> {
    return this.executePrompt({
      testCase: args.testCase,
      output: args.output,
    });
  }
}
