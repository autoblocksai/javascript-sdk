import { z } from 'zod';

// Use any here so that interfaces can be assigned to this type.
// https://stackoverflow.com/q/65799316
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArbitraryProperties = Record<string | number, any>;

/*
 * Prompts
 */
export interface PromptTracking {
  id: string;
  version?: string;
  templates: {
    id: string;
    version?: string;
    template: string;
    properties?: ArbitraryProperties;
  }[];
}

export interface TimeDelta {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export const zHeadlessPromptSchema = z
  .object({
    id: z.string(),
    version: z.string(),
    templates: z.array(
      z.object({
        id: z.string(),
        version: z.string(),
        template: z.string(),
      }),
    ),
    params: z
      .object({
        version: z.string(),
        params: z.record(z.string(), z.unknown()),
      })
      .nullish(),
  })
  .transform((prompt) => {
    return {
      ...prompt,
      get majorVersion(): string {
        return prompt.version.split('.')[0];
      },
      get minorVersion(): string {
        return prompt.version.split('.')[1];
      },
    };
  });

export type HeadlessPrompt = z.infer<typeof zHeadlessPromptSchema>;

/*
 * Tracer
 */
export interface TracerEvent {
  traceId?: string;
  message: string;
  timestamp: string;
  properties: ArbitraryProperties;
}

export interface SendEventArgs {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp?: string;
  properties?: ArbitraryProperties;
  promptTracking?: PromptTracking;
  evaluators?: BaseEventEvaluator[];
}

/*
 * Evaluators
 */
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

export interface EvaluationWithIds extends Evaluation {
  id: string;
  evaluatorExternalId: string;
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
