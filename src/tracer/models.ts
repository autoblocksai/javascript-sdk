import { Evaluation } from '../testing';
import { BaseEventEvaluator, HumanReviewField } from '../testing/models';
import { ArbitraryProperties, PromptTracking } from '../types';

export interface SendEventArgs {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp?: string;
  properties?: ArbitraryProperties;
  promptTracking?: PromptTracking;
  evaluators?: BaseEventEvaluator[];
  humanReviewFields?: HumanReviewField[];
}

export interface EvaluationWithIds extends Evaluation {
  id: string;
  evaluatorExternalId: string;
}
