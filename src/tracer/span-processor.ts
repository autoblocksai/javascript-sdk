import { Span } from '@opentelemetry/sdk-trace-base';
import { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { propagation, Context } from '@opentelemetry/api';
import { SpanAttributesEnum } from './util';

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
