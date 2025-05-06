import {
  createTestClient,
  createUniqueName,
  cleanupDataset,
  basicSchema,
} from './setup';

describe('Dataset Basic CRUD Operations', () => {
  const client = createTestClient();
  let testDatasetId: string;

  beforeAll(async () => {
    const dataset = await client.create({
      name: createUniqueName('Basic Dataset'),
      schema: basicSchema,
    });

    testDatasetId = dataset.externalId;
  });

  afterAll(async () => {
    await cleanupDataset(client, testDatasetId);
  });

  it('should list datasets and include the test dataset', async () => {
    const datasets = await client.list();

    expect(datasets.length).toBeGreaterThan(0);
    const testDataset = datasets.find((d) => d.externalId === testDatasetId);
    expect(testDataset).toBeDefined();
  });

  it('should create and delete a temporary dataset', async () => {
    const tempDataset = await client.create({
      name: createUniqueName('Temp Dataset'),
      description: 'Temporary dataset for deletion test',
      schema: basicSchema,
    });

    expect(tempDataset.externalId).toBeDefined();

    const deleteResult = await client.destroy(tempDataset.externalId);

    expect(deleteResult.success).toBe(true);

    const datasets = await client.list();

    const deletedDataset = datasets.find(
      (d) => d.externalId === tempDataset.externalId,
    );

    expect(deletedDataset).toBeUndefined();
  });
});
