import { V2_API_ENDPOINT } from '../util';
import type {
  DatasetV2,
  DatasetListItemV2,
  DatasetSchemaV2,
  DatasetItemsResponseV2,
  CreateDatasetV2Request,
  CreateDatasetItemsV2Request,
  UpdateItemV2Request,
} from './types';

export class DatasetsV2Client {
  private readonly apiKey: string;
  private readonly appSlug: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey: string; appSlug: string; timeoutMs?: number }) {
    this.apiKey = config.apiKey;
    this.appSlug = config.appSlug;
    this.timeoutMs = config.timeoutMs || 60000;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Autoblocks-SDK': 'javascript-datasets-v2',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: GET ${url} "${resp.status} ${resp.statusText}"`,
      );
    }

    return resp.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Autoblocks-SDK': 'javascript-datasets-v2',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: POST ${url} "${resp.status} ${resp.statusText}"`,
      );
    }

    return resp.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Autoblocks-SDK': 'javascript-datasets-v2',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: PUT ${url} "${resp.status} ${resp.statusText}"`,
      );
    }

    return resp.json();
  }

  private async delete<T>(path: string): Promise<T> {
    const url = `${V2_API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Autoblocks-SDK': 'javascript-datasets-v2',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: DELETE ${url} "${resp.status} ${resp.statusText}"`,
      );
    }

    return resp.json();
  }

  /**
   * List all datasets in the app
   */
  async list(): Promise<DatasetListItemV2[]> {
    return this.get<DatasetListItemV2[]>(`/apps/${this.appSlug}/datasets`);
  }

  /**
   * Create a new dataset
   */
  async create(dataset: CreateDatasetV2Request): Promise<DatasetV2> {
    return this.post<DatasetV2>(`/apps/${this.appSlug}/datasets`, dataset);
  }

  /**
   * Delete a dataset
   */
  async destroy(externalId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(
      `/apps/${this.appSlug}/datasets/${externalId}`,
    );
  }

  /**
   * Get all items for a dataset
   */
  async getItems(externalId: string): Promise<DatasetItemsResponseV2> {
    return this.get<DatasetItemsResponseV2>(
      `/apps/${this.appSlug}/datasets/${externalId}/items`,
    );
  }

  /**
   * Add items to a dataset
   */
  async createItems(
    externalId: string,
    request: CreateDatasetItemsV2Request,
  ): Promise<{ count: number; revisionId: string }> {
    return this.post<{ count: number; revisionId: string }>(
      `/apps/${this.appSlug}/datasets/${externalId}/items`,
      request,
    );
  }

  /**
   * Get schema for a specific version
   */
  async getSchemaByVersion(
    externalId: string,
    schemaVersion: number,
  ): Promise<DatasetSchemaV2> {
    return this.get<DatasetSchemaV2>(
      `/apps/${this.appSlug}/datasets/${externalId}/schema-versions/${schemaVersion}`,
    );
  }

  /**
   * Get items by revision ID
   */
  async getItemsByRevision(
    externalId: string,
    revisionId: string,
    splits?: string[],
  ): Promise<DatasetItemsResponseV2> {
    const queryString = splits?.length ? `?splits=${splits.join(',')}` : '';
    return this.get<DatasetItemsResponseV2>(
      `/apps/${this.appSlug}/datasets/${externalId}/revisions/${revisionId}${queryString}`,
    );
  }

  /**
   * Get items by schema version
   */
  async getItemsBySchemaVersion(
    externalId: string,
    schemaVersion: number,
    splits?: string[],
  ): Promise<DatasetItemsResponseV2> {
    const queryString = splits?.length ? `?splits=${splits.join(',')}` : '';
    return this.get<DatasetItemsResponseV2>(
      `/apps/${this.appSlug}/datasets/${externalId}/schema-versions/${schemaVersion}/items${queryString}`,
    );
  }

  /**
   * Update a dataset item
   */
  async updateItem(
    externalId: string,
    itemId: string,
    request: UpdateItemV2Request,
  ): Promise<{ success: boolean }> {
    return this.put<{ success: boolean }>(
      `/apps/${this.appSlug}/datasets/${externalId}/items/${itemId}`,
      request,
    );
  }

  /**
   * Delete a dataset item
   */
  async deleteItem(
    externalId: string,
    itemId: string,
  ): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(
      `/apps/${this.appSlug}/datasets/${externalId}/items/${itemId}`,
    );
  }
}

/**
 * Create a new datasets v2 client
 */
export function createDatasetsV2Client(config: {
  apiKey: string;
  appSlug: string;
  timeoutMs?: number;
}): DatasetsV2Client {
  return new DatasetsV2Client(config);
}
