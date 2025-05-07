import {
  AutoblocksAppClient,
  SchemaProperty,
  SchemaPropertyTypesEnum,
} from '@autoblocks/client';

import {} from '@autoblocks/client/prompts';

// Shared constants
export const APP_SLUG = 'ci-app';
export const TEST_TIMEOUT = 30000;

// Common schema definitions
export const basicSchema: SchemaProperty[] = [
  {
    name: 'Text Field',
    type: SchemaPropertyTypesEnum.String,
    required: true,
  },
  {
    name: 'Number Field',
    type: SchemaPropertyTypesEnum.Number,
    required: false,
  },
];

// Helper for creating a client
export function createTestClient() {
  const appClient = new AutoblocksAppClient({
    apiKey: process.env.AUTOBLOCKS_V2_API_KEY,
    appSlug: APP_SLUG,
    timeout: { milliseconds: TEST_TIMEOUT },
  });
  return appClient.datasets;
}

// Helper for creating a unique dataset name
export function createUniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Helper for cleaning up a dataset
export async function cleanupDataset(
  client: DatasetsV2Client,
  datasetId: string,
): Promise<void> {
  if (datasetId) {
    await client.destroy(datasetId);
    console.log(`Cleaned up dataset: ${datasetId}`);
  }
}

// Set longer timeout for all tests
jest.setTimeout(60000);
