import { BaseTestEvaluator, Evaluation } from '../models';

/**
 * The IsEquals evaluator checks if the output equals the expected output.
 * The comparison is case-sensitive. Scores 1 if it is equal, 0 otherwise.
 */
export abstract class BaseIsEquals<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Map your output to a string for comparison.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  /**
   * Map your output to a string for comparison.
   */
  abstract testCaseMapper(args: { testCase: TestCaseType }): string;

  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation {
    const mappedOutput = this.outputMapper({
      output: args.output,
    });
    const expectedOutput = this.testCaseMapper({
      testCase: args.testCase,
    });
    return {
      score: mappedOutput === expectedOutput ? 1 : 0,
      threshold: {
        gte: 1,
      },
      metadata: {
        expectedOutput,
        actualOutput: mappedOutput,
      },
    };
  }
}
