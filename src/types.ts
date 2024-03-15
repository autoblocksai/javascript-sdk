import { z } from 'zod';

// Use any here so that interfaces can be assigned to this type.
// https://stackoverflow.com/q/65799316
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArbitraryProperties = Record<string | number, any>;

export interface PromptTracking {
  id: string;
  version: string;
  templates: {
    id: string;
    version: string;
    template: string;
  }[];
  params?: {
    version: string;
    params: Record<string, unknown>;
  };
}

export interface TimeDelta {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export const zPromptSchema = z.object({
  id: z.string(),
  version: z.string(),
  templates: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      template: z.string(),
    }),
  ),
  params: z
    .object({
      version: z.string(),
      params: z.record(z.string(), z.unknown()),
    })
    .nullish(),
});

export type Prompt = z.infer<typeof zPromptSchema>;
