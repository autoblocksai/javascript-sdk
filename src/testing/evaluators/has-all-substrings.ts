import { BaseTestEvaluator, Evaluation } from '../models';

/**
 * The HasAllSubstrings evaluator checks if the output contains all the expected substrings.
 * Scores 1 if all substrings are present, 0 otherwise.
 * The comparison is case-sensitive.
 */
export abstract class BaseHasAllSubstrings<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Map your output to a string for comparison.
   */
  abstract outputMapper(args: { output: OutputType }): string;

  /**
   * Map your test case to a list of strings to check for in the output.
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
