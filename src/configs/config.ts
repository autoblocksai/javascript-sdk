import { TimeDelta } from '../types';
import {
  API_ENDPOINT,
  AutoblocksEnvVar,
  readEnv,
  AUTOBLOCKS_HEADERS,
  convertTimeDeltaToMilliSeconds,
  RevisionSpecialVersionsEnum,
} from '../util';
import { Config, RemoteConfig, zConfigSchema } from './types';

/**
 * Note that we check for the presence of the CLI environment
 * variable and not the test case local storage because the
 * local storage vars aren't set until runTestSuite is called,
 * whereas a AutoblocksConfig might have already been imported
 * and activated by the time runTestSuite is called.
 */
const isTestingContext = (): boolean => {
  return readEnv(AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS) !== undefined;
};

/**
 * The AUTOBLOCKS_CONFIG_REVISIONS environment variable is a JSON-stringified
 * map of config IDs to revision IDs. This is set in CI test runs triggered
 * from the UI.
 */
const configRevisionsMap = (): Record<string, string> => {
  if (!isTestingContext()) {
    return {};
  }

  const configRevisionsRaw = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_CONFIG_REVISIONS,
  );
  if (!configRevisionsRaw) {
    return {};
  }

  return JSON.parse(configRevisionsRaw);
};

export class AutoblocksConfig<T> {
  private _value: T;
  private refreshIntervalTimer: NodeJS.Timer | undefined;

  constructor(value: T) {
    this._value = value;
  }

  private isRemoteConfigRefreshable(args: { remoteConfig: RemoteConfig }) {
    return (
      'latest' in args.remoteConfig ||
      ('dangerouslyUseUndeployed' in args.remoteConfig &&
        'latest' in args.remoteConfig.dangerouslyUseUndeployed)
    );
  }

  private makeRequestUrl(args: { remoteConfig: RemoteConfig }): string {
    const configId = encodeURIComponent(args.remoteConfig.id);
    const base = `${API_ENDPOINT}/configs/${configId}`;
    // Overide the version using the revisionId in the map if it exists
    const revisionId = configRevisionsMap()[args.remoteConfig.id];
    if (revisionId) {
      return `${base}/revisions/${revisionId}`;
    }
    if ('latest' in args.remoteConfig) {
      return `${base}/versions/${RevisionSpecialVersionsEnum.LATEST}`;
    } else if ('version' in args.remoteConfig) {
      return `${base}/versions/${args.remoteConfig.version}`;
    }

    // Otherwise we are in the case of dangerouslyUseUndeployed
    return 'latest' in args.remoteConfig.dangerouslyUseUndeployed
      ? `${base}/revisions/${RevisionSpecialVersionsEnum.LATEST}`
      : `${base}/revisions/${args.remoteConfig.dangerouslyUseUndeployed.revisionId}`;
  }

  private async getConfig(args: {
    remoteConfig: RemoteConfig;
    timeoutMs: number;
    apiKey: string;
  }): Promise<Config> {
    const url = this.makeRequestUrl({ remoteConfig: args.remoteConfig });

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${args.apiKey}`,
      },
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const data = await resp.json();
    return zConfigSchema.parse(data);
  }

  private async loadAndSetRemoteConfig(args: {
    remoteConfig: RemoteConfig;
    apiKey: string;
    timeout?: TimeDelta;
    parser?: (config: unknown) => T | undefined;
  }) {
    const remoteConfig = await this.getConfig({
      remoteConfig: args.remoteConfig,
      timeoutMs: convertTimeDeltaToMilliSeconds(
        args.timeout || { seconds: 10 },
      ),
      apiKey: args.apiKey,
    });

    if (args.parser) {
      try {
        const parsed = args.parser(remoteConfig.value);
        if (parsed !== undefined) {
          this._value = parsed;
        }
      } catch (err) {
        throw new Error(
          `Failed to parse config '${args.remoteConfig.id}': ${err}`,
        );
      }
    } else {
      this._value = remoteConfig.value as T;
    }
  }

  private async activateRemoteConfigUnsafe(args: {
    remoteConfig: RemoteConfig;
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    activateTimeout?: TimeDelta;
    parser?: (config: unknown) => T | undefined;
  }) {
    const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }

    await this.loadAndSetRemoteConfig({
      remoteConfig: args.remoteConfig,
      apiKey,
      timeout: args.activateTimeout,
      parser: args.parser,
    });

    if (
      this.isRemoteConfigRefreshable({ remoteConfig: args.remoteConfig }) &&
      !isTestingContext()
    ) {
      // Clear any existing interval timer in case they call this method multiple times.
      if (this.refreshIntervalTimer) {
        clearInterval(this.refreshIntervalTimer);
      }
      this.refreshIntervalTimer = setInterval(
        async () => {
          try {
            await this.loadAndSetRemoteConfig({
              remoteConfig: args.remoteConfig,
              apiKey,
              timeout: args.refreshTimeout,
              parser: args.parser,
            });
          } catch (err) {
            console.error(
              `Failed to refresh config '${args.remoteConfig.id}': ${err}`,
            );
          }
        },
        convertTimeDeltaToMilliSeconds(args.refreshInterval || { minutes: 5 }),
      );
    }
  }

  public async activateRemoteConfig(args: {
    remoteConfig: RemoteConfig;
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    activateTimeout?: TimeDelta;
    parser?: (config: unknown) => T | undefined;
  }) {
    try {
      await this.activateRemoteConfigUnsafe(args);
    } catch (err) {
      console.error(
        `Failed to activate remote config '${args.remoteConfig.id}': ${err}`,
      );
    }
  }

  public close(): void {
    if (this.refreshIntervalTimer) {
      clearInterval(this.refreshIntervalTimer);
    }
  }

  public get value(): T {
    return this._value;
  }
}
