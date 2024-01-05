import axios, { AxiosInstance } from 'axios';
import {
  makeReplayHeaders,
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
} from './util';
import type { ArbitraryProperties, SendEventArgs, TimeDelta } from './types';

interface TracerArgs {
  ingestionKey?: string;
  traceId?: string;
  properties?: ArbitraryProperties;
  timeout?: TimeDelta;
}

export class AutoblocksTracer {
  private client: AxiosInstance;
  private _traceId: string | undefined;
  private properties: ArbitraryProperties;

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
    this.client = axios.create({
      baseURL: 'https://ingest-event.autoblocks.ai',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      timeout: convertTimeDeltaToMilliSeconds(args?.timeout || { seconds: 5 }),
    });
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

    let replayHeaders = undefined;
    try {
      replayHeaders = makeReplayHeaders();
    } catch {
      // Couldn't make headers
    }

    const { data } = await this.client.post(
      '/',
      {
        message,
        traceId,
        timestamp,
        properties,
      },
      { headers: replayHeaders },
    );

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
