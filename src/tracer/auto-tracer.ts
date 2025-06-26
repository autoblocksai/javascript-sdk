import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ExecutionIdSpanProcessor } from './span-processor';
import type { Instrumentation } from '@opentelemetry/instrumentation';

export const initAutoTracer = (args: {
  apiKey?: string;
  isBatchDisabled?: boolean;
  instrumentations: Instrumentation[];
}) => {
  const apiKey = args?.apiKey;
  if (!apiKey) {
    throw new Error('API key is required');
  }
  // Initialize OTLP trace exporter with the endpoint URL and headers
  const otlpExporter = new OTLPTraceExporter({
    url: 'https://api-v2.autoblocks.ai/otel/v1/traces', // Make sure the endpoint path is correct
    headers: {
      Authorization: `Bearer ${args?.apiKey}`,
    },
  });

  // Initialize console exporter for local debugging
  const consoleExporter = new ConsoleSpanExporter();

  // Creating a resource to identify your service in traces
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'autoblocks-auto-tracer',
  });

  const spanProcessors: SpanProcessor[] = [new ExecutionIdSpanProcessor()];
  if (!args?.isBatchDisabled) {
    spanProcessors.push(new BatchSpanProcessor(otlpExporter));
  } else {
    spanProcessors.push(new SimpleSpanProcessor(otlpExporter));
  }

  // Add console exporter with SimpleSpanProcessor for immediate output
  spanProcessors.push(new SimpleSpanProcessor(consoleExporter));

  const sdk = new NodeSDK({
    instrumentations: args.instrumentations,
    spanProcessors,
    resource,
  });

  sdk.start();
  console.log('AutoTracer initialized');
};
