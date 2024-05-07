import { AutoblocksConfig } from '../../src/configs';
import { z } from 'zod';
import { AutoblocksEnvVar } from '../../src/util';
import {
  RemoteConfigPropertyTypesEnum,
  RemoteConfigResponse,
} from '../../src/configs/types';

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

    afterEach(() => {
      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS];
      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CONFIG_REVISIONS];
    });

    it('gracefully handles error in parser', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig: RemoteConfigResponse = {
        id: 'my-config-id',
        version: '1.0',
        properties: [
          {
            id: 'not-foo',
            value: 'bar',
            values: ['bar'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: {
            major: 1,
            minor: 0,
          },
        },
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

    it('refreshes when using latest', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig: RemoteConfigResponse = {
        id: 'my-config-id',
        version: '1.0',
        properties: [
          {
            id: 'foo',
            value: 'foo',
            values: ['foo'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: {
            major: 1,
            latest: true,
          },
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
        parser: (config) => {
          return z
            .object({
              foo: z.string(),
            })
            .parse(config);
        },
      });
      expect(config.value).toEqual({ foo: 'foo' });

      // now sleep so it refreshes with new values
      const mockConfig2: RemoteConfigResponse = {
        id: 'my-config-id',
        version: '1.1',
        properties: [
          {
            id: 'foo',
            value: 'foo-2',
            values: ['foo-2'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig2),
      });
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(1_001);
      config.close();

      expect(config.value).toEqual({ foo: 'foo-2' });
      expectNumRequests(2);
    }, 5000);

    it('refreshes when using dangerouslyUseUndeployed latest', async () => {
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig: RemoteConfigResponse = {
        id: 'my-config-id',
        version: 'revision:123',
        properties: [
          {
            id: 'foo',
            value: 'foo',
            values: ['foo'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          dangerouslyUseUndeployed: {
            latest: true,
          },
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
        parser: (config) => {
          return z
            .object({
              foo: z.string(),
            })
            .parse(config);
        },
      });
      expect(config.value).toEqual({ foo: 'foo' });

      // now sleep so it refreshes with new values
      const mockConfig2: RemoteConfigResponse = {
        id: 'my-config-id',
        version: 'revision:456',
        properties: [
          {
            id: 'foo',
            value: 'foo-2',
            values: ['foo-2'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig2),
      });
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(1_001);
      config.close();

      expect(config.value).toEqual({ foo: 'foo-2' });
      expectNumRequests(2);
    }, 5000);

    it('does not refresh in testing context', async () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';
      const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
      const mockConfig: RemoteConfigResponse = {
        id: 'my-config-id',
        version: '1.0',
        properties: [
          {
            id: 'foo',
            value: 'foo',
            values: ['foo'],
            type: RemoteConfigPropertyTypesEnum.ENUM,
          },
        ],
      };
      // @ts-expect-error we don't need to mock everything here...
      mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: {
            major: 1,
            latest: true,
          },
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
        parser: (config) => {
          return z
            .object({
              foo: z.string(),
            })
            .parse(config);
        },
      });
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(1_001);
      config.close();
      expectNumRequests(1);
    }, 5000);

    describe('Correctly Maps API Request', () => {
      const expectApiUrl = (url: string) => {
        expect(mockFetch.mock.calls[0][0]).toEqual(url);
      };

      it('maps version', async () => {
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig: RemoteConfigResponse = {
          id: 'my-config-id',
          version: '1.0',
          properties: [
            {
              id: 'foo',
              value: 'from-remote',
              values: ['from-remote'],
              type: RemoteConfigPropertyTypesEnum.ENUM,
            },
          ],
        };
        // @ts-expect-error we don't need to mock everything here...
        mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockConfig),
        });

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            version: {
              major: 1,
              minor: 0,
            },
          },
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
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/major/1/minor/0',
        );
        expect(config.value).toEqual({ foo: 'from-remote' });
      });

      it('maps latest', async () => {
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig: RemoteConfigResponse = {
          id: 'my-config-id',
          version: '1.0',
          properties: [
            {
              id: 'foo',
              value: 'from-remote',
              values: ['from-remote'],
              type: RemoteConfigPropertyTypesEnum.ENUM,
            },
          ],
        };
        // @ts-expect-error we don't need to mock everything here...
        mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockConfig),
        });

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            version: {
              major: 1,
              latest: true,
            },
          },
          apiKey: 'mock-api-key',
          // set high so test is deterministic
          refreshInterval: { minutes: 30 },
          parser: (config) => {
            return z
              .object({
                foo: z.string(),
              })
              .parse(config);
          },
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/major/1/minor/latest',
        );
        expect(config.value).toEqual({ foo: 'from-remote' });
        config.close();
      });

      it('maps dangerouslyUseUndeployed revisionId', async () => {
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig: RemoteConfigResponse = {
          id: 'my-config-id',
          version: 'revision:123',
          properties: [
            {
              id: 'foo',
              value: 'from-remote',
              values: ['from-remote'],
              type: RemoteConfigPropertyTypesEnum.ENUM,
            },
          ],
        };
        // @ts-expect-error we don't need to mock everything here...
        mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockConfig),
        });

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            dangerouslyUseUndeployed: {
              revisionId: '123',
            },
          },
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
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/123',
        );
        expect(config.value).toEqual({ foo: 'from-remote' });
      });

      it('maps dangerouslyUseUndeployed latest', async () => {
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig: RemoteConfigResponse = {
          id: 'my-config-id',
          version: 'revision:123',
          properties: [
            {
              id: 'foo',
              value: 'from-remote',
              values: ['from-remote'],
              type: RemoteConfigPropertyTypesEnum.ENUM,
            },
          ],
        };
        // @ts-expect-error we don't need to mock everything here...
        mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockConfig),
        });

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            dangerouslyUseUndeployed: {
              latest: true,
            },
          },
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
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/latest',
        );
        expect(config.value).toEqual({ foo: 'from-remote' });
        config.close();
      });

      it('uses config revisions environment variable', async () => {
        process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
          'http://localhost:3000';
        process.env[AutoblocksEnvVar.AUTOBLOCKS_CONFIG_REVISIONS] =
          JSON.stringify({
            'my-config-id': '123',
          });
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig: RemoteConfigResponse = {
          id: 'my-config-id',
          version: 'revision:123',
          properties: [
            {
              id: 'foo',
              value: 'from-remote',
              values: ['from-remote'],
              type: RemoteConfigPropertyTypesEnum.ENUM,
            },
          ],
        };
        // @ts-expect-error we don't need to mock everything here...
        mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockConfig),
        });

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            version: {
              major: 1,
              minor: 0,
            },
          },
          apiKey: 'mock-api-key',
          refreshInterval: { seconds: 1 },
          parser: (config) => {
            return z
              .object({
                foo: z.string(),
              })
              .parse(config);
          },
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/123',
        );
        expect(config.value).toEqual({ foo: 'from-remote' });
      });
    });
  });
});
