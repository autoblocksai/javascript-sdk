import { AutoblocksTracer } from '../../src';
import { BaseEventEvaluator } from '../../src/testing';

class SlowEvaluator1 extends BaseEventEvaluator {
  id = 'e2e-slow-evaluator-1';

  async evaluateEvent() {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return { score: 1 };
  }
}

class SlowEvaluator2 extends BaseEventEvaluator {
  id = 'e2e-slow-evaluator-2';

  async evaluateEvent() {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return { score: 1 };
  }
}

(async () => {
  const traceId = process.argv[2];
  const tracer = new AutoblocksTracer();
  console.log('Sending event at ', new Date().toISOString());
  tracer.sendEvent('e2e-test-event-plain-script', {
    traceId,
    evaluators: [new SlowEvaluator1(), new SlowEvaluator2()],
  });
  console.log('Done sending event at ', new Date().toISOString());
})();
