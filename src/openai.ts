import crypto from 'crypto';
import { AutoblocksTracer } from './tracer';
import { readEnv, AUTOBLOCKS_INGESTION_KEY } from './util';

const tracer = new AutoblocksTracer(readEnv(AUTOBLOCKS_INGESTION_KEY) || '', {
  properties: { provider: 'openai' },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeWrapper(func: any): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function wrapper(this: any, ...args: any[]): Promise<any> {
    const original = func.bind(this);

    let error = undefined;
    let response = undefined;

    let traceId = undefined;
    if (!tracer.traceId) {
      // Note we don't use setTraceId but instead pass the traceId with each sendEvent call
      // so that we can tell when a user has set a traceId via setTraceId. If we were to call
      // setTraceId here, we would not be able to tell it was set by us vs. set by a user elsewhere.
      traceId = crypto.randomUUID();
    }

    await tracer.sendEvent('ai.completion.request', {
      traceId,
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
          properties: {
            latencyMs,
            error: error.toString(),
          },
        });
      } else {
        await tracer.sendEvent('ai.completion.response', {
          traceId,
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
  if (traceOpenAI.called) {
    return tracer;
  }

  if (!readEnv(AUTOBLOCKS_INGESTION_KEY)) {
    throw new Error(
      `You must set the ${AUTOBLOCKS_INGESTION_KEY} environment variable in order to use traceOpenAI.`,
    );
  }

  try {
    await patch();
  } catch (err) {
    console.warn(`Couldn't patch openai module: ${err}`);
  }

  traceOpenAI.called = true;

  return tracer;
}

traceOpenAI.called = false;
