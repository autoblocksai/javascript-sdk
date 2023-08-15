import axios, { AxiosInstance } from 'axios';
import { makeReplayHeaders } from './util';

type EventProperties = Record<string, unknown>;

interface TimeDelta {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

const convertTimeDeltaToMilliSeconds = (delta: TimeDelta): number => {
  const minutes = delta.minutes || 0;
  const seconds = delta.seconds || 0;
  const milliseconds = delta.milliseconds || 0;

  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds * 1000 + milliseconds;
};

export class AutoblocksTracer {
  private client: AxiosInstance;
  private traceId: string | undefined;
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
      timeout: args?.timeout
        ? convertTimeDeltaToMilliSeconds(args.timeout)
        : undefined,
    });
    this.traceId = args?.traceId;
    this.properties = args?.properties || {};
  }

  public setTraceId(traceId: string) {
    this.traceId = traceId;
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
      timestamp?: string;
      properties?: EventProperties;
    },
  ): Promise<string> {
    const traceId = args?.traceId || this.traceId;
    const timestamp = args?.timestamp;
    const properties = {
      ...this.properties,
      ...(args?.properties || {}),
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
      timestamp?: string;
      properties?: EventProperties;
    },
  ): Promise<string | undefined> {
    try {
      return await this.sendEventUnsafe(message, args);
    } catch (err) {
      console.error(`Error sending event to Autoblocks: ${err}`);
      return undefined;
    }
  }
}
