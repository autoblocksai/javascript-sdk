import { ArbitraryProperties } from '../types';

export interface Threshold {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

export interface Evaluation {
  score: number;
  threshold?: Threshold;
  metadata?: ArbitraryProperties;
}

export interface TracerEvent {
  traceId?: string;
  message: string;
  timestamp: string;
  properties: ArbitraryProperties;
}

interface TestEvaluator<TestCaseType, OutputType> {
  evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation | Promise<Evaluation>;
}

interface EventEvaluator {
  evaluateEvent(args: { event: TracerEvent }): Evaluation | Promise<Evaluation>;
}

abstract class _BaseEvaluator {
  abstract get id(): string;

  maxConcurrency: number = 10;
}

/**
 * An ABC for users that are implementing an evaluator that will only be run against test cases.
 */
export abstract class BaseTestEvaluator<TestCaseType, OutputType>
  extends _BaseEvaluator
  implements TestEvaluator<TestCaseType, OutputType>
{
  abstract evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation | Promise<Evaluation>;
}

/**
 * An ABC for users that are implementing an evaluator that will only be run against production events.
 */
export abstract class BaseEventEvaluator
  extends _BaseEvaluator
  implements EventEvaluator
{
  abstract evaluateEvent(args: {
    event: TracerEvent;
  }): Evaluation | Promise<Evaluation>;
}

/**
 * An ABC for users that are implementing an evaluator that will be run against both test cases and production events.
 */
export abstract class BaseEvaluator<TestCaseType, OutputType>
  extends _BaseEvaluator
  implements TestEvaluator<TestCaseType, OutputType>, EventEvaluator
{
  abstract evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation | Promise<Evaluation>;

  abstract evaluateEvent(args: {
    event: TracerEvent;
  }): Evaluation | Promise<Evaluation>;
}

export interface HumanReviewField {
  name: string;
  value: string;
}
