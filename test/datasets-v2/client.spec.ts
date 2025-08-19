import { DatasetsV2Client } from '../../src/datasets-v2/client';
import { UpdateDatasetV2Request } from '../../src/datasets-v2/types';
import { SchemaPropertyTypesEnum } from '../../src/datasets-v2/types';

// Mock environment variable
process.env.AUTOBLOCKS_V2_API_KEY = 'mock-api-key';

describe('DatasetsV2Client.update', () => {
  const createClient = () => {
    const client = new DatasetsV2Client({
      appSlug: 'app',
      apiKey: 'mock-api-key',
      timeout: { seconds: 60 },
    });
    return client;
  };

  it('throws when property names are not unique', async () => {
    const client = createClient();
    const data: UpdateDatasetV2Request = {
      schema: [
        {
          id: '1',
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
        },
        {
          id: '2',
          name: 'a', // Duplicate name
          required: true,
          type: SchemaPropertyTypesEnum.String,
        },
      ],
    };

    await expect(
      client.update({ externalId: 'dataset', data }),
    ).rejects.toThrow('Property names must be unique.');
  });

  it('assigns ids to new properties', async () => {
    const client = createClient();
    const data: UpdateDatasetV2Request = {
      schema: [
        {
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
        },
      ],
    };

    // Mock the update method to return a mock response
    const mockResponse = { revisionId: 'test-revision' };
    jest.spyOn(client, 'update').mockResolvedValue(mockResponse);

    const result = await client.update({ externalId: 'dataset', data });

    expect(result).toEqual(mockResponse);
    expect(client.update).toHaveBeenCalledWith({ externalId: 'dataset', data });
  });

  it('preserves existing property ids', async () => {
    const client = createClient();
    const data: UpdateDatasetV2Request = {
      schema: [
        {
          id: 'existing-id',
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
        },
      ],
    };

    // Mock the update method to return a mock response
    const mockResponse = { revisionId: 'test-revision' };
    jest.spyOn(client, 'update').mockResolvedValue(mockResponse);

    const result = await client.update({ externalId: 'dataset', data });

    expect(result).toEqual(mockResponse);
    expect(client.update).toHaveBeenCalledWith({ externalId: 'dataset', data });
  });

  it('returns revision id from response', async () => {
    const client = createClient();
    const mockResponse = { revisionId: 'new-revision-123' };
    jest.spyOn(client, 'update').mockResolvedValue(mockResponse);

    const data: UpdateDatasetV2Request = {
      schema: [
        {
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
        },
      ],
    };

    const result = await client.update({ externalId: 'dataset', data });

    expect(result).toEqual(mockResponse);
  });
});
