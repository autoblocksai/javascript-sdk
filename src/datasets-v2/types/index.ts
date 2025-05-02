import type { SchemaProperty } from './schema';
export * from './schema';
export * from './conversation';

/**
 * Dataset V2
 */
export interface DatasetV2 {
  id: string;
  externalId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/**
 * Dataset list item
 */
export interface DatasetListItemV2 {
  id: string;
  externalId: string;
  name: string;
  description: string | null;
  latestRevisionId: string | null;
}

/**
 * Dataset schema
 */
export interface DatasetSchemaV2 {
  id: string;
  externalId: string;
  description: string | null;
  schema: SchemaProperty[] | null;
  schemaVersion: number;
}

/**
 * Dataset item
 */
export interface DatasetItemV2 {
  id: string;
  revisionItemId?: string;
  splits: string[];
  data: Record<string, unknown>;
}

/**
 * Dataset items response
 */
export interface DatasetItemsResponseV2 {
  datasetId: string;
  externalId: string;
  revisionId: string;
  schemaVersion: number;
  items: DatasetItemV2[];
}

/**
 * Create dataset request
 */
export interface CreateDatasetV2Request {
  name: string;
  description?: string;
  schema: SchemaProperty[];
}

/**
 * Create dataset items request
 */
export interface CreateDatasetItemsV2Request {
  items: Record<string, unknown>[];
  splitNames?: string[];
}

/**
 * Update item request
 */
export interface UpdateItemV2Request {
  data: Record<string, unknown>;
  splitNames?: string[];
}
