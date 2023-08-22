import crypto from 'crypto';
import { AutoblocksAPIClient, AutoblocksTracer } from '../src';
import { SystemEventFilterKey } from '../src/client';

const { AUTOBLOCKS_API_KEY, AUTOBLOCKS_INGESTION_KEY } = process.env;

// We've created a view in our CI org to be used in CI tests.
// It has one filter, message == 'sdk.e2e', and its timespan is "last 1 hour"
const E2E_TESTS_VIEW_ID = 'cllmlk8py0003l608vd83dc03';
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

  const tracer = new AutoblocksTracer(AUTOBLOCKS_INGESTION_KEY);
  const client = new AutoblocksAPIClient(AUTOBLOCKS_API_KEY);

  // Make sure our view exists
  const views = await client.getViews();
  if (!views.some((view) => view.id === E2E_TESTS_VIEW_ID)) {
    throw new Error(`View ${E2E_TESTS_VIEW_ID} not found!`);
  }

  // Send test event
  const testTraceId = crypto.randomUUID();
  await tracer.sendEvent(E2E_TESTS_EXPECTED_MESSAGE, { traceId: testTraceId });

  // Find the test event we just sent
  let retries = 10;

  while (retries > 0) {
    // We should be able to fetch the trace both from the view and from searching
    const { traces: tracesFromView } = await client.getTracesFromView({
      viewId: E2E_TESTS_VIEW_ID,
      pageSize: 10,
    });
    const { traces: tracesFromSearch } = await client.searchTraces({
      pageSize: 10,
      timeFilter: {
        type: 'relative',
        hours: 1,
      },
      traceFilters: [
        {
          operator: 'CONTAINS',
          eventFilters: [
            {
              key: SystemEventFilterKey.MESSAGE,
              value: E2E_TESTS_EXPECTED_MESSAGE,
              operator: 'EQUALS',
            },
          ],
        },
      ],
    });

    console.log('Found traces from view:');
    console.log(tracesFromView.map((t) => t.id));

    console.log('Found traces from search:');
    console.log(tracesFromSearch.map((t) => t.id));

    if (
      tracesFromView.some((t) => t.id === testTraceId) &&
      tracesFromSearch.some((t) => t.id === testTraceId)
    ) {
      console.log(`Found trace ${testTraceId}!`);
      break;
    }

    retries--;

    if (retries === 0) {
      throw new Error(`Couldn't find trace ${testTraceId}.`);
    }

    const sleepSeconds = 5;
    console.log(
      `Couldn't find trace ${testTraceId} yet, waiting ${sleepSeconds} seconds. ${retries} tries left.`,
    );
    await sleep(sleepSeconds);
  }
};

main();
