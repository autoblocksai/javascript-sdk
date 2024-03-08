import {
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
} from '../util';
import type { ArbitraryProperties, TimeDelta } from '../types';
import { Semaphore } from '../testing/util';
import crypto from 'crypto';
import {
  BaseEventEvaluator,
  type TracerEvent,
  type SendEventArgs,
  EvaluationWithIds,
} from './models';

interface TracerArgs {
  ingestionKey?: string;
  traceId?: string;
  properties?: ArbitraryProperties;
  timeout?: TimeDelta;
}

export class AutoblocksTracer {
  private _traceId: string | undefined;
  private properties: ArbitraryProperties;
  private evaluatorSemaphoreRegistry: Record<string, Semaphore> = {}; // Evaluator id -> Semaphore

  private readonly ingestionBaseUrl: string =
    'https://ingest-event.autoblocks.ai';
  private readonly ingestionKey: string;
  private readonly timeoutMs: number;

  // Deprecated constructor
  constructor(ingestionKey?: string, args?: TracerArgs);
  // Current constructor
  constructor(args?: TracerArgs);
  constructor(keyOrArgs?: string | TracerArgs, maybeArgs?: TracerArgs) {
    const args = typeof keyOrArgs === 'string' ? maybeArgs : keyOrArgs;
    const key =
      typeof keyOrArgs === 'string'
        ? keyOrArgs
        : args?.ingestionKey ||
          readEnv(AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY);
    if (!key) {
      throw new Error(
        `You must either pass in the ingestion key via 'ingestionKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY}' environment variable.`,
      );
    }

    this.ingestionKey = key;
    this.timeoutMs = convertTimeDeltaToMilliSeconds(
      args?.timeout || { seconds: 5 },
    );
    this._traceId = args?.traceId;
    this.properties = args?.properties || {};
  }

  get traceId(): string | undefined {
    return this._traceId;
  }

  public setTraceId(traceId: string) {
    this._traceId = traceId;
  }

  public setProperties(properties: ArbitraryProperties) {
    this.properties = properties;
  }

  public updateProperties(properties: ArbitraryProperties) {
    this.properties = {
      ...this.properties,
      ...properties,
    };
  }

  private runEvaluatorUnsafe(
    event: TracerEvent,
    evaluator: BaseEventEvaluator,
  ) {
    const semaphore = this.evaluatorSemaphoreRegistry[evaluator.id];
    if (!semaphore) {
      throw new Error(`[${evaluator.id} semaphore not found.}]`);
    }
    return semaphore.run(async () => {
      return await evaluator.evaluateEvent({
        event,
      });
    });
  }

  private async runEvaluatorsUnsafe(
    event: TracerEvent,
    evaluators: BaseEventEvaluator[],
  ) {
    const evaluationPromises = await Promise.allSettled(
      evaluators.map((evaluator) => this.runEvaluatorUnsafe(event, evaluator)),
    );
    const evaluationsResult: EvaluationWithIds[] = [];
    evaluationPromises.forEach((evaluationPromise, i) => {
      const evaluator = evaluators[i];
      if (evaluationPromise.status === 'fulfilled') {
        evaluationsResult.push({
          id: crypto.randomUUID(),
          score: evaluationPromise.value.score,
          threshold: evaluationPromise.value.threshold,
          metadata: evaluationPromise.value.metadata,
          evaluatorExternalId: evaluator.id,
        });
      } else {
        console.warn(
          `${evaluator.id} evaluator failed. `,
          evaluationPromise.reason,
        );
      }
    });
    return evaluationsResult;
  }

  private async sendEventUnsafe(
    message: string,
    args?: SendEventArgs,
  ): Promise<string> {
    const traceId = args?.traceId || this.traceId;
    const timestamp = args?.timestamp || new Date().toISOString();

    if (args?.properties?.promptTracking && args?.promptTracking) {
      console.warn(
        'Ignoring the `promptTracking` field on the `properties` argument since it is also specified as a top-level argument.',
      );
    }

    const properties = Object.assign(
      {},
      this.properties,
      args?.properties,
      args?.spanId ? { spanId: args.spanId } : {},
      args?.parentSpanId ? { parentSpanId: args.parentSpanId } : {},
      args?.promptTracking ? { promptTracking: args.promptTracking } : {},
    );

    if (args?.evaluators) {
      try {
        // Build semaphore registry
        args.evaluators.forEach((evaluator) => {
          this.evaluatorSemaphoreRegistry[evaluator.id] = new Semaphore(
            evaluator.maxConcurrency,
          );
        });
        const evaluations = await this.runEvaluatorsUnsafe(
          {
            message,
            traceId,
            timestamp,
            properties,
          },
          args.evaluators,
        );
        if (evaluations.length) {
          properties['evaluations'] = evaluations;
        }
      } catch (e) {
        console.warn('Failed to execute evaluators. ', e);
      }
    }

    const resp = await fetch(this.ingestionBaseUrl, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.ingestionKey}`,
      },
      body: JSON.stringify({
        message,
        traceId,
        timestamp,
        properties,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const data = await resp.json();
    return data.traceId;
  }

  public async sendEvent(
    message: string,
    args?: SendEventArgs,
  ): Promise<{ traceId?: string }> {
    try {
      const traceId = await this.sendEventUnsafe(message, args);
      return { traceId };
    } catch (err) {
      if (readEnv(AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR) === '1') {
        throw err;
      }
      console.error(`Error sending event to Autoblocks: ${err}`);
      return {};
    }
  }
}
