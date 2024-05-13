import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import { AutoblocksAPIClient } from '../../src';

jest.setTimeout(60_000);

async function waitForTraceToExist(traceId: string): Promise<void> {
  const apiClient = new AutoblocksAPIClient();

  let numTries = 30;
  while (numTries) {
    try {
      await apiClient.getTrace({ traceId });
      console.log(`Found trace ${traceId}!`);
      return;
    } catch (err) {
      console.log(`Didn't find trace ${traceId}, ${numTries} tries left...`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      numTries--;
    }
  }

  throw new Error(`Trace ${traceId} was not sent`);
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
});
