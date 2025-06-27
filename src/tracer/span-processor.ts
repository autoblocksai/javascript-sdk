import { Span } from '@opentelemetry/sdk-trace-base';
import { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { propagation, Context } from '@opentelemetry/api';
import { SpanAttributesEnum } from './util';
import { testCaseRunAsyncLocalStorage } from '../asyncLocalStorage';

export class ExecutionIdSpanProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    // Retrieve execution ID from the active baggage
    const baggage = propagation.getBaggage(parentContext);
    const executionId = baggage?.getEntry(
      SpanAttributesEnum.EXECUTION_ID,
    )?.value;
    const environment = baggage?.getEntry(
      SpanAttributesEnum.ENVIRONMENT,
    )?.value;
    const appSlug = baggage?.getEntry(SpanAttributesEnum.APP_SLUG)?.value;

    if (executionId) {
      span.setAttribute(SpanAttributesEnum.EXECUTION_ID, executionId);
    }
    if (environment) {
      span.setAttribute(SpanAttributesEnum.ENVIRONMENT, environment);
    }
    if (appSlug) {
      span.setAttribute(SpanAttributesEnum.APP_SLUG, appSlug);
    }

    const testRunContext = testCaseRunAsyncLocalStorage.getStore();
    if (testRunContext) {
      span.setAttribute(SpanAttributesEnum.TEST_ID, testRunContext.testId);
      span.setAttribute(SpanAttributesEnum.RUN_ID, testRunContext.runId);
      if (testRunContext.buildId) {
        span.setAttribute(SpanAttributesEnum.BUILD_ID, testRunContext.buildId);
      }
      if (testRunContext.runMessage) {
        span.setAttribute(
          SpanAttributesEnum.RUN_MESSAGE,
          testRunContext.runMessage,
        );
      }
    }
  }

  // Required methods (no-op for our case)
  onEnd(): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
