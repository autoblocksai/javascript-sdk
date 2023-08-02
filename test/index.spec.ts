import { AutoblocksTracer } from '../src/index';

describe('index', () => {
  it('AutoblocksTracer', () => {
    const ab = new AutoblocksTracer('mock-ingestion-token');
    expect(ab).toBeDefined();
  });
});
