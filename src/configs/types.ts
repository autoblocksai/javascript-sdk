import { z } from 'zod';

export const zConfigSchema = z.object({
  id: z.string(),
  version: z.string(),
  value: z.record(z.string(), z.unknown()),
});

export type Config = z.infer<typeof zConfigSchema>;

export const zRemoteConfigSchema = z.union([
  z.object({
    id: z.string(),
    latest: z.literal(true),
  }),
  z.object({
    id: z.string(),
    version: z.string(),
  }),
  z.object({
    id: z.string(),
    dangerouslyUseUndeployed: z.union([
      z.object({
        latest: z.literal(true),
      }),
      z.object({
        revisionId: z.string(),
      }),
    ]),
  }),
]);

export type RemoteConfig = z.infer<typeof zRemoteConfigSchema>;
