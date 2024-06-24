import { BaseTestEvaluator, Evaluation } from '../models';

/**
 * The HasAllSubstrings evaluator checks if the output contains all the expected substrings.
 * Scores 1 if all substrings are present, 0 otherwise.
 * The comparison is case-sensitive.
 */
export abstract class HasAllSubstrings<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Maps your output to the format the evaluator expects.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  /**
   * Maps your test case to the format the evaluator expects.
   */
  abstract testCaseMapper(args: { testCase: TestCaseType }): string[];

  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation {
    const expectedSubstrings = this.testCaseMapper(args);
    const mappedOutput = this.outputMapper(args);
    const missingSubstrings = expectedSubstrings.filter(
      (s) => !mappedOutput.includes(s),
    );
    const score = missingSubstrings.length ? 0 : 1;

    return {
      score,
      threshold: {
        gte: 1,
      },
      metadata: {
        missingSubstrings,
      },
    };
  }
}
