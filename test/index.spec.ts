import { AutoblocksTracer } from '../src/index';

describe('index', () => {
  it('AutoblocksTracer', () => {
    const tracer = new AutoblocksTracer('mock-ingestion-token');
    expect(tracer).toBeDefined();
  });
});
