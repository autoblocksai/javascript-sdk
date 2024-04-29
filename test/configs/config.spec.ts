import { AutoblocksConfig } from '../../src/configs';
import { z } from 'zod';
import { AutoblocksEnvVar } from '../../src/util';

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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: '1',
        },
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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: '1',
        },
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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: '1',
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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          version: '1',
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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          latest: true,
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
      });
      expect(config.value).toEqual({ foo: 'foo' });

      // now sleep so it refreshes with new values
      const mockConfig2 = {
        id: 'my-config-id',
        version: '2',
        value: {
          foo: 'foo-2',
        },
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

      await config.activateFromRemote({
        config: {
          id: 'my-config-id',
          dangerouslyUseUndeployed: {
            latest: true,
          },
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
      });
      expect(config.value).toEqual({ foo: 'foo' });

      // now sleep so it refreshes with new values
      const mockConfig2 = {
        id: 'my-config-id',
        version: '2',
        value: {
          foo: 'foo-2',
        },
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
      const mockConfig = {
        id: 'my-config-id',
        version: '1',
        value: {
          foo: 'bar',
        },
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
          latest: true,
        },
        apiKey: 'mock-api-key',
        refreshInterval: { seconds: 1 },
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

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            version: '1',
          },
          apiKey: 'mock-api-key',
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/versions/1',
        );
      });

      it('maps latest', async () => {
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

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            latest: true,
          },
          apiKey: 'mock-api-key',
          // set high so test is deterministic
          refreshInterval: { minutes: 30 },
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/versions/latest',
        );
        config.close();
      });

      it('maps dangerouslyUseUndeployed revisionId', async () => {
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

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            dangerouslyUseUndeployed: {
              revisionId: 'my-revision-id',
            },
          },
          apiKey: 'mock-api-key',
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/my-revision-id',
        );
      });

      it('maps dangerouslyUseUndeployed latest', async () => {
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

        await config.activateFromRemote({
          config: {
            id: 'my-config-id',
            dangerouslyUseUndeployed: {
              latest: true,
            },
          },
          apiKey: 'mock-api-key',
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/latest',
        );
        config.close();
      });

      it('uses config revisions environment variable', async () => {
        process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
          'http://localhost:3000';
        process.env[AutoblocksEnvVar.AUTOBLOCKS_CONFIG_REVISIONS] =
          JSON.stringify({
            'my-config-id': 'my-revision-id',
          });
        const config = new AutoblocksConfig<{ foo: string }>({ foo: 'bar' });
        const mockConfig = {
          id: 'my-config-id',
          version: '1',
          value: {
            foo: 'bar',
          },
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
            version: '1',
          },
          apiKey: 'mock-api-key',
          refreshInterval: { seconds: 1 },
        });
        expectNumRequests(1);
        expectApiUrl(
          'https://api.autoblocks.ai/configs/my-config-id/revisions/my-revision-id',
        );
      });
    });
  });
});
