import { TimeDelta } from '../types';
import {
  API_ENDPOINT,
  AutoblocksEnvVar,
  readEnv,
  AUTOBLOCKS_HEADERS,
  convertTimeDeltaToMilliSeconds,
  RevisionSpecialVersionsEnum,
} from '../util';
import { ConfigResponse, RemoteConfig, zConfigResponseSchema } from './types';

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

  private isRemoteConfigRefreshable(args: { config: RemoteConfig }) {
    return (
      'latest' in args.config ||
      ('dangerouslyUseUndeployed' in args.config &&
        'latest' in args.config.dangerouslyUseUndeployed)
    );
  }

  private makeRequestUrl(args: { config: RemoteConfig }): string {
    const configId = encodeURIComponent(args.config.id);
    const base = `${API_ENDPOINT}/configs/${configId}`;
    // Overide the version using the revisionId in the map if it exists
    const revisionId = configRevisionsMap()[args.config.id];
    // we only use the override in testing context
    if (revisionId && isTestingContext()) {
      return `${base}/revisions/${revisionId}`;
    }
    if ('latest' in args.config) {
      return `${base}/versions/${RevisionSpecialVersionsEnum.LATEST}`;
    } else if ('version' in args.config) {
      return `${base}/versions/${args.config.version}`;
    }

    // Otherwise we are in the case of dangerouslyUseUndeployed
    return 'latest' in args.config.dangerouslyUseUndeployed
      ? `${base}/revisions/${RevisionSpecialVersionsEnum.LATEST}`
      : `${base}/revisions/${args.config.dangerouslyUseUndeployed.revisionId}`;
  }

  private async getRemoteConfig(args: {
    config: RemoteConfig;
    timeoutMs: number;
    apiKey: string;
  }): Promise<ConfigResponse> {
    const url = this.makeRequestUrl({ config: args.config });

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${args.apiKey}`,
      },
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const data = await resp.json();
    return zConfigResponseSchema.parse(data);
  }

  private async loadAndSetRemoteConfig(args: {
    config: RemoteConfig;
    apiKey: string;
    timeout?: TimeDelta;
    parser: (config: unknown) => T | undefined;
  }) {
    const remoteConfig = await this.getRemoteConfig({
      config: args.config,
      timeoutMs: convertTimeDeltaToMilliSeconds(
        args.timeout || { seconds: 10 },
      ),
      apiKey: args.apiKey,
    });

    try {
      const parsed = args.parser(remoteConfig.value);
      if (parsed !== undefined) {
        this._value = parsed;
      }
    } catch (err) {
      throw new Error(`Failed to parse config '${args.config.id}': ${err}`);
    }
  }

  private async activateFromRemoteUnsafe(args: {
    config: RemoteConfig;
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    activateTimeout?: TimeDelta;
    parser: (config: unknown) => T | undefined;
  }) {
    const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }

    await this.loadAndSetRemoteConfig({
      config: args.config,
      apiKey,
      timeout: args.activateTimeout,
      parser: args.parser,
    });

    if (
      this.isRemoteConfigRefreshable({ config: args.config }) &&
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
              config: args.config,
              apiKey,
              timeout: args.refreshTimeout,
              parser: args.parser,
            });
          } catch (err) {
            console.error(
              `Failed to refresh config '${args.config.id}': ${err}`,
            );
          }
        },
        convertTimeDeltaToMilliSeconds(args.refreshInterval || { seconds: 10 }),
      );
    }
  }

  public async activateFromRemote(args: {
    config: RemoteConfig;
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    activateTimeout?: TimeDelta;
    parser: (config: unknown) => T | undefined;
  }) {
    try {
      await this.activateFromRemoteUnsafe(args);
    } catch (err) {
      console.error(
        `Failed to activate remote config '${args.config.id}': ${err}`,
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
