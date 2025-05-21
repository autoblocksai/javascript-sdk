import { BaseAppResourceClient } from '../api/base-app-resource-client';
import {
  DatasetListItemV2,
  DatasetV2,
  CreateDatasetV2Request,
  CreateDatasetItemsV2Request,
  UpdateItemV2Request,
  DatasetItemV2,
  DatasetSchemaV2,
} from './types';
import * as cuid2 from '@paralleldrive/cuid2';

export class DatasetsV2Client extends BaseAppResourceClient {
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
