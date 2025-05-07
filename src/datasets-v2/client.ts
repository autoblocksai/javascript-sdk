import {
  AUTOBLOCKS_HEADERS,
  AutoblocksEnvVar,
  V2_API_ENDPOINT,
  convertTimeDeltaToMilliSeconds,
  readEnv,
} from '../util';

import * as cuid2 from '@paralleldrive/cuid2';

import type { TimeDelta } from '../types';
import type {
  DatasetV2,
  DatasetListItemV2,
  DatasetSchemaV2,
  CreateDatasetV2Request,
  CreateDatasetItemsV2Request,
  UpdateItemV2Request,
  DatasetItemV2,
} from './types';

export class DatasetsV2Client {
  private readonly apiKey: string | undefined;
  private readonly appSlug: string;
  private readonly timeout: number;

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

  private async get<T>(path: string): Promise<T> {
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

  private async post<T>(path: string, body: unknown): Promise<T> {
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

  private async put<T>(path: string, body: unknown): Promise<T> {
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

  private async delete<T>(path: string): Promise<T> {
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

  /**
   * List all datasets in the app
   */
  async list(): Promise<DatasetListItemV2[]> {
    return this.get<DatasetListItemV2[]>(`/apps/${this.appSlug}/datasets`);
  }

  /**
   * Create a new dataset
   *
   * Schema property IDs will be automatically generated.
   */
  async create(dataset: CreateDatasetV2Request): Promise<DatasetV2> {
    // Clone the dataset and assign IDs to schema properties
    const datasetWithIds = {
      ...dataset,
      schema: dataset.schema.map((property) => ({
        ...property,
        id: cuid2.createId(), // Generate a new ID for each property
      })),
    };

    return this.post<DatasetV2>(
      `/apps/${this.appSlug}/datasets`,
      datasetWithIds,
    );
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
  async getItems(externalId: string): Promise<DatasetItemV2[]> {
    return this.get<DatasetItemV2[]>(
      `/apps/${this.appSlug}/datasets/${externalId}/items`,
    );
  }

  /**
   * Add items to a dataset
   */
  async createItems(params: {
    externalId: string;
    data: CreateDatasetItemsV2Request;
  }): Promise<{ count: number; revisionId: string }> {
    return this.post<{ count: number; revisionId: string }>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/items`,
      params.data,
    );
  }

  /**
   * Get schema for a specific version
   */
  async getSchemaByVersion(params: {
    externalId: string;
    schemaVersion: number;
  }): Promise<DatasetSchemaV2> {
    return this.get<DatasetSchemaV2>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/schema-versions/${params.schemaVersion}`,
    );
  }

  /**
   * Get items by revision ID
   */
  async getItemsByRevision(params: {
    externalId: string;
    revisionId: string;
    splits?: string[];
  }): Promise<DatasetItemV2[]> {
    const queryString = params.splits?.length
      ? `?splits=${params.splits.join(',')}`
      : '';
    return this.get<DatasetItemV2[]>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/revisions/${params.revisionId}/items${queryString}`,
    );
  }

  /**
   * Get items by schema version
   */
  async getItemsBySchemaVersion(params: {
    externalId: string;
    schemaVersion: number;
    splits?: string[];
  }): Promise<DatasetItemV2[]> {
    const queryString = params.splits?.length
      ? `?splits=${params.splits.join(',')}`
      : '';
    return this.get<DatasetItemV2[]>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/schema-versions/${params.schemaVersion}/items${queryString}`,
    );
  }

  /**
   * Update a dataset item
   */
  async updateItem(params: {
    externalId: string;
    itemId: string;
    data: UpdateItemV2Request;
  }): Promise<{ success: boolean }> {
    return this.put<{ success: boolean }>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/items/${params.itemId}`,
      params.data,
    );
  }

  /**
   * Delete a dataset item
   */
  async deleteItem(params: {
    externalId: string;
    itemId: string;
  }): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(
      `/apps/${this.appSlug}/datasets/${params.externalId}/items/${params.itemId}`,
    );
  }
}
