import { trace, context, propagation } from '@opentelemetry/api';

import { createId } from '@paralleldrive/cuid2';
import { SpanAttributesEnum, serialize } from './util';
import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';

export function traceApp<
  A extends unknown[],
  F extends (...args: A) => ReturnType<F>,
>(
  appSlug: string,
  environment: string,
  fn: F,
  thisArg?: ThisParameterType<F>,
  ...args: A
) {
  const testRunContext = testCaseRunAsyncLocalStorage.getStore();

  // In a test case context, the span attributes are handled in runTestSuite
  if (testRunContext) {
    return fn.apply(thisArg, args);
  }
  const executionId = createId();
  const activeContext = propagation.setBaggage(
    context.active(),
    propagation.createBaggage({
      [SpanAttributesEnum.EXECUTION_ID]: {
        value: executionId,
      },
      [SpanAttributesEnum.ENVIRONMENT]: {
        value: environment,
      },
      [SpanAttributesEnum.APP_SLUG]: {
        value: appSlug,
      },
    }),
  );
  const tracer = trace.getTracer('AUTOBLOCKS_TRACER');
  return context.with(activeContext, () =>
    tracer.startActiveSpan(appSlug, {}, activeContext, async (span) => {
      const res = fn.apply(thisArg, args);
      span.setAttributes({
        [SpanAttributesEnum.IS_ROOT]: true,
        [SpanAttributesEnum.EXECUTION_ID]: executionId,
        [SpanAttributesEnum.ENVIRONMENT]: environment,
        [SpanAttributesEnum.APP_SLUG]: appSlug,
        [SpanAttributesEnum.INPUT]: serialize(args),
      });
      if (res instanceof Promise) {
        return res.then((r) => {
          try {
            span.setAttributes({
              [SpanAttributesEnum.OUTPUT]: serialize(r),
            });
          } finally {
            span.end();
          }
          return r;
        });
      }
      try {
        span.setAttributes({
          [SpanAttributesEnum.OUTPUT]: serialize(res),
        });
      } finally {
        span.end();
      }
      return res;
    }),
  );
}
