import { AutoblocksConfig } from '@autoblocks/client/configs';
import { z } from 'zod';

const zRemoteConfigSchema = z.object({
  my_val: z.string().min(1),
});

type RemoteConfigSchema = z.infer<typeof zRemoteConfigSchema>;

describe('AutoblocksConfig', () => {
  it('activates latest deployed', async () => {
    const config = new AutoblocksConfig<RemoteConfigSchema>({
      my_val: 'default',
    });
    await config.activateFromRemote({
      config: {
        id: 'used-by-ci-dont-delete',
        version: {
          major: 1,
          latest: true,
        },
      },
      parser: zRemoteConfigSchema.parse,
    });
    expect(config.value).toEqual({
      my_val: 'val-from-remote',
    });
    config.close();
  });

  it('activates specific version', async () => {
    const config = new AutoblocksConfig<RemoteConfigSchema>({
      my_val: 'default',
    });
    await config.activateFromRemote({
      config: {
        id: 'used-by-ci-dont-delete',
        version: {
          major: 1,
          minor: 0,
        },
      },
      parser: zRemoteConfigSchema.parse,
    });
    expect(config.value).toEqual({
      my_val: 'val-from-remote',
    });
  });

  it('activates latest undeployed', async () => {
    const config = new AutoblocksConfig<RemoteConfigSchema>({
      my_val: 'default',
    });
    await config.activateFromRemote({
      config: {
        id: 'used-by-ci-dont-delete',
        dangerouslyUseUndeployed: {
          latest: true,
        },
      },
      parser: zRemoteConfigSchema.parse,
      apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
    });
    expect(config.value).toEqual({
      my_val: 'val-from-remote-undeployed',
    });
    config.close();
  });

  it('activates specific undeployed revision', async () => {
    const config = new AutoblocksConfig<RemoteConfigSchema>({
      my_val: 'default',
    });
    await config.activateFromRemote({
      config: {
        id: 'used-by-ci-dont-delete',
        dangerouslyUseUndeployed: {
          revisionId: 'clvlcgpiq0003qtvsbz5vt7e0',
        },
      },
      parser: zRemoteConfigSchema.parse,
      apiKey: process.env.AUTOBLOCKS_API_KEY_USER,
    });
    expect(config.value).toEqual({
      my_val: 'val-from-remote-undeployed',
    });
    config.close();
  });
});
