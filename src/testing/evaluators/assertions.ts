import { type Assertion, BaseTestEvaluator } from '../models';

/**
 * Base evaluator for creating an assertions evaluator.
 */
export abstract class BaseAssertions<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  /**
   * Implement your assertion logic and return an array of assertions.
   * Return undefined if you want to skip evaluation for this test case.
   */
  abstract evaluateAssertions(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Assertion[] | undefined | Promise<Assertion[] | undefined>;

  async evaluateTestCase(args: { testCase: TestCaseType; output: OutputType }) {
    const assertionsResult = await this.evaluateAssertions({
      testCase: args.testCase,
      output: args.output,
    });

    if (assertionsResult === undefined || assertionsResult.length === 0) {
      return undefined;
    }

    // Passes if all required assertions pass
    const passed = assertionsResult
      .filter((assertion) => assertion.required)
      .every((assertion) => assertion.passed);

    return {
      score: passed ? 1 : 0,
      threshold: {
        gte: 1,
      },
      assertions: assertionsResult,
    };
  }
}
