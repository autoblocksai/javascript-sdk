import axios, { AxiosInstance } from 'axios';

export interface View {
  id: string;
  name: string;
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

export class AutoblocksAPIClient {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.autoblocks.ai',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
  }

  public async getViews(): Promise<View[]> {
    const { data } = await this.client.get('/views');
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
}
