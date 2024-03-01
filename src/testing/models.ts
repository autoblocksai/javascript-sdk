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

export abstract class BaseTestEvaluator<TestCaseType, OutputType> {
  abstract get id(): string;

  abstract evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation | Promise<Evaluation>;
}
