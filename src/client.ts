import axios, { AxiosInstance } from 'axios';
import { type TimeDelta, convertTimeDeltaToMilliSeconds } from './util';

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

export class AutoblocksAPIClient {
  private client: AxiosInstance;

  constructor(
    apiToken: string,
    args?: {
      timeout?: TimeDelta;
    },
  ) {
    this.client = axios.create({
      baseURL: 'https://api.autoblocks.ai',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      timeout: convertTimeDeltaToMilliSeconds(args?.timeout || { seconds: 10 }),
    });
  }

  public async getViews(): Promise<View[]> {
    const { data } = await this.client.get('/views');
    return data;
  }

  public async getTrace(args: { traceId: string }): Promise<Trace> {
    const { data } = await this.client.get(`/traces/${args.traceId}`);
    return data;
  }

  public async getTracesFromView(args: {
    viewId: string;
    pageSize: number;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    const { data } = await this.client.get(`/views/${args.viewId}/traces`, {
      params: {
        pageSize: args.pageSize,
        cursor: args.cursor || '',
      },
    });
    return data;
  }

  public async searchTraces(args: {
    pageSize: number;
    timeFilter: RelativeTimeFilter | AbsoluteTimeFilter;
    traceFilters?: TraceFilter[];
    query?: string;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    const { data } = await this.client.post(`/traces/search`, {
      pageSize: args.pageSize,
      timeFilter: args.timeFilter,
      traceFilters: args.traceFilters,
      query: args.query,
      cursor: args.cursor,
    });
    return data;
  }

  public async getDatasets(): Promise<Dataset[]> {
    const { data } = await this.client.get('/datasets');
    return data;
  }

  public async getDataset(args: {
    datasetId: string;
  }): Promise<DatasetWithItems> {
    const { data } = await this.client.get(`/datasets/${args.datasetId}`);
    return data;
  }
}
