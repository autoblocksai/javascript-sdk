import { TimeDelta } from '../types';
import {
  API_ENDPOINT,
  AutoblocksEnvVar,
  readEnv,
  AUTOBLOCKS_HEADERS,
  convertTimeDeltaToMilliSeconds,
} from '../util';
import {
  Config,
  ConfigParameter,
  ConfigSpecialVersion,
  ConfigVersion,
  zConfigSchema,
} from './types';

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

  private makeRequestUrl(args: { id: string; version: ConfigVersion }): string {
    const configId = encodeURIComponent(args.id);
    let version: string;
    if (args.version === ConfigSpecialVersion.DANGEROUSLY_USE_UNDEPLOYED) {
      version = 'undeployed';
    } else {
      version = encodeURIComponent(args.version);
    }

    return `${API_ENDPOINT}/configs/${configId}/${version}`;
  }

  private async getConfig(args: {
    id: string;
    version: ConfigVersion;
    timeoutMs: number;
    apiKey: string;
  }): Promise<Config> {
    const url = this.makeRequestUrl({ id: args.id, version: args.version });

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
    id: string;
    version: ConfigVersion;
    apiKey: string;
    timeout?: TimeDelta;
    parser?: (config: unknown) => T | undefined;
  }) {
    const remoteConfig = await this.getConfig({
      id: args.id,
      version: args.version,
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
          `Failed to parse config '${args.id}' version v'${args.version}': ${err}`,
        );
      }
    } else {
      this._value = remoteConfig.value as T;
    }
  }

  private makeVersionFromConfigParameter(config: ConfigParameter): string {
    // Overide the version using the revisionId in the map if it exists
    const revisionId = configRevisionsMap()[config.id];
    if (revisionId) {
      return revisionId;
    }
    if ('latest' in config) {
      return ConfigSpecialVersion.LATEST;
    } else if ('dangerouslyUseUndeployed' in config) {
      return ConfigSpecialVersion.DANGEROUSLY_USE_UNDEPLOYED;
    } else if ('version' in config) {
      return config.version;
    } else {
      return config.revisionId;
    }
  }

  private async activateRemoteConfigUnsafe(args: {
    config: ConfigParameter;
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
    const version = this.makeVersionFromConfigParameter(args.config);

    await this.loadAndSetRemoteConfig({
      id: args.config.id,
      version,
      apiKey,
      timeout: args.activateTimeout,
      parser: args.parser,
    });

    if (version === ConfigSpecialVersion.LATEST && !isTestingContext()) {
      // Clear any existing interval timer in case they call this method multiple times.
      if (this.refreshIntervalTimer) {
        clearInterval(this.refreshIntervalTimer);
      }
      this.refreshIntervalTimer = setInterval(
        async () => {
          try {
            await this.loadAndSetRemoteConfig({
              id: args.config.id,
              version,
              apiKey,
              timeout: args.refreshTimeout,
              parser: args.parser,
            });
          } catch (err) {
            console.error(
              `Failed to refresh config '${args.config.id}' version v${version}: ${err}`,
            );
          }
        },
        convertTimeDeltaToMilliSeconds(args.refreshInterval || { minutes: 5 }),
      );
    }
  }

  public async activateRemoteConfig(args: {
    config: ConfigParameter;
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
