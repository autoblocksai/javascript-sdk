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
   * Map your test case to a string for comparison.
   */
  abstract testCaseMapper(args: { testCase: TestCaseType }): string;

  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation {
    const actualOutput = this.outputMapper({
      output: args.output,
    });
    const expectedOutput = this.testCaseMapper({
      testCase: args.testCase,
    });
    const score = actualOutput === expectedOutput ? 1 : 0;
    return {
      score,
      threshold: {
        gte: 1,
      },
      metadata:
        score === 1
          ? undefined
          : {
              expectedOutput,
              actualOutput,
            },
    };
  }
}
