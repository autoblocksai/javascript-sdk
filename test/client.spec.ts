import { AutoblocksAPIClient } from '../src/index';
import { API_ENDPOINT, AutoblocksEnvVar } from '../src/util';

describe('Autoblocks Client', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      // @ts-expect-error - TS wants me to fully mock a fetch response, but we only
      // need the json() method
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  describe('constructor', () => {
    it('accepts api key as first arg (deprecated constructor)', async () => {
      const client = new AutoblocksAPIClient('mock-api-key');
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });
    });

    it('accepts api key in args', async () => {
      const client = new AutoblocksAPIClient({ apiKey: 'mock-api-key' });
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });
    });

    it('accepts api key as environment variable', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = 'mock-api-key';

      const client = new AutoblocksAPIClient();
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(60_000),
      });

      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      async (timeout, expected) => {
        const client = new AutoblocksAPIClient('mock-api-key', { timeout });
        await client.getViews();

        expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
            Authorization: 'Bearer mock-api-key',
          },
          signal: AbortSignal.timeout(expected),
        });
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", async (timeout, expected) => {
      const client = new AutoblocksAPIClient({
        apiKey: 'mock-api-key',
        timeout,
      });
      await client.getViews();

      expect(mockFetch).toHaveBeenCalledWith(`${API_ENDPOINT}/views`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          Authorization: 'Bearer mock-api-key',
        },
        signal: AbortSignal.timeout(expected),
      });
    });
  });
});
