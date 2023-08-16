import crypto from 'crypto';
import { AutoblocksAPIClient, AutoblocksTracer } from '../src';

const { AUTOBLOCKS_API_KEY, AUTOBLOCKS_INGESTION_KEY } = process.env;

// We've created a view in our demo org to be used in CI tests.
// It has one filter, message == 'sdk.e2e', and its timespan is "last 1 hour"
const E2E_TESTS_VIEW_ID = 'clldzryfx0001i908okbbe5pf';
const E2E_TESTS_EXPECTED_MESSAGE = 'sdk.e2e';

const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const main = async () => {
  if (!AUTOBLOCKS_API_KEY) {
    throw new Error('AUTOBLOCKS_API_KEY env var is required.');
  }
  if (!AUTOBLOCKS_INGESTION_KEY) {
    throw new Error('AUTOBLOCKS_INGESTION_KEY env var is required.');
  }

  const traceId = crypto.randomUUID();
  const tracer = new AutoblocksTracer(AUTOBLOCKS_INGESTION_KEY, { traceId });
  const client = new AutoblocksAPIClient(AUTOBLOCKS_API_KEY);

  await tracer.sendEvent(E2E_TESTS_EXPECTED_MESSAGE);

  // Make sure our view exists
  const views = await client.getViews();
  if (!views.some((view) => view.id === E2E_TESTS_VIEW_ID)) {
    throw new Error(`View ${E2E_TESTS_VIEW_ID} not found!`);
  }

  // Find the test event we just sent
  let retries = 10;

  while (retries > 0) {
    const { traces } = await client.getTracesFromView({
      viewId: E2E_TESTS_VIEW_ID,
      pageSize: 10,
    });

    console.log('Found traces:');
    console.log(traces.map((t) => t.id));

    if (traces.some((t) => t.id === traceId)) {
      console.log(`Found trace ${traceId}!`);
      break;
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
