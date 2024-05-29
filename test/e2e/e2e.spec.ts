import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import {
  AutoblocksAPIClient,
  AutoblocksTracer,
  SystemEventFilterKey,
} from '../../src';
import { E2E_TESTS_MESSAGE_NAME } from './util';

jest.setTimeout(60_000);

// The below are entities in our Autoblocks CI org that we use for testing.
const E2E_TESTS_VIEW_ID = 'cllmlk8py0003l608vd83dc03';
const E2E_TEST_SUITE_ID = 'my-test-suite';
const E2E_TEST_CASE_ID = 'cluh2cwla0001d590dha70npc';

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
}

async function waitForTraceToExist(traceId: string): Promise<void> {
  const apiClient = new AutoblocksAPIClient();

  let numTries = 10;
  while (numTries) {
    const { traces } = await apiClient.getTracesFromView({
      viewId: E2E_TESTS_VIEW_ID,
      pageSize: 10,
    });
    if (traces.some((trace) => trace.id === traceId)) {
      console.log(`Found trace ${traceId}!`);
      return;
    }

    console.log(`Didn't find trace ${traceId}, ${numTries} tries left...`);
    await sleep(5);
    numTries--;
  }

  throw new Error(`Trace ${traceId} was not found.`);
}

describe('E2E', () => {
  describe('AutoblocksTracer', () => {
    it('handles slow evaluators in plain scripts', async () => {
      const traceId = crypto.randomUUID();
      console.log('Running command at ', new Date().toISOString());
      execSync(`tsx test/e2e/plain-script.ts ${traceId}`, { stdio: 'inherit' });
      console.log('Done running command at ', new Date().toISOString());

      await waitForTraceToExist(traceId);
    });

    it('handles slow evaluators when sending TERM to an express app', async () => {
      // Start the express app
      const server = spawn('tsx', ['test/e2e/express-app.ts'], {
        detached: true,
        stdio: 'inherit',
      });

      // Give it a sec to start up
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      // Send POST request to the server
      const traceId = crypto.randomUUID();

      const resp = await fetch('http://localhost:8000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ traceId }),
      });
      if (!resp.ok) {
        throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
      }

      // Send TERM
      if (server.pid) {
        process.kill(server.pid, 'SIGTERM');
      }

      await waitForTraceToExist(traceId);
    });
  });

  describe('AutoblocksAPIClient', () => {
    const tracer = new AutoblocksTracer();
    const client = new AutoblocksAPIClient();

    it('getViews', async () => {
      const views = await client.getViews();
      expect(views.map((v) => v.id)).toContain(E2E_TESTS_VIEW_ID);
    });

    it('getTestCases', async () => {
      const { testCases } = await client.getTestCases({
        testSuiteId: E2E_TEST_SUITE_ID,
      });
      expect(testCases.map((tc) => tc.id)).toContain(E2E_TEST_CASE_ID);
    });

    it('searchTraces', async () => {
      const testTraceId = crypto.randomUUID();
      tracer.sendEvent(E2E_TESTS_MESSAGE_NAME, { traceId: testTraceId });

      // Find the test event we just sent
      let retries = 10;

      while (retries > 0) {
        const { traces } = await client.searchTraces({
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
                  value: E2E_TESTS_MESSAGE_NAME,
                },
              ],
            },
          ],
        });

        if (traces.some((t) => t.id === testTraceId)) {
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
    });
  });
});
