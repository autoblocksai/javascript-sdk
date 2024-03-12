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

export abstract class BaseTestEvaluator<TestCaseType, OutputType> {
  abstract get id(): string;

  maxConcurrency: number = 10;

  abstract evaluateTestCase(args: {
    testCase: TestCaseType;
    output: OutputType;
  }): Evaluation | Promise<Evaluation>;
}

export abstract class BaseEventEvaluator {
  abstract get id(): string;

  maxConcurrency: number = 10;

  abstract evaluateEvent(args: {
    event: TracerEvent;
  }): Evaluation | Promise<Evaluation>;
}
