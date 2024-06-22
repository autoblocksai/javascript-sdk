import { BaseTestEvaluator, Evaluation } from '../models';

/**
 * The HasAllSubstrings evaluator checks if the output contains all the expected substrings.
 * Scores 1 if all substrings are present, 0 otherwise.
 * The comparison is case-sensitive.
 */
export class HasAllSubstrings<
  TestCaseType,
  OutputType,
> extends BaseTestEvaluator<TestCaseType, OutputType> {
  id = 'has-all-substrings';

  testCaseMapper: (testCase: TestCaseType) => string[];
  outputMapper: (output: OutputType) => string;

  constructor(args: {
    /**
     * Maps your output to the format the evaluator expects.
     */
    outputMapper: (output: OutputType) => string;
    /**
     * Maps your test case to the format the evaluator expects.
     */
    testCaseMapper: (testCase: TestCaseType) => string[];
  }) {
    super();
    this.outputMapper = args.outputMapper;
    this.testCaseMapper = args.testCaseMapper;
  }

  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation {
    const expectedSubstrings = this.testCaseMapper(args.testCase);
    const mappedOutput = this.outputMapper(args.output);
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
