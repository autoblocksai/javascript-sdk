import { BaseTestEvaluator, Evaluation } from '../models';

/**
 * The IsValidJson evaluator checks if the output is valid JSON.
 * Scores 1 if it is valid, 0 otherwise.
 */
export abstract class BaseIsValidJson<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Map your output to the string that you want to check is valid JSON.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation {
    const mappedOutput = this.outputMapper(args);
    let score = 1;
    let metadata = undefined;
    try {
      JSON.parse(mappedOutput);
    } catch (error) {
      if (error instanceof SyntaxError) {
        metadata = {
          error: error.message,
        };
      }
      score = 0;
    }
    return {
      score,
      threshold: {
        gte: 1,
      },
      metadata,
    };
  }
}
