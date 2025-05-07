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
    const dataset = await client.datasets.create({
      name: createUniqueName('Basic Dataset'),
      schema: basicSchema,
    });

    testDatasetId = dataset.externalId;
  });

  afterAll(async () => {
    await cleanupDataset(client, testDatasetId);
  });

  it('should list datasets and include the test dataset', async () => {
    const datasets = await client.datasets.list();

    expect(datasets.length).toBeGreaterThan(0);
    const testDataset = datasets.find((d) => d.externalId === testDatasetId);
    expect(testDataset).toBeDefined();
  });

  it('should create and delete a temporary dataset', async () => {
    const tempDataset = await client.datasets.create({
      name: createUniqueName('Temp Dataset'),
      schema: basicSchema,
    });

    expect(tempDataset.externalId).toBeDefined();

    const deleteResult = await client.datasets.destroy(tempDataset.externalId);

    expect(deleteResult.success).toBe(true);

    const datasets = await client.datasets.list();

    const deletedDataset = datasets.find(
      (d) => d.externalId === tempDataset.externalId,
    );

    expect(deletedDataset).toBeUndefined();
  });
});
