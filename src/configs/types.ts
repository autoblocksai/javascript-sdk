import { z } from 'zod';
import { RevisionSpecialVersionsEnum } from '../util';

export const zConfigSchema = z.object({
  id: z.string(),
  version: z.string(),
  value: z.record(z.string(), z.unknown()),
});

export type Config = z.infer<typeof zConfigSchema>;

export type ConfigVersion = RevisionSpecialVersionsEnum | string;

export const zConfigParameterSchema = z.union([
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

export type ConfigParameter = z.infer<typeof zConfigParameterSchema>;
