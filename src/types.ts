// Use any here so that interfaces can be assigned to this type.
// https://stackoverflow.com/q/65799316
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArbitraryProperties = Record<string | number, any>;

export interface PromptTracking {
  id: string | number;
  templates: {
    id: string | number;
    template: string;
    properties?: ArbitraryProperties;
  }[];
}

export interface SendEventArgs {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp?: string;
  properties?: ArbitraryProperties;
  promptTracking?: PromptTracking;
}
