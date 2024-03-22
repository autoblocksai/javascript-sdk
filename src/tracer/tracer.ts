import {
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
} from '../util';
import type { ArbitraryProperties, TimeDelta } from '../types';
import { Semaphore } from '../testing/util';
import crypto from 'crypto';
import { type SendEventArgs, EvaluationWithIds } from './models';
import { BaseEventEvaluator, TracerEvent } from '../testing';
import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';
import { INGESTION_ENDPOINT } from '../util';

interface TracerArgs {
  ingestionKey?: string;
  traceId?: string;
  properties?: ArbitraryProperties;
  timeout?: TimeDelta;
}

const evaluatorSemaphoreRegistry: Record<string, Semaphore> = {};

export class AutoblocksTracer {
  private _traceId: string | undefined;
  private properties: ArbitraryProperties;

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

  private runEvaluatorUnsafe(args: {
    event: TracerEvent;
    evaluator: BaseEventEvaluator;
  }) {
    if (!evaluatorSemaphoreRegistry[args.evaluator.id]) {
      evaluatorSemaphoreRegistry[args.evaluator.id] = new Semaphore(
        args.evaluator.maxConcurrency,
      );
    }
    const semaphore = evaluatorSemaphoreRegistry[args.evaluator.id];
    if (!semaphore) {
      throw new Error(`[${args.evaluator.id}] semaphore not found.`);
    }
    return semaphore.run(async () => {
      return await args.evaluator.evaluateEvent({
        event: args.event,
      });
    });
  }

  private async runEvaluatorsUnsafe(args: {
    event: TracerEvent;
    evaluators: BaseEventEvaluator[];
  }) {
    const evaluationPromises = await Promise.allSettled(
      args.evaluators.map((evaluator) =>
        this.runEvaluatorUnsafe({ event: args.event, evaluator }),
      ),
    );
    const evaluationsResult: EvaluationWithIds[] = [];
    evaluationPromises.forEach((evaluationPromise, i) => {
      const evaluator = args.evaluators[i];
      if (evaluationPromise.status === 'fulfilled') {
        evaluationsResult.push({
          id: crypto.randomUUID(),
          score: evaluationPromise.value.score,
          threshold: evaluationPromise.value.threshold,
          metadata: evaluationPromise.value.metadata,
          evaluatorExternalId: evaluator.id,
        });
      } else {
        console.error(
          `${evaluator.id} evaluator failed. `,
          evaluationPromise.reason,
        );
      }
    });
    return evaluationsResult;
  }

  private makeRequestPayload(args?: SendEventArgs) {
    if (args?.properties?.promptTracking && args?.promptTracking) {
      console.warn(
        'Ignoring the `promptTracking` field on the `properties` argument since it is also specified as a top-level argument.',
      );
    }

    const mergedProperties = Object.assign(
      {},
      this.properties,
      args?.properties,
      args?.spanId ? { spanId: args.spanId } : {},
      args?.parentSpanId ? { parentSpanId: args.parentSpanId } : {},
      args?.promptTracking ? { promptTracking: args.promptTracking } : {},
    );

    const traceId = args?.traceId || this.traceId;
    const timestamp = args?.timestamp || new Date().toISOString();

    return {
      traceId,
      timestamp,
      properties: mergedProperties,
    };
  }

  private async sendEventUnsafe(
    message: string,
    args?: SendEventArgs,
  ): Promise<void> {
    const { properties, traceId, timestamp } = this.makeRequestPayload(args);

    if (args?.evaluators) {
      try {
        const evaluations = await this.runEvaluatorsUnsafe({
          event: {
            message,
            traceId,
            timestamp,
            properties,
          },
          evaluators: args.evaluators,
        });
        if (evaluations.length) {
          properties['evaluations'] = evaluations;
        }
      } catch (e) {
        console.error('Failed to execute evaluators. ', e);
      }
    }

    await fetch(INGESTION_ENDPOINT, {
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
  }

  private async sendTestEventUnsafe(
    message: string,
    // We do not run evaluators for test events
    args?: Omit<SendEventArgs, 'evaluators'>,
  ): Promise<void> {
    const cliServerAddress = readEnv(
      AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS,
    );
    if (!cliServerAddress) {
      throw new Error('Tried to send test event without a CLI server address.');
    }
    const store = testCaseRunAsyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Tried to send test event outside of test run.');
    }
    const { properties, traceId, timestamp } = this.makeRequestPayload(args);

    await fetch(`${cliServerAddress}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testExternalId: store.testId,
        testCaseHash: store.testCaseHash,
        event: {
          message,
          traceId,
          timestamp,
          properties,
        },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  public async sendEvent(message: string, args?: SendEventArgs): Promise<void> {
    try {
      // This store should only be set in the context of a test run
      const store = testCaseRunAsyncLocalStorage.getStore();
      if (store) {
        await this.sendTestEventUnsafe(message, args);
      } else {
        await this.sendEventUnsafe(message, args);
      }
    } catch (err) {
      if (readEnv(AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR) === '1') {
        throw err;
      }
      console.error(`Error sending event to Autoblocks: ${err}`);
    }
  }
}
