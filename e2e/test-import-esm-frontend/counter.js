import { AutoblocksTracer } from '@autoblocks/client/browser/tracer';

const tracer = new AutoblocksTracer(process.env.AUTOBLOCKS_INGESTION_KEY);

export function setupCounter(element) {
  let counter = 0;
  const setCounter = (count) => {
    counter = count;
    tracer.sendEvent('counter.updated', { count });
    element.innerHTML = `count is ${counter}`;
  };
  element.addEventListener('click', () => setCounter(counter + 1));
  setCounter(0);
}
