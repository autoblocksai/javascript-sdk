import http from 'http';
import express from 'express';
import { AutoblocksTracer, flush } from '../../src';
import { BaseEventEvaluator, TracerEvent } from '../../src/testing';
import { createTerminus } from '@godaddy/terminus';
import { E2E_TESTS_MESSAGE_NAME } from './util';

class SlowEvaluator1 extends BaseEventEvaluator {
  id = 'e2e-slow-evaluator-1';

  async evaluateEvent(args: { event: TracerEvent }) {
    console.log(`[${this.id}] Evaluating event ${args.event.traceId}`);

    let sleepSeconds = 10;
    while (sleepSeconds) {
      console.log(`[${this.id}] ${sleepSeconds} seconds left`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      sleepSeconds--;
    }

    console.log(`[${this.id}] Done evaluating event ${args.event.traceId}`);
    return { score: 1 };
  }
}

class SlowEvaluator2 extends BaseEventEvaluator {
  id = 'e2e-slow-evaluator-2';

  async evaluateEvent(args: { event: TracerEvent }) {
    console.log(`[${this.id}] Evaluating event ${args.event.traceId}`);

    let sleepSeconds = 10;
    while (sleepSeconds) {
      console.log(`[${this.id}] ${sleepSeconds} seconds left`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      sleepSeconds--;
    }

    console.log(`[${this.id}] Done evaluating event ${args.event.traceId}`);
    return { score: 1 };
  }
}

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Handle POST request
app.post('/', (req, res) => {
  console.log('Received request', req.body);
  const traceId = req.body.traceId;
  const tracer = new AutoblocksTracer();
  console.log('Sending event at ', new Date().toISOString());
  tracer.sendEvent(E2E_TESTS_MESSAGE_NAME, {
    traceId,
    evaluators: [new SlowEvaluator1(), new SlowEvaluator2()],
  });
  console.log('Done sending event at ', new Date().toISOString());
  res.status(200).send('OK');
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
// https://github.com/godaddy/terminus?tab=readme-ov-file#usage
function onSignal() {
  console.log('Received signal, flushing logs');
  return Promise.all([flush()]);
}

// Start the server
const server = http.createServer(app);

createTerminus(server, {
  signal: 'SIGTERM',
  onSignal,
});

server.listen(8000, () => {
  console.log('Express server listening on port 8000');
});
