import { dedent } from '../../util';
import { EvaluationOverride } from '../models';
import { BaseLLMJudge } from './llm-judge';

/**
 * The Accuracy evaluator checks if the output is accurate compared to an expected output.
 *
 * Scores 1 if the output is accurate, 0.5 if somewhat accurate, 0 otherwise.
 */
export abstract class BaseAccuracy<
  TestCaseType,
  OutputType,
> extends BaseLLMJudge<TestCaseType, OutputType> {
  threshold = { gte: 1 };
  scoreChoices = [
    {
      value: 1,
      name: 'Accurate',
    },
    {
      value: 0.5,
      name: 'Somewhat accurate',
    },
    {
      value: 0,
      name: 'Not accurate',
    },
  ];

  /**
   * Map the output to a string to pass to the LLM judge.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  /**
   * Map the test_case to an expected string to pass to the LLM judge.
   */
  abstract expectedOutputMapper(args: { testCase: TestCaseType }): string;

  /**
   * Map an EvaluationOverride to a string representation of the output.
   * This gets passed to the LLM judge as an example.
   */
  exampleOutputMapper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    args: {
      evaluationOverride: EvaluationOverride;
    },
  ): string | undefined {
    return undefined;
  }

  /**
   * Map an EvaluationOverride to a string representation of the expected output.
   * This gets passed to the LLM judge as an example.
   */
  exampleExpectedOutputMapper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    args: {
      evaluationOverride: EvaluationOverride;
    },
  ): string | undefined {
    return undefined;
  }

  private exampleMapper(args: { evaluationOverride: EvaluationOverride }) {
    const output = this.exampleOutputMapper(args);
    const expectedOutput = this.exampleExpectedOutputMapper(args);
    if (!output || !expectedOutput) {
      throw new Error(
        `numOverrides was set to a non-zero value but exampleOutputMapper or exampleExpectedOutputMapper was not implemented in evaluator ${this.id}`,
      );
    }
    return dedent(
      `------
      Output: ${output}
      Expected Output: ${expectedOutput}
      Answer: ${args.evaluationOverride.overrideScore.name}
      ------`,
    );
  }

  /**
   * Builds a prompt like:
   * Is the output accurate based on the expected output?
   *
   * [Output]
   * Hey, how are you?
   *
   * [Expected Output]
   * Hi, how are you doing?
   *
   * [Examples]
   * ------
   * Output: How are you?
   * Expected Output: How are you?
   * Answer: Accurate
   * ------
   */
  makePrompt(args: {
    testCase: TestCaseType;
    output: OutputType;
    recentOverrides: EvaluationOverride[];
  }) {
    const basePrompt = dedent(
      `Is the output accurate based on the expected output?

      [Output]
      ${this.outputMapper({ output: args.output })}
      
      [Expected Output]
      ${this.expectedOutputMapper({ testCase: args.testCase })}`,
    );

    if (args.recentOverrides.length === 0) {
      return basePrompt;
    }

    const examples = args.recentOverrides
      .map((override) => this.exampleMapper({ evaluationOverride: override }))
      .join('\n');

    return dedent(
      `${basePrompt}
    
      [Examples]
      ${examples}`,
    );
  }
}
