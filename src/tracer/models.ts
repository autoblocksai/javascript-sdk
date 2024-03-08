import { Event } from '../client';
import { Evaluation as TestingEvaluation } from '../testing';
import { BaseEventEvaluator } from '../testing/models';
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

export interface EvaluationWithIds extends Evaluation {
  id: string;
  evaluatorExternalId: string;
}
