import type { TimeDelta } from './common/models';
import {
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
} from './common/util';

export interface View {
  id: string;
  name: string;
}

export interface Dataset {
  id: string;
  name: string;
}

export interface DatasetItem {
  id: string;
  input: string;
  output: string;
}

export interface DatasetWithItems extends Dataset {
  items: DatasetItem[];
}

export interface Event {
  id: string;
  traceId: string;
  message: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface Trace {
  id: string;
  events: Event[];
}

interface RelativeTimeFilter {
  type: 'relative';
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
  weeks?: number;
  months?: number;
  years?: number;
}

interface AbsoluteTimeFilter {
  type: 'absolute';
  start: string;
  end: string;
}

interface TraceFilter {
  operator: 'CONTAINS' | 'NOT_CONTAINS';
  eventFilters: {
    key: string;
    value: string;
    operator:
      | 'CONTAINS'
      | 'NOT_CONTAINS'
      | 'EQUALS'
      | 'NOT_EQUALS'
      | 'LESS_THAN'
      | 'LESS_THAN_OR_EQUALS'
      | 'GREATER_THAN'
      | 'GREATER_THAN_OR_EQUALS';
  }[];
}

export enum SystemEventFilterKey {
  MESSAGE = 'SYSTEM:message',
  LABEL = 'SYSTEM:label',
}

interface ClientArgs {
  apiKey?: string;
  timeout?: TimeDelta;
}

export class AutoblocksAPIClient {
  private readonly apiBaseUrl: string = 'https://api.autoblocks.ai';
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  // Deprecated constructor
  constructor(apiKey: string, args?: ClientArgs);
  // Current constructor
  constructor(args?: ClientArgs);
  constructor(keyOrArgs?: string | ClientArgs, maybeArgs?: ClientArgs) {
    const args = typeof keyOrArgs === 'string' ? maybeArgs : keyOrArgs;
    const key =
      typeof keyOrArgs === 'string'
        ? keyOrArgs
        : args?.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!key) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = key;
    this.timeoutMs = convertTimeDeltaToMilliSeconds(
      args?.timeout || { seconds: 60 },
    );
  }

  private async get<T>(path: string): Promise<T> {
    const resp = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return resp.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const resp = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return resp.json();
  }

  public async getViews(): Promise<View[]> {
    return this.get('/views');
  }

  public async getTrace(args: { traceId: string }): Promise<Trace> {
    return this.get(`/traces/${args.traceId}`);
  }

  public async getTracesFromView(args: {
    viewId: string;
    pageSize: number;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    const params = new URLSearchParams({
      pageSize: args.pageSize.toString(),
    });
    if (args.cursor) {
      params.set('cursor', args.cursor);
    }
    return this.get(`/views/${args.viewId}/traces?${params.toString()}`);
  }

  public async searchTraces(args: {
    pageSize: number;
    timeFilter: RelativeTimeFilter | AbsoluteTimeFilter;
    traceFilters?: TraceFilter[];
    query?: string;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    return this.post(`/traces/search`, {
      pageSize: args.pageSize,
      timeFilter: args.timeFilter,
      traceFilters: args.traceFilters,
      query: args.query,
      cursor: args.cursor,
    });
  }

  public async getDatasets(): Promise<Dataset[]> {
    return this.get('/datasets');
  }

  public async getDataset(args: {
    datasetId: string;
  }): Promise<DatasetWithItems> {
    return this.get(`/datasets/${args.datasetId}`);
  }
}
