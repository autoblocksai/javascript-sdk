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
  ConfigSpecialVersion,
  ConfigVersion,
  zConfigSchema,
} from './types';

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
  }): Promise<Config | undefined> {
    const url = this.makeRequestUrl({ id: args.id, version: args.version });

    try {
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
    } catch (err) {
      console.error(
        `Failed to fetch config '${args.id}' version v${args.version}: ${err}`,
      );
    }

    return undefined;
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

    if (!remoteConfig) {
      return;
    }

    if (args.parser) {
      try {
        const parsed = args.parser(remoteConfig.value);
        if (parsed !== undefined) {
          this._value = parsed;
        }
      } catch (err) {
        console.error(
          `Failed to parse config '${args.id}' version v'${args.version}': ${err}`,
        );
      }
    } else {
      this._value = remoteConfig.value as T;
    }
  }

  public async activateRemoteConfig(args: {
    id: string;
    version: ConfigVersion;
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    activateTimeout?: TimeDelta;
    parser?: (config: unknown) => T | undefined;
  }) {
    const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      console.error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable to activate remote config id '${args.id}'.`,
      );
      return;
    }

    await this.loadAndSetRemoteConfig({
      id: args.id,
      version: args.version,
      apiKey,
      timeout: args.activateTimeout,
      parser: args.parser,
    });

    if (args.version === ConfigSpecialVersion.LATEST) {
      // Clear any existing interval timer in case they call this method multiple times.
      if (this.refreshIntervalTimer) {
        clearInterval(this.refreshIntervalTimer);
      }
      this.refreshIntervalTimer = setInterval(
        async () => {
          await this.loadAndSetRemoteConfig({
            id: args.id,
            version: args.version,
            apiKey,
            timeout: args.refreshTimeout,
            parser: args.parser,
          });
        },
        convertTimeDeltaToMilliSeconds(args.refreshInterval || { minutes: 5 }),
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
