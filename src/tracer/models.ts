import { Event } from '../client';
import { Evaluation as TestingEvaluation } from '../testing';
import { ArbitraryProperties, PromptTracking } from '../types';

export type TracerEvent = Omit<Event, 'id' | 'traceId'> & { traceId?: string };
export type Evaluation = TestingEvaluation;

export interface SendEventArgs {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp?: string;
  properties?: ArbitraryProperties;
  promptTracking?: PromptTracking;
  evaluators?: BaseEventEvaluator[];
}

export abstract class BaseEventEvaluator {
  abstract get id(): string;

  maxConcurrency: number = 10;

  abstract evaluateEvent(args: {
    event: TracerEvent;
  }): Evaluation | Promise<Evaluation>;
}

export interface EvaluationWithIds extends Evaluation {
  id: string;
  evaluatorExternalId: string;
}
