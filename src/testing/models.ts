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

export abstract class BaseTestCase {
  abstract hash(): string;
}

export abstract class BaseTestEvaluator<
  TestCaseType extends BaseTestCase,
  OutputType,
> {
  abstract get id(): string;

  abstract evaluateTestCase(
    testCase: TestCaseType,
    output: OutputType,
  ): Evaluation | Promise<Evaluation>;
}
