import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ExecutionIdSpanProcessor } from './span-processor';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { AutoblocksEnvVar, readEnv, V2_API_ENDPOINT } from '../util';

export const initAutoTracer = (args: {
  apiKey?: string;
  isBatchDisabled?: boolean;
  instrumentations: Instrumentation[];
}) => {
  const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY);
  if (!apiKey) {
    throw new Error(
      `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_V2_API_KEY}' environment variable.`,
    );
  }
  // Initialize OTLP trace exporter with the endpoint URL and headers
  const otlpExporter = new OTLPTraceExporter({
    url: `${V2_API_ENDPOINT}/otel/v1/traces`, // Make sure the endpoint path is correct
    headers: {
      Authorization: `Bearer ${args?.apiKey}`,
    },
  });

  // Creating a resource to identify your service in traces
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'autoblocks-auto-tracer',
  });

  const spanProcessors: SpanProcessor[] = [new ExecutionIdSpanProcessor()];
  if (!args?.isBatchDisabled) {
    spanProcessors.push(new BatchSpanProcessor(otlpExporter));
  } else {
    spanProcessors.push(new SimpleSpanProcessor(otlpExporter));
  }

  const sdk = new NodeSDK({
    instrumentations: args.instrumentations,
    spanProcessors,
    resource,
  });

  sdk.start();
  console.log('AutoTracer initialized');
};
