import {
  AUTOBLOCKS_HEADERS,
  AutoblocksEnvVar,
  V2_API_ENDPOINT,
  convertTimeDeltaToMilliSeconds,
  readEnv,
} from '../util';

import type { TimeDelta } from '../types';

export abstract class BaseAppResourceClient {
  protected readonly apiKey: string | undefined;
  protected readonly appSlug: string;
  protected readonly timeout: number;

  constructor(config: {
    apiKey?: string;
    appSlug: string;
    timeout?: TimeDelta;
  }) {
    this.apiKey =
      config.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);

    this.appSlug = config.appSlug;
    this.timeout = convertTimeDeltaToMilliSeconds(
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
      signal: AbortSignal.timeout(this.timeout),
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
      signal: AbortSignal.timeout(this.timeout),
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
      signal: AbortSignal.timeout(this.timeout),
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
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      return resp.json();
    }

    return resp.json();
  }
}
