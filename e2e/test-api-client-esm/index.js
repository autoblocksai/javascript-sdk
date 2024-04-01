import crypto from 'crypto';
import {
  AutoblocksAPIClient,
  AutoblocksTracer,
  SystemEventFilterKey,
} from '@autoblocks/client';

const { AUTOBLOCKS_API_KEY, AUTOBLOCKS_INGESTION_KEY } = process.env;

// The below are entities in our Autoblocks CI org that we use for testing.
const E2E_TESTS_VIEW_ID = 'cllmlk8py0003l608vd83dc03';
const E2E_TESTS_DATASET_ID = 'clpup7f9400075us75nin99f0';
const E2E_TESTS_TRACE_ID = '4943bb26-3526-4e9c-bcd1-62f08baa621a';
const E2E_TESTS_EXPECTED_MESSAGE = 'sdk.e2e';
const E2E_TEST_SUITE_ID = 'my-test-suite';
const E2E_TEST_CASE_ID = 'cluh2cwla0001d590dha70npc';

const assertEqual = (x, y) => {
  if (x !== y) {
    throw new Error(`Expected ${x} to equal ${y}`);
  }
};

const sleep = (seconds) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const main = async () => {
  if (!AUTOBLOCKS_API_KEY) {
    throw new Error('AUTOBLOCKS_API_KEY env var is required.');
  }
  if (!AUTOBLOCKS_INGESTION_KEY) {
    throw new Error('AUTOBLOCKS_INGESTION_KEY env var is required.');
  }

  const tracer = new AutoblocksTracer(AUTOBLOCKS_INGESTION_KEY);
  const client = new AutoblocksAPIClient(AUTOBLOCKS_API_KEY, {
    timeout: { seconds: 30 },
  });

  // Make sure dataset and items exists
  const datasets = await client.getDatasets();
  if (!datasets.some((dataset) => dataset.id === E2E_TESTS_DATASET_ID)) {
    throw new Error(`Dataset ${E2E_TESTS_DATASET_ID} not found!'`);
  }
  const dataset = await client.getDataset({
    datasetId: E2E_TESTS_DATASET_ID,
  });
  if (dataset.items.length === 0) {
    throw new Error(`Dataset ${E2E_TESTS_DATASET_ID} is empty!`);
  }

  // Test that we can fetch a trace by ID
  const trace = await client.getTrace({
    traceId: E2E_TESTS_TRACE_ID,
  });
  if (trace.events.length === 0) {
    throw new Error(`Trace ${E2E_TESTS_TRACE_ID} is empty!`);
  }

  assertEqual(trace.id, E2E_TESTS_TRACE_ID);
  assertEqual(trace.events[0].id, 'ee9dd0c7-daa4-4086-8d6c-b9706f435a68');
  assertEqual(trace.events[0].traceId, E2E_TESTS_TRACE_ID);
  assertEqual(trace.events[0].message, 'langchain.chain.start');
  assertEqual(trace.events[0].timestamp, '2023-12-11T12:27:26.831Z');
  assertEqual(
    trace.events[0].properties.inputs.input,
    "What is today's date? What is that date divided by 2?",
  );

  // Make sure our view exists
  const views = await client.getViews();
  if (!views.some((view) => view.id === E2E_TESTS_VIEW_ID)) {
    throw new Error(`View ${E2E_TESTS_VIEW_ID} not found!`);
  }

  // Fetch test cases
  const testCases = await client.getTestCases({
    testSuiteId: E2E_TEST_SUITE_ID,
  });
  console.log(`Found ${testCases.length} test cases`);
  assertEqual(testCases[0].id, E2E_TEST_CASE_ID);

  // Send test event
  const testTraceId = crypto.randomUUID();
  tracer.sendEvent(E2E_TESTS_EXPECTED_MESSAGE, { traceId: testTraceId });

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
              operator: 'EQUALS',
              value: E2E_TESTS_EXPECTED_MESSAGE,
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
