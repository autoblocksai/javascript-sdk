import { readEnv, AutoblocksEnvVar } from '../../common/util';
import type { SendEventArgs } from '../../common/models';
import { BaseAutoblocksTracer } from '../../common/baseTracer';

export class AutoblocksTracer extends BaseAutoblocksTracer {
  public async sendEvent(
    message: string,
    args?: SendEventArgs,
  ): Promise<undefined> {
    try {
      if (this.cliServerAddress) {
        throw new Error('Cannot send test events in browser tracer.');
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
