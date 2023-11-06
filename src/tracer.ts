import axios, { AxiosInstance } from 'axios';
import {
  makeReplayHeaders,
  type TimeDelta,
  convertTimeDeltaToMilliSeconds,
} from './util';

type ArbitraryProperties = Record<string | number, unknown>;

interface SendEventArgs {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp?: string;
  properties?: ArbitraryProperties;
  prompts?: {
    id: string | number;
    template: string;
    properties?: ArbitraryProperties;
  }[];
}

export class AutoblocksTracer {
  private client: AxiosInstance;
  private _traceId: string | undefined;
  private properties: Record<string, unknown>;

  constructor(
    ingestionToken: string,
    args?: {
      traceId?: string;
      properties?: ArbitraryProperties;
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

    if (args?.properties?.prompts && args?.prompts) {
      console.warn(
        'Ignoring the `prompts` field on the `properties` argument since it is also specified as a top-level argument.',
      );
    }

    const properties = Object.assign(
      {},
      this.properties,
      args?.properties,
      args?.spanId ? { spanId: args.spanId } : {},
      args?.parentSpanId ? { parentSpanId: args.parentSpanId } : {},
      args?.prompts ? { prompts: args.prompts } : {},
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
      console.error(`Error sending event to Autoblocks: ${err}`);
      return {};
    }
  }
}
