import crypto from 'crypto';
import { AutoblocksTracer } from '../tracer';
import { readEnv, AUTOBLOCKS_INGESTION_KEY } from '../util';

let tracer: AutoblocksTracer | undefined = undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeWrapper(func: any): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function wrapper(this: any, ...args: any[]): Promise<any> {
    const original = func.bind(this);

    if (!tracer) {
      return original(...args);
    }

    let error = undefined;
    let response = undefined;

    let traceId = undefined;
    if (!tracer.traceId) {
      // Note we don't use setTraceId but instead pass the traceId with each sendEvent call
      // so that we can tell when a user has set a traceId via setTraceId. If we were to call
      // setTraceId here, we would not be able to tell it was set by us vs. set by a user elsewhere.
      traceId = crypto.randomUUID();
    }

    // Similar to the comment above, we don't set this via tracer.updateProperties
    // because the tracer is returned from this function and meant to be used by the
    // end user for additional events, and those events should not belong to this span.
    const spanId = crypto.randomUUID();

    await tracer.sendEvent('ai.completion.request', {
      traceId,
      spanId,
      properties: args[0],
    });

    const start = Date.now();

    try {
      response = await original(...args);
      return response;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const latencyMs = Date.now() - start;

      if (error) {
        await tracer.sendEvent('ai.completion.error', {
          traceId,
          spanId,
          properties: {
            latencyMs,
            error: error.toString(),
          },
        });
      } else {
        await tracer.sendEvent('ai.completion.response', {
          traceId,
          spanId,
          properties: {
            latencyMs,
            response,
          },
        });
      }
    }
  };
}

async function patch() {
  const openAiModule = await import('openai');
  openAiModule.OpenAI.Completions.prototype.create = makeWrapper(
    openAiModule.OpenAI.Completions.prototype.create,
  );
  openAiModule.OpenAI.Chat.Completions.prototype.create = makeWrapper(
    openAiModule.OpenAI.Chat.Completions.prototype.create,
  );
}

export async function traceOpenAI(): Promise<AutoblocksTracer> {
  if (tracer) {
    return tracer;
  }

  const ingestionKey = readEnv(AUTOBLOCKS_INGESTION_KEY);
  if (!ingestionKey) {
    throw new Error(
      `You must set the ${AUTOBLOCKS_INGESTION_KEY} environment variable in order to use traceOpenAI.`,
    );
  }
  tracer = new AutoblocksTracer({
    ingestionKey,
    properties: {
      provider: 'openai',
    },
  });

  try {
    await patch();
  } catch (err) {
    console.warn(`Couldn't patch openai module: ${err}`);
  }

  return tracer;
}
