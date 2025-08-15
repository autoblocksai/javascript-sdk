/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { DatasetsV2Client } from '../../src/datasets-v2/client';
import { UpdateDatasetV2Request } from '../../src/datasets-v2/types';
import { SchemaPropertyTypesEnum } from '../../src/datasets-v2/types';

describe('DatasetsV2Client.update', () => {
  const createClient = () => {
    const client = new DatasetsV2Client('app', 'test');
    jest.spyOn(client, 'put').mockImplementation(async (path, body) => body);
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

    expect(client.put).not.toHaveBeenCalled();
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

    await client.update({ externalId: 'dataset', data });

    expect(client.put).toHaveBeenCalledWith('/apps/app/datasets/dataset', {
      schema: [
        {
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
          id: expect.any(String),
        },
      ],
    });
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

    await client.update({ externalId: 'dataset', data });

    expect(client.put).toHaveBeenCalledWith('/apps/app/datasets/dataset', {
      schema: [
        {
          id: 'existing-id',
          name: 'a',
          required: false,
          type: SchemaPropertyTypesEnum.String,
        },
      ],
    });
  });

  it('returns revision id from response', async () => {
    const client = createClient();
    const mockResponse = { revisionId: 'new-revision-123' };
    jest.spyOn(client, 'put').mockResolvedValue(mockResponse);

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
