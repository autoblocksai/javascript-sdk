import crypto from 'crypto';
import { traceOpenAI, AutoblocksAPIClient } from '@autoblocks/client';
import { OpenAI } from 'openai';

const sleep = (seconds) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const main = async () => {
  // Trace all OpenAI calls
  const tracer = await traceOpenAI();

  const openai = new OpenAI();

  const traceId = crypto.randomUUID();
  tracer.setTraceId(traceId);

  // This will send two events: ai.completion.request and ai.completion.response
  await openai.chat.completions.create({
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
    model: 'gpt-3.5-turbo',
  });

  // Send a custom event with the same traceId as the automated openai events
  await tracer.sendEvent('my.custom.event', {
    // Set the traceId as a property since we can't yet search by traceId 🤡
    properties: { propertyToSearchFor: traceId },
  });

  // Use the REST API to find the trace we just sent
  const client = new AutoblocksAPIClient(process.env.AUTOBLOCKS_API_KEY);

  let retries = 10;

  while (retries > 0) {
    const { traces } = await client.searchTraces({
      pageSize: 1,
      timeFilter: {
        type: 'relative',
        hours: 1,
      },
      traceFilters: [
        {
          operator: 'CONTAINS',
          eventFilters: [
            {
              key: 'propertyToSearchFor',
              operator: 'EQUALS',
              value: traceId,
            },
          ],
        },
      ],
    });

    const trace = traces[0];

    if (trace && trace.id === traceId) {
      const messages = trace.events.map((e) => e.message);
      if (
        messages.length === 3 &&
        messages[0] === 'ai.completion.request' &&
        messages[1] === 'ai.completion.response' &&
        messages[2] === 'my.custom.event'
      ) {
        console.log(`Found trace ${traceId}!`);
        break;
      }
      throw new Error(
        `Found trace ${traceId} but it didn't have the expected messages: ${JSON.stringify(
          messages,
        )}`,
      );
    }

    retries--;

    if (retries === 0) {
      throw new Error(`Couldn't find trace ${traceId}.`);
    }

    const sleepSeconds = 5;
    console.log(
      `Couldn't find trace ${traceId} yet, waiting ${sleepSeconds} seconds. ${retries} tries left.`,
    );
    await sleep(sleepSeconds);
  }
};

main();
