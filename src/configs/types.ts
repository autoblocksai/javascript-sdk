import { z } from 'zod';

export const zConfigSchema = z.object({
  id: z.string(),
  version: z.string(),
  value: z.record(z.string(), z.unknown()),
});

export type Config = z.infer<typeof zConfigSchema>;

export enum ConfigSpecialVersion {
  LATEST = 'latest',
  DANGEROUSLY_USE_UNDEPLOYED = 'dangerously-use-undeployed',
}

export type ConfigVersion = ConfigSpecialVersion | string;

export const zConfigParameterSchema = z.union([
  z.object({
    id: z.string(),
    latest: z.literal(true),
  }),
  z.object({
    id: z.string(),
    dangerouslyUseUndeployed: z.literal(true),
  }),
  z.object({
    id: z.string(),
    version: z.string(),
  }),
  z.object({
    id: z.string(),
    revisionId: z.string(),
  }),
]);

export type ConfigParameter = z.infer<typeof zConfigParameterSchema>;
