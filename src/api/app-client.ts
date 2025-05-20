import { DatasetsV2Client } from '../datasets-v2/client';
import { TimeDelta } from '../types';
import {
  AutoblocksEnvVar,
  convertTimeDeltaToMilliSeconds,
  readEnv,
} from '../util';

/**
 * Client for interacting with Autoblocks App API
 *
 * @example
 * const client = new AutoblocksAppClient({
 *   appSlug: 'my-app',
 *   apiKey: 'my-api-key'
 * });
 *
 * // Access datasets API
 * const datasets = await client.datasets.list();
 */
export class AutoblocksAppClient {
  private readonly apiKey: string;
  private readonly appSlug: string;
  private readonly timeoutMs: number;
  private readonly _datasets: DatasetsV2Client;

  constructor(args: { appSlug: string; apiKey?: string; timeout?: TimeDelta }) {
    const key = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);
    if (!key) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = key;
    this.appSlug = args.appSlug;
    this.timeoutMs = convertTimeDeltaToMilliSeconds(
      args.timeout || { seconds: 60 },
    );

    // Initialize datasets client immediately in constructor
    this._datasets = new DatasetsV2Client({
      apiKey: this.apiKey,
      appSlug: this.appSlug,
      timeout: { milliseconds: this.timeoutMs },
    });
  }

  /**
   * Access the datasets V2 API client
   */
  get datasets(): DatasetsV2Client {
    return this._datasets;
  }
}
