import {
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
} from '../../common/util';
import type { SendEventArgs } from '../../common/models';
import { BaseAutoblocksTracer } from '../../common/baseTracer';
import { testCaseAsyncLocalStorage } from '../asyncLocalStorage';

export class AutoblocksTracer extends BaseAutoblocksTracer {
  private async sendTestEventUnsafe(
    message: string,
    args?: SendEventArgs,
  ): Promise<undefined> {
    if (!this.cliServerAddress) {
      throw new Error('No CLI server address found.');
    }
    const store = testCaseAsyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Test context not found.');
    }
    const traceId = args?.traceId || this.traceId;
    const timestamp = args?.timestamp || new Date().toISOString();

    const properties = this.mergeProperties(args);

    const resp = await fetch(`${this.cliServerAddress}/events`, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
      },
      body: JSON.stringify({
        testExternalId: store.testId,
        testCaseHash: store.testCaseHash,
        event: {
          message,
          traceId,
          timestamp,
          properties,
        },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    await resp.json();
  }

  public async sendEvent(
    message: string,
    args?: SendEventArgs,
  ): Promise<undefined> {
    try {
      if (this.cliServerAddress) {
        await this.sendTestEventUnsafe(message, args);
      } else {
        await this.sendEventUnsafe(message, args);
      }
    } catch (err) {
      if (readEnv(AutoblocksEnvVar.AUTOBLOCKS_TRACER_THROW_ON_ERROR) === '1') {
        throw err;
      }
      console.error(`Error sending event to Autoblocks: ${err}`);
    }
  }
}
