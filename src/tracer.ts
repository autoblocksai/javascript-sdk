import axios, { AxiosInstance } from 'axios';
import {
  makeReplayHeaders,
  type TimeDelta,
  convertTimeDeltaToMilliSeconds,
} from './util';

type EventProperties = Record<string, unknown>;

export class AutoblocksTracer {
  private client: AxiosInstance;
  private _traceId: string | undefined;
  private properties: Record<string, unknown>;

  constructor(
    ingestionToken: string,
    args?: {
      traceId?: string;
      properties?: EventProperties;
      timeout?: TimeDelta;
    },
  ) {
    this.client = axios.create({
      baseURL: 'https://ingest-event.autoblocks.ai',
      headers: {
        Authorization: `Bearer ${ingestionToken}`,
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

  public setProperties(properties: EventProperties) {
    this.properties = properties;
  }

  public updateProperties(properties: EventProperties) {
    this.properties = {
      ...this.properties,
      ...properties,
    };
  }

  private async sendEventUnsafe(
    message: string,
    args?: {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      timestamp?: string;
      properties?: EventProperties;
    },
  ): Promise<string> {
    const traceId = args?.traceId || this.traceId;
    const timestamp = args?.timestamp || new Date().toISOString();
    const properties = {
      ...this.properties,
      ...(args?.properties || {}),
      spanId: args?.spanId,
      parentSpanId: args?.parentSpanId,
    };

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
    args?: {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      timestamp?: string;
      properties?: EventProperties;
    },
  ): Promise<{ traceId?: string }> {
    try {
      const traceId = await this.sendEventUnsafe(message, args);
      return { traceId };
    } catch (err) {
      console.error(`Error sending event to Autoblocks: ${err}`);
      return {};
    }
  }
}
