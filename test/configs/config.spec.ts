import { AutoblocksConfig } from '../../src/configs';
import { z } from 'zod';

describe('AutoblocksConfig', () => {
  it('sets and gets default values', () => {
    const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
    expect(config.value).toEqual({ foo: 'bar' });
  });

  describe('Activate Remote Config', () => {
    let mockFetch: jest.SpyInstance;

    const expectNumRequests = (num: number) => {
      expect(mockFetch).toHaveBeenCalledTimes(num);
    };

    it('activates a remote config without a parser', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig = {
        id: 'my-config-id',
        version: '1',
        value: {
          foo: 'foo',
        },
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateRemoteConfig({
        id: 'my-config-id',
        version: '1',
        apiKey: 'mock-api-key',
      });
      expectNumRequests(1);
      expect(config.value).toEqual({ foo: 'foo' });
    });

    it('activates a remote config without a parser and sets values to whatever comes back from api', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig = {
        id: 'my-config-id',
        version: '1',
        value: {
          random: 'bar',
        },
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateRemoteConfig({
        id: 'my-config-id',
        version: '1',
        apiKey: 'mock-api-key',
      });
      expectNumRequests(1);
      expect(config.value).toEqual({ random: 'bar' });
    });

    it('activates a remote config with a parser', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig = {
        id: 'my-config-id',
        version: '1',
        value: {
          foo: 'foo',
        },
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateRemoteConfig({
        id: 'my-config-id',
        version: '1',
        apiKey: 'mock-api-key',
        parser: (config) => {
          return z
            .object({
              foo: z.string(),
            })
            .parse(config);
        },
      });
      expectNumRequests(1);
      expect(config.value).toEqual({ foo: 'foo' });
    });

    it('activates a remote config with a parser and handles error', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig = {
        id: 'my-config-id',
        version: '1',
        value: {
          random: 'bar',
        },
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateRemoteConfig({
        id: 'my-config-id',
        version: '1',
        apiKey: 'mock-api-key',
        parser: (config) => {
          return z
            .object({
              foo: z.string(),
            })
            .parse(config);
        },
      });
      expectNumRequests(1);
      expect(config.value).toEqual({ foo: 'bar' });
    });
  });
});
