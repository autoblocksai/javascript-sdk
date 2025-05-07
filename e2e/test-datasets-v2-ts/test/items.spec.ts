import {
  createTestClient,
  cleanupDataset,
  createUniqueName,
  basicSchema,
} from './setup';

describe('Dataset Items Operations', () => {
  const client = createTestClient();
  let testDatasetId: string;
  let testItemId: string;
  let testRevisionId: string;

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

  it('should add items to the dataset', async () => {
    const items = [
      {
        'Text Field': 'Sample text 1',
        'Number Field': 42,
      },
      {
        'Text Field': 'Sample text 2',
        'Number Field': 43,
      },
    ];

    const createItemsResult = await client.createItems({
      externalId: testDatasetId,
      data: {
        items,
        splitNames: ['train', 'test'],
      },
    });

    expect(createItemsResult.count).toBe(2);
    expect(createItemsResult.revisionId).toBeDefined();

    testRevisionId = createItemsResult.revisionId;
  });

  it('should retrieve items from the dataset', async () => {
    const items = await client.getItems(testDatasetId);

    expect(items.length).toBe(2);

    testItemId = items[0].id;
  });

  it('should retrieve items by revision ID', async () => {
    const itemsByRevision = await client.getItemsByRevision({
      externalId: testDatasetId,
      revisionId: testRevisionId,
    });

    expect(itemsByRevision.length).toBe(2);
  });

  it('should retrieve items by revision ID with split filter', async () => {
    const trainItems = await client.getItemsByRevision({
      externalId: testDatasetId,
      revisionId: testRevisionId,
      splits: ['train'],
    });

    expect(trainItems.length).toBe(2);
    expect(trainItems[0].splits).toContain('train');
    expect(trainItems[1].splits).toContain('train');
  });

  it('should update an item in the dataset', async () => {
    const updateResult = await client.updateItem({
      externalId: testDatasetId,
      itemId: testItemId,
      data: {
        data: {
          'Text Field': 'Updated sample text',
          'Number Field': 100,
        },
        splitNames: ['validation'],
      },
    });

    expect(updateResult.success).toBe(true);

    // Verify the update
    const items = await client.getItems(testDatasetId);
    const updatedItem = items.find((item) => item.id === testItemId);

    expect(updatedItem).toBeDefined();
    expect(updatedItem?.data['Text Field']).toBe('Updated sample text');
    expect(updatedItem?.data['Number Field']).toBe(100);
    expect(updatedItem?.splits).toContain('validation');
  });

  it('should delete an item from the dataset', async () => {
    const deleteResult = await client.deleteItem({
      externalId: testDatasetId,
      itemId: testItemId,
    });

    expect(deleteResult.success).toBe(true);

    // Verify the item is deleted
    const items = await client.getItems(testDatasetId);
    const deletedItem = items.find((item) => item.id === testItemId);

    expect(deletedItem).toBeUndefined();
  });
});
