import { AutoblocksAppClient } from '../../src/api/app-client';
import { SchemaPropertyTypesEnum } from '../../src/datasets-v2/types';
import { AutoblocksEnvVar } from '../../src/util';

describe('AutoblocksAppClient (v2)', () => {
  let mockFetch: jest.SpyInstance;
  const appSlug = 'test-app';
  const apiKey = 'mock-v2-api-key';

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - Only need json
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY];
  });

  describe('constructor', () => {
    it('accepts apiKey and appSlug in args', async () => {
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      expect(client.datasets).toBeDefined();
      expect(client.humanReview).toBeDefined();
    });

    it('accepts apiKey from environment variable', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY] = apiKey;
      const client = new AutoblocksAppClient({ appSlug });
      expect(client.datasets).toBeDefined();
      expect(client.humanReview).toBeDefined();
    });
  });

  describe('datasets', () => {
    it('calls datasets.list()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ externalId: 'ds1' }]),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const datasets = await client.datasets.list();
      expect(datasets[0].externalId).toBe('ds1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.create()', async () => {
      const mockDataset = {
        name: 'Test Dataset',
        externalId: 'ds2',
        schema: [{ name: 'field', type: SchemaPropertyTypesEnum.String }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDataset),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const created = await client.datasets.create({
        name: 'Test Dataset',
        schema: [
          {
            name: 'field',
            type: SchemaPropertyTypesEnum.String,
            required: true,
          },
        ],
      });
      expect(created.externalId).toBe('ds2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.destroy()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.datasets.destroy({ externalId: 'ds2' });
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2`),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.getItems()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'item1' }]),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const items = await client.datasets.getItems({ externalId: 'ds2' });
      expect(items[0].id).toBe('item1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2/items`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.createItems()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 2, revisionId: 'rev1' }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.datasets.createItems({
        externalId: 'ds2',
        data: { items: [{ foo: 'bar' }] },
      });
      expect(result.count).toBe(2);
      expect(result.revisionId).toBe('rev1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2/items`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.getSchemaByVersion()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemaVersion: 1 }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const schema = await client.datasets.getSchemaByVersion({
        externalId: 'ds2',
        schemaVersion: 1,
      });
      expect(schema.schemaVersion).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2/schema/1`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.getItemsByRevision()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'item2' }]),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const items = await client.datasets.getItemsByRevision({
        externalId: 'ds2',
        revisionId: 'rev1',
        splits: ['split1'],
      });
      expect(items[0].id).toBe('item2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/datasets/ds2/revisions/rev1/items?splits=split1`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.getItemsBySchemaVersion()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'item3' }]),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const items = await client.datasets.getItemsBySchemaVersion({
        externalId: 'ds2',
        schemaVersion: 1,
        splits: ['split1'],
      });
      expect(items[0].id).toBe('item3');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/datasets/ds2/schema/1/items?splits=split1`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.updateItem()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.datasets.updateItem({
        externalId: 'ds2',
        itemId: 'item1',
        data: {
          data: {
            foo: 'bar',
          },
        },
      });
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2/items/item1`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls datasets.deleteItem()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.datasets.deleteItem({
        externalId: 'ds2',
        itemId: 'item1',
      });
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/datasets/ds2/items/item1`),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });
  });

  describe('humanReview', () => {
    it('calls humanReview.listJobs()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [{ id: 'job1' }] }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const jobs = await client.humanReview.listJobs();
      expect(jobs.jobs[0].id).toBe('job1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/human-review/jobs`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJob()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'job2' }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const job = await client.humanReview.getJob('job2');
      expect(job.id).toBe('job2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/apps/${appSlug}/human-review/jobs/job2`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJobItem()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'item2' }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const item = await client.humanReview.getJobItem({
        jobId: 'job2',
        itemId: 'item2',
      });
      expect(item.id).toBe('item2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/human-review/jobs/job2/items/item2`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJobTestCases()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            testCases: [{ id: 'tc1', input: { a: 'b' }, output: { c: 'd' } }],
          }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.humanReview.getJobTestCases('job2');
      expect(result.testCases[0].id).toBe('tc1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/human-review/jobs/job2/test_cases`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJobTestCaseResult()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'tc1', result: { foo: 'bar' } }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.humanReview.getJobTestCaseResult({
        jobId: 'job2',
        testCaseId: 'tc1',
      });
      expect(result.id).toBe('tc1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/human-review/jobs/job2/test_cases/tc1/result`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJobPairs()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            pairs: [{ id: 'pair1', leftOutput: 'l', rightOutput: 'r' }],
          }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.humanReview.getJobPairs('job2');
      expect(result.pairs[0].id).toBe('pair1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/human-review/jobs/job2/pairs`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('calls humanReview.getJobPair()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pair1',
            leftOutput: 'l',
            rightOutput: 'r',
            winner: 'l',
          }),
      });
      const client = new AutoblocksAppClient({ appSlug, apiKey });
      const result = await client.humanReview.getJobPair({
        jobId: 'job2',
        pairId: 'pair1',
      });
      expect(result.id).toBe('pair1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/apps/${appSlug}/human-review/jobs/job2/pairs/pair1`,
        ),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });
  });
});
