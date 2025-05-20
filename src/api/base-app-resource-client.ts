import {
  AUTOBLOCKS_HEADERS,
  AutoblocksEnvVar,
  V2_API_ENDPOINT,
  convertTimeDeltaToMilliSeconds,
  readEnv,
} from '../util';

import type { TimeDelta } from '../types';

export abstract class BaseAppResourceClient {
  protected readonly apiKey: string;
  protected readonly appSlug: string;
  protected readonly timeoutMS: number;

  constructor(config: {
    apiKey?: string;
    appSlug: string;
    timeout?: TimeDelta;
  }) {
    const key =
      config.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);
    if (!key) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = key;

    this.appSlug = config.appSlug;
    this.timeoutMS = convertTimeDeltaToMilliSeconds(
      config.timeout || { seconds: 60 },
    );
  }

  protected async get<T>(path: string): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMS),
    });

    if (!resp.ok) {
      return resp.json();
    }

    return resp.json();
  }

  protected async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMS),
    });

    if (!resp.ok) {
      return resp.json();
    }

    return resp.json();
  }

  protected async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMS),
    });

    if (!resp.ok) {
      return resp.json();
    }

    return resp.json();
  }

  protected async delete<T>(path: string): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMS),
    });

    if (!resp.ok) {
      return resp.json();
    }

    return resp.json();
  }
}
