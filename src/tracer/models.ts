import type {
  ArbitraryProperties,
  BaseEventEvaluator,
  PromptTracking,
  Evaluation,
} from '../types';

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
