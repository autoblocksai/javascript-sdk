export interface Threshold {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

export interface Evaluation {
  score: number;
  threshold?: Threshold;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseTestCaseType = Record<string, any>;

export abstract class BaseTestEvaluator<
  TestCaseType extends BaseTestCaseType,
  OutputType,
> {
  abstract get id(): string;

  abstract evaluateTestCase(
    testCase: TestCaseType,
    output: OutputType,
  ): Evaluation | Promise<Evaluation>;
}
